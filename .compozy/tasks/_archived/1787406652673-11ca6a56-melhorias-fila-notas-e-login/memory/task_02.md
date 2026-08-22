# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Backend da exclusão de nota em conferência: `DeleteNote` + `DELETE /notes/:id` (204/404/409),
cascata orquestrada `scan_events` → `note_items` → `invoice_notes`. Concluída.

## Important Decisions

- Conflito no `_techspec.md`: a seção *Monitoring* pede log com `noteId` **e** `operatorId`,
  mas *Core Interfaces* (e o task file) fixam `Input = { noteId }`. Venceu o contrato
  tipado: o log sai só com `noteId`. Follow-up registrado abaixo.
- `@HttpCode(204)` é explícito na rota: o default do Nest para `@Delete` é 200, não 204.
- `InMemoryNoteRepository.delete` remove o `NoteRecord` inteiro (itens moram dentro do
  record), espelhando o `DELETE` das duas tabelas reais.

## Learnings

- `SyncScanEvents` não isola falha por evento: um `manualItemId` órfão derruba o lote
  inteiro com 404 (`NotFoundError` do `planManual`). É esse o comportamento que IT-010
  documenta — nenhum evento do lote é gravado.

## Files / Surfaces

- Novos: `backend/src/application/usecase/DeleteNote.ts`,
  `backend/test/unit/DeleteNote.test.ts`, `backend/test/integration/note-delete.test.ts`.
- Modificados: `NoteRepository.ts`, `ScanEventRepository.ts`, `NoteController.ts`,
  `NoteModule.ts`, `test/support/InMemoryRepositories.ts`.
- Sem mudança de schema e sem migration nova (ADR-004) — confirmado por `git status`.

## Errors / Corrections

## Ready for Next Run

- Contrato para o task_04: `DELETE /notes/:id` → 204 sem corpo; 404 `"Nota não encontrada"`
  (id inexistente ou fora do formato UUID); 409 `"Nota não está mais em conferência"`;
  403 para papel diferente de `operador`; 401 sem sessão.
- Follow-up (fora de escopo desta task): o log de exclusão não registra quem excluiu.
  Precisa de `operatorId` no `Input` do `DeleteNote`, o que muda o contrato do
  `_techspec.md` — decidir em PRD futuro.
