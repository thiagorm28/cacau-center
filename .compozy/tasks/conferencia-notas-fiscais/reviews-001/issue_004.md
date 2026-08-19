---
provider: manual
pr:
round: 1
round_created_at: 2026-08-18T04:40:33Z
status: resolved
file: frontend/src/features/scan/ScanScreen.tsx
line: 41
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: No automatic "nota completa" confirmation on the scan screen

## Review Comment

US-010 AC-1 requires: "quando a última caixa necessária é bipada..., o sistema marca a
nota como concluída **e exibe uma confirmação clara de 'nota completa'** com o resumo
dos itens conferidos." The backend does mark the note `completed` immediately
(`ApplyScanEvent.confirmBox`), but `ScanScreen` never surfaces that transition: the only
feedback shown is the per-scan `ScanFeedbackBanner` ("Confirmado: <item>") and the
per-item "Item completo" tag in `NoteItemList` — there is no note-level "Nota completa!"
banner triggered when `activeNote.status` flips to `"completed"`. The "Finalizar
conferência" button also doesn't change its label or behavior to reflect that the note
is already done; the operator only sees any completion confirmation after proactively
clicking it and landing on `ReportScreen`, which shows the "Tudo certo" banner.

`frontend/src/features/notes/NoteQueueCard.tsx` has the same gap: unlike
`HistoryScreen`, which renders an explicit `STATUS_LABEL` badge per note, the queue card
only shows a raw `confirmedTotal/expectedTotal` count with no completed/open badge, so
US-008 AC-2 ("vê claramente o progresso... de cada nota") is only indirectly satisfied
by the ratio reading e.g. "10/10".

No test (`ScanScreen.test.tsx`, `NoteSearchForm.test.tsx`, etc.) covers the scenario of
the last scan completing a note and asserts an on-screen completion confirmation, which
is consistent with this being unimplemented rather than just untested.

Suggested fix: when `withConfirmedItem` transitions a note to `"completed"` in
`useScanSession`, surface a distinct completion banner/state on `ScanScreen` (and
optionally an explicit status badge on `NoteQueueCard`), independent of the manual
"Finalizar conferência" click.

## Triage

- Decision: `VALID` (ponto principal) — corrigido.
- Notes:

**Causa raiz.** `withConfirmedItem` (`useScanSession.ts`) já vira o `status` da nota para
`"completed"` assim que a última caixa é bipada, mas `ScanScreen` nunca lia esse campo: a
tela só derivava `pendingItems` para decidir se abria o `FinalizeDialog`. Confirmado no
código original — nenhuma referência a `activeNote.status` em `ScanScreen.tsx`. Logo a
transição de US-010.AC-1 acontecia sem nenhuma confirmação de nível de nota, e o rótulo do
botão continuava "Finalizar conferência" mesmo com a nota já concluída.

**Correção aplicada** (`frontend/src/features/scan/ScanScreen.tsx`):

- `isNoteComplete = activeNote.status === "completed"` passa a governar a tela.
- Banner `tone="success"` (role `status`, lido por leitor de tela) com a confirmação e o
  resumo pedido pelo AC-1: `"Nota completa! N de N caixas conferidas em M itens."`. O
  detalhamento por item continua logo abaixo no `NoteItemList`, com as tags "Item completo".
- O botão de finalização passa a exibir "Ver relatório da nota" quando a nota já está
  concluída — o clique continua indo direto para o relatório, sem o diálogo de divergência.
- Segue o `DESIGN.md`: reaproveita o componente `Banner` (raio pílula, `bg-accent-100` com
  texto no passo `accent-900`), sem nenhuma cor ou formato novo.

**Sub-ponto de `NoteQueueCard`: inválido, sem alteração.** `NotesQueueScreen` chama
`listNotes("open")` (`NotesQueueScreen.tsx:24`), então a fila só contém notas abertas — um
badge de status ali leria sempre "Em conferência" e nunca "Completa", virando ruído em vez
de informação. A saída da nota concluída da fila é ela própria o sinal de conclusão
(comportamento já coberto pelo E2E-002, que exige `toHaveCount(0)` para a nota 2 depois de
completa). US-008.AC-2 pede o progresso individual de cada nota, que o cartão já entrega
com a razão `confirmedTotal/expectedTotal` e a `PillProgress`. Por isso o arquivo ficou
fora da correção, o que também mantém o diff dentro dos arquivos do `batch_scope`.

**Testes.**

- `ScanScreen.test.tsx`: dois casos novos — a última bipagem exibe a confirmação com o
  resumo e troca o rótulo do botão sem nenhum clique; e a nota com item ainda pendente não
  anuncia conclusão (guarda contra falso positivo).
- `e2e/specs/e2e-001-bipagem-completa.spec.ts` e `e2e-004-offline.spec.ts`: passam a exigir
  o banner "Nota completa!" (inclusive offline, onde a conclusão é calculada no aparelho) e
  usam o novo rótulo do botão. Os E2E-002/E2E-003 finalizam notas incompletas e seguem com
  "Finalizar conferência", sem alteração.

**Verificação.** `npm run typecheck` (shared, backend, frontend, e2e) e `npm run test` do
workspace `frontend` passam — 30 testes, incluindo os 8 de `ScanScreen`. As 4 suítes de
integração do `backend` falham com `ECONNREFUSED 127.0.0.1:5432` e a suíte Playwright não
roda: este ambiente não tem PostgreSQL nem Docker. É limitação pré-existente do ambiente,
sem relação com esta correção, que não toca em nenhum arquivo do `backend`.
