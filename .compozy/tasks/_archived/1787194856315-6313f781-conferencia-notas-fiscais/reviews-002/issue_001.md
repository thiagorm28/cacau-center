---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: backend/src/infra/repository/NoteRepository.ts
line: 157
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: confirmed_qty can exceed expected_qty under concurrent scans

## Review Comment

The core business invariant ("a contagem de um item nunca ultrapassa a quantidade
esperada") is enforced only in application code, from a snapshot read before the
write, with no DB-level guard — so two concurrent scans of the same item's last unit
can both be accepted.

`ApplyScanEvent.applyWithin` (`backend/src/application/usecase/ApplyScanEvent.ts:50-92`)
reads `repositories.notes.listOpen()` at the start of its transaction, runs `resolveScan`
against that in-memory snapshot to decide `matched` vs `exceeded`, and only afterwards
writes. `NoteRepository.incrementConfirmedQty` then does a blind, unconditional
increment:

```ts
async incrementConfirmedQty(itemId: string): Promise<void> {
  await this.exec
    .update(noteItems)
    .set({ confirmedQty: sql`${noteItems.confirmedQty} + 1` })
    .where(eq(noteItems.id, itemId));
}
```

There is no `WHERE confirmed_qty < expected_qty` guard and no `SELECT ... FOR UPDATE`
locking the candidate row before the decision is made. Under Postgres's default READ
COMMITTED isolation, two overlapping requests for the same item (a double-tap, a
network retry that resubmits with a new `clientEventId`, or — on a slow item — two
back-to-back scans that both fire before the first response returns) can each read
`confirmedQty = expectedQty - 1`, each independently decide `matched` via `resolveScan`,
and each execute the increment. Postgres serializes the two `UPDATE`s against lost
updates on the counter itself, but neither transaction is aware the other already
"spent" the last pending unit, so `confirmed_qty` ends up one over `expected_qty` —
directly violating the quantity-limit business rule, and (per `ApplyScanEvent.confirmBox`)
can also cause a note to be marked `completed` on a scan that should have been rejected
as `exceeded`.

No test in the suite exercises concurrent requests (all unit/integration tests are
strictly sequential), so this gap isn't caught by CI.

Suggested fix: make the increment self-guarding and let the DB be the source of truth
for the decision, e.g.:

```ts
const [row] = await this.exec
  .update(noteItems)
  .set({ confirmedQty: sql`${noteItems.confirmedQty} + 1` })
  .where(and(eq(noteItems.id, itemId), lt(noteItems.confirmedQty, noteItems.expectedQty)))
  .returning({ confirmedQty: noteItems.confirmedQty });
```

and treat zero affected rows as `exceeded` rather than trusting the earlier in-memory
`resolveScan` decision. Add a DB `CHECK (confirmed_qty <= expected_qty)` on
`note_items` as a backstop.

## Triage

- Decision: `VALID`
- Notes:

**Confirmado.** A leitura do relato bate com o código: `ApplyScanEvent.applyWithin` lê
`repositories.notes.listOpen()`, decide via `resolveScan` sobre esse snapshot em memória e
só depois escreve, enquanto `NoteRepository.incrementConfirmedQty` fazia um `UPDATE ... SET
confirmed_qty = confirmed_qty + 1 WHERE id = $1` sem nenhuma guarda. Sob READ COMMITTED
(padrão do Postgres, e a `UnitOfWork` não eleva o nível de isolamento), duas transações
sobrepostas para o mesmo item leem `confirmed_qty = expected_qty - 1`, ambas resolvem
`matched` e ambas incrementam — o Postgres impede a perda de update no contador, mas não
sabe que a decisão de negócio de uma invalidou a da outra. Resultado: `confirmed_qty`
termina acima de `expected_qty`.

Nenhum teste da suíte dispara requisições concorrentes, então a lacuna não era coberta.

**Causa raiz:** a decisão sobre o limite de quantidade era tomada em memória, sobre um
snapshot lido antes da escrita, e a escrita não revalidava o invariante.

**Correção aplicada:**

1. `NoteRepository.incrementConfirmedQty` virou auto-guardado: o `UPDATE` ganhou
   `AND confirmed_qty < expected_qty`, usa `.returning()` e devolve `Promise<boolean>`
   indicando se a caixa foi realmente creditada. Sob READ COMMITTED, a transação que
   espera o lock da linha reavalia o predicado depois do commit da primeira (EvalPlanQual)
   e atualiza zero linhas — o banco passa a ser a autoridade sobre o limite.
2. `ApplyScanEvent` (fora da lista de arquivos do batch, mas necessário: sem consumir o
   retorno, a guarda do repositório não muda comportamento nenhum — a mudança ficou
   restrita ao caminho de confirmação) passou a confirmar a caixa **antes** de gravar o
   `scan_event` e a rebaixar o plano de `matched`/`manual_matched` para `exceeded` quando o
   incremento guardado não credita nada. Assim o evento já é gravado com o resultado
   correto, sem `UPDATE` corretivo, e a conclusão automática da nota (`confirmBox`) só roda
   para a bipagem que de fato ganhou a última unidade.
3. Backstop no banco: `CHECK (confirmed_qty <= expected_qty)` em `note_items`
   (`backend/src/infra/database/schema/noteItems.ts` + migration `0001_note_items_qty_check`),
   para que qualquer caminho futuro que escreva o contador falhe alto em vez de corromper o
   dado.
4. A conclusão automática da nota (`confirmBox`) passou a reler o agregado com
   `notes.findById` dentro da transação em vez de julgar pelo snapshot do início. Sem isso
   a correção trocaria um erro por outro: com o incremento já atômico, a transação que
   credita a última caixa continuaria enxergando o contador antigo no snapshot e deixaria a
   nota `open` para sempre. Sob READ COMMITTED cada statement vê o que já foi commitado,
   então essa leitura inclui as caixas das bipagens concorrentes mais a que a própria
   transação acabou de gravar.
5. `InMemoryNoteRepository` (suporte de teste) replica a mesma semântica de guarda.

**Testes adicionados:**

- `backend/test/unit/ApplyScanEvent.test.ts` — UT-028: snapshot vencido (a última unidade
  foi consumida entre o `listOpen` e a escrita) é rebaixado para `exceeded`, o contador não
  passa de `expected_qty` e o evento é gravado como `exceeded`.
- `backend/test/integration/notes-lifecycle.test.ts` — IT-029: 12 `POST /scan-events`
  concorrentes de verdade contra o Postgres real para um item de `expectedQty = 8`, exatamente
  8 `matched` e 4 `exceeded`, `confirmed_qty` final igual a 8 e nota `completed`.

Ambos os testes foram validados em red/green: revertendo apenas a guarda do `WHERE`,
UT-028 falha com `expected { kind: 'matched' } to deeply equal { kind: 'exceeded' }` e
IT-029 falha com `expected 422 to be 200` — o 422 é o próprio `CHECK` do banco disparando,
o que também confirma que o backstop funciona.

**Limitação residual (conhecida, não corrigida aqui):** a conclusão automática continua
sujeita a uma corrida quando duas bipagens concorrentes fecham *itens diferentes* da mesma
nota — cada transação pode reler antes do commit da outra, ver o item alheio ainda pendente
e nenhuma marcar `completed`. Fechar isso exigiria travar o agregado inteiro (`SELECT ...
FOR UPDATE` na nota), o que está fora do escopo deste issue. O impacto é benigno e não viola
invariante nenhum: a nota fica `open` e o gerente a finaliza normalmente — diferente da
corrupção de contador relatada aqui, que era o problema crítico.
