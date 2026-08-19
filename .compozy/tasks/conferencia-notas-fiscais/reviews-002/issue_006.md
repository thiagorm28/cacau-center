---
provider: manual
pr:
round: 2
round_created_at: 2026-08-18T18:30:07Z
status: resolved
file: backend/src/application/usecase/ApplyScanEvent.ts
line: 55
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Note items exit "exceeded" detection the instant their note auto-completes

## Review Comment

`ApplyScanEvent` only ever considers notes returned by `repositories.notes.listOpen()`
(`status = "open"`). As soon as a note's last item is confirmed, `confirmBox` flips its
status to `completed` within the same transaction — which correctly removes it as a
candidate for *pending* allocation of new scans (per US-010.AC-2), but it also removes
it from `resolveScan`'s *exceeded* candidate pool, since that check runs against the
exact same `openNotes` list.

Consequence: a stray re-scan of a product that belonged exclusively to a note that just
auto-completed resolves as `unidentified` (triggering the manual-selection /
unidentified-box flow) instead of `exceeded` (a simple "quantidade já atingida"
warning, per US-005.AC-1). This differs from the case US-005.EC-1 explicitly covers
(two still-`open` notes both fully confirmed for one item) — here the whole note has
completed and dropped out of consideration entirely, not just the item.

Suggested fix: either keep recently auto-completed (but not yet formally
closed/finalized) notes in the exceeded-candidate pool passed to `resolveScan`, or have
`ApplyScanEvent` fall back to explicitly checking recently-completed notes for a
matching fully-confirmed item before defaulting to `unidentified`.

## Triage

- Decision: `VALID`
- Notes:

**Confirmação técnica.** `applyWithin` alimentava `resolveScan` só com
`repositories.notes.listOpen()`, e o `resolveScan` usa a mesma lista tanto para o ramo
`matched` quanto para o ramo `exceeded`. O teste vermelho reproduziu o sintoma contra o
código pré-correção (nota 1 = 1 panetone, nota 2 = 1 trufa, ambas abertas; a nota 1
conclui sozinha na primeira caixa):

- `UT-022a` — a segunda caixa de panetone resolvia `{ kind: "unidentified" }` em vez de
  `exceeded` na nota 1.
- `IT-031` — pelo HTTP real, `POST /scan-events` devolvia `unidentified` depois de a
  nota atingir 100%.

**Causa raiz.** Sair do rateio de novas bipagens ao completar (US-010 AC-2 / EC-1) e
sair da detecção de excedente são regras diferentes, mas estavam acopladas à mesma pool
de candidatas. Os itens da nota concluída continuam 100% confirmados, então rebipar uma
caixa dela é exatamente o caso de US-005 AC-1 ("quantidade já atingida") — a conclusão
automática trocava esse aviso simples pelo fluxo de seleção manual / caixa não
identificada no instante em que a última caixa entrava.

**Correção.** `plan` agora, ao esgotar as notas abertas em `unidentified`, faz uma
segunda passada em `planExceededOnCompleted`: lê as notas `completed` fechadas dentro de
`RECENTLY_COMPLETED_WINDOW_MS` (30 min) via `notes.list({ statuses, closedFrom })` — API
que já existia no repositório, nenhum arquivo fora do escopo foi tocado — e roda o mesmo
`resolveScan` nessa pool. Só o ramo `exceeded` é aproveitado: qualquer `matched` vindo
dali é descartado, o que torna US-010 AC-2 estrutural em vez de depender do invariante
"nota `completed` não tem item pendente". A consulta extra só acontece no caminho raro
que ia virar `unidentified`, então o caminho quente (`matched`) segue com uma leitura só.
A janela evita o outro extremo: uma nota encerrada horas antes voltar a capturar caixas
de uma entrega nova, que devem mesmo cair no fluxo de US-007.

**Escopo deliberadamente não alterado.**

- A guarda `openNotes.length === 0 → "nenhuma conferência ativa"` continua intacta. Com
  uma única nota na fila que acabou de concluir, a bipagem seguinte ainda é recusada com
  422 (comportamento fixado por `UT-027` e pelo teste de filtro global em
  `notes-lifecycle.test.ts`). Relaxar essa guarda é uma decisão de produto separada —
  passaria a aceitar caixas não identificadas depois de a conferência acabar — e o
  cenário descrito nesta issue pressupõe outra nota aberta para a bipagem chegar a
  resolver.
- `planManual` continua restrito às notas abertas: o frontend só oferece candidatos
  pendentes de notas `open`, então não há como escolher manualmente item de nota
  concluída.
- O frontend tem o mesmo acoplamento em `useScanSession` (`openNotes` filtra
  `status === "open"` antes do `resolveScan`) e, sem candidatos pendentes, envia
  `markUnidentified: true` — que curto-circuita o `plan` e permanece `unidentified` por
  intenção explícita do operador (US-007). Ou seja, o aviso "quantidade já atingida"
  visível na tela nesse cenário exige a mesma correção em
  `frontend/src/features/scan/useScanSession.ts`, arquivo fora do escopo deste batch
  (issue separada). A correção aqui deixa o backend — API direta, `SyncScanEvents` e o
  relatório de divergência, onde a bipagem passa a entrar em `exceededScans` da nota
  certa (US-012 EC-2) em vez de `unidentifiedScans` de uma nota alheia — coerente com
  US-005 AC-1.

**Cobertura adicionada.** `UT-022a` (excedente na nota recém-concluída) e `UT-022b`
(nota fechada fora da janela volta a `unidentified`) em
`backend/test/unit/ApplyScanEvent.test.ts`; `IT-031` em
`backend/test/integration/notes-lifecycle.test.ts`, que exercita o filtro
`statuses/closedFrom` no Drizzle real. Ciclo red-green verificado: `UT-022a` e `IT-031`
falham contra o código pré-correção e passam depois dela.
