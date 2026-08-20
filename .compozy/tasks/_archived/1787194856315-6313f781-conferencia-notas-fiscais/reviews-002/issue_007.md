---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: backend/src/application/usecase/SearchNote.ts
line: 26
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: SearchNote's duplicate-open-note check has a TOCTOU race

## Review Comment

`invoice_notes.invoiceNumber` intentionally has no unique DB constraint (per the
techspec, since the same number can legitimately reopen after the original note is
closed). Duplicate prevention relies entirely on an application-level check-then-act:

```ts
const duplicated = await this.unitOfWork.run(({ notes }) =>
  notes.hasOpenWithInvoiceNumber(input.invoiceNumber),
);
if (duplicated) throw new ConflictError("Nota já está em conferência");
const nfe = await this.nfeGateway.fetchByInvoiceNumber(input.invoiceNumber);
const note = await this.unitOfWork.run(async ({ notes }) => {
  if (await notes.hasOpenWithInvoiceNumber(input.invoiceNumber)) {
    throw new ConflictError("Nota já está em conferência");
  }
  return notes.create({ /* ... */ });
});
```

There's a second check inside the creating transaction (explicitly added to narrow the
window around the external HTTP call), but it's a plain `SELECT`, not `SELECT ... FOR
UPDATE`, and there's no unique index backing it. Under READ COMMITTED, two concurrent
`POST /notes` requests for the same `invoiceNumber` — e.g. a double-tap on "buscar", or
two operators racing to register the same delivery note — can both pass their
in-transaction re-check before either commits its `INSERT`, producing two simultaneous
`open` notes with the same invoice number. This silently violates the US-001.EC-2
guarantee that a note already in review can't be opened again.

Suggested fix: take a `pg_advisory_xact_lock` keyed by `invoiceNumber` (or a
`SELECT ... FOR UPDATE` on any existing row matching it) before the final insert, so
the check-then-act is actually atomic.

## Triage

- Decision: `VALID`
- Notes:

A corrida existe como descrita. `hasOpenWithInvoiceNumber` é um `SELECT` simples e
`invoice_notes.invoiceNumber` não tem índice único, então sob READ COMMITTED nenhuma das
duas transações concorrentes enxerga o `INSERT` não commitado da outra: as duas passam
pela re-checagem interna e as duas inserem, quebrando a garantia da US-001.EC-2. A
segunda checagem dentro da transação estreita a janela em volta da chamada HTTP externa,
mas não a fecha — ler dentro da transação não impede uma escrita concorrente.

### Causa raiz

Check-then-act sem serialização: a leitura que decide o `INSERT` não trava nada, e não há
constraint no banco para servir de rede de segurança.

### Correção aplicada

- `NoteRepository.lockInvoiceNumber(invoiceNumber)` (novo método da interface): executa
  `select pg_advisory_xact_lock(hashtext($1))`. O lock é de transação, então cai sozinho
  no commit ou rollback, sem `unlock` explícito nem risco de vazamento.
- `SearchNote.execute` chama o lock como primeira operação da transação que insere, antes
  da re-checagem. A segunda requisição fica bloqueada até a primeira commitar; quando
  destrava, sua checagem já enxerga a nota aberta e ela recebe o `ConflictError` esperado.
- A pré-checagem fora da transação continua como caminho rápido (evita a chamada HTTP no
  caso comum); a correção não depende dela.

Optou-se pelo advisory lock em vez de `SELECT ... FOR UPDATE` porque no caso da primeira
abertura não existe linha para travar — `FOR UPDATE` num resultado vazio não bloqueia
nada. Um índice único parcial (`WHERE status = 'open'`) também resolveria, mas exigiria
migration e trocaria o `ConflictError` de domínio por tratamento de erro de constraint.

### Arquivos fora do `<batch_scope>`

O lock é um mecanismo de banco, e as convenções de DDD do repositório proíbem SQL na
camada de aplicação. Por isso a mudança mínima necessária saiu de `SearchNote.ts`:

- `backend/src/infra/repository/NoteRepository.ts`: método novo + implementação (nenhum
  método existente alterado).
- `backend/test/support/InMemoryRepositories.ts`: no-op no fake, para satisfazer a
  interface.
- `backend/test/unit/SearchNote.test.ts`, `backend/test/integration/notes-lifecycle.test.ts`:
  testes da correção.

### Testes

- `UT-016b` (unidade): fixa a ordem exigida do caso de uso —
  `lockInvoiceNumber` → `hasOpenWithInvoiceNumber` → `create`, dentro da transação.
- `IT-002b` (integração, Postgres real): prova a serialização — a segunda transação fica
  bloqueada enquanto a primeira segura o lock e só avança depois do commit dela.
- `IT-002c` (integração): números diferentes não bloqueiam um ao outro, garantindo que o
  lock não serializa aberturas não relacionadas.

Controle negativo executado: com `lockInvoiceNumber` neutralizado para no-op, `IT-002b`
falha (`expected true to be false`) e volta a passar com a implementação real — o teste
de fato pega a regressão.

Um teste inicial que disparava dois `POST /notes` concorrentes foi descartado: ele passava
com e sem o lock (a janela real é curta demais para reproduzir a corrida de forma
determinística por HTTP), então não tinha valor de regressão. `IT-002b` testa o mecanismo
diretamente e é determinístico.

### Verificação

`npm run typecheck` (todos os workspaces + e2e) limpo; backend `npm test` 84/84 passando;
`npm run build` OK. A suíte do frontend é intermitente por conta própria (timeouts de 5s
sob execução paralela): com o mesmo código, uma execução passou 7/7 e a seguinte falhou 3
arquivos. A falha é pré-existente e não tem relação com esta mudança, que é restrita ao
backend.
