# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts que são óbvios do repositório, task file, PRD ou git history.

## Objective Snapshot

Fila `/notas` com exclusão de nota, ações explícitas no card ("Ver produtos"/"Excluir") e
atalho único "Bipar". Concluída, com UT-024–UT-046 e E2E-001–E2E-005 passando.

## Important Decisions

- Rótulos: card usa "Ver produtos" (`variant="secondary"`) e "Excluir"
  (`variant="danger"`); o confirmar do diálogo é "Excluir nota", propositalmente
  diferente de "Excluir" para que `getByRole(name)` (exato) distinga os dois nos testes.
- `danger` = `bg-choc-700 text-cream-1 shadow-md hover:bg-choc-800` (mesmo tom do
  `Banner` de erro, hover no passo 800 — mesma lógica dos demais variants).
- O diálogo é renderizado dentro do `Card` do próprio item da lista; o `Dialog` é
  `fixed inset-0`, então a posição no DOM não afeta a sobreposição.
- Aviso de perda é uma frase única no `description` do `Dialog` (não um bloco separado),
  para caber no formato `title`/`description` já existente.
- O botão "Bipar" fica logo abaixo do banner de erro de carga e acima da lista — único e
  fora dos cards (ADR-002).

## Learnings

- ADR-003 quebrou os locators de 5 specs E2E antigas (001–005), que clicavam o card
  inteiro via `getByRole("button", { name: /Nota X/ })`. Corrigido com dois helpers novos
  em `e2e/support/fixtures.ts`: `queueNoteCard(page, invoiceNumber)` (filtra o
  `listitem`) e `openNoteFromQueue(page, invoiceNumber)`. As specs de histórico
  (`e2e-006-007-gerente`, `gestao-usuarios-e2e-002`) continuam com card clicável e não
  foram tocadas.
- Nos E2E de bipagem rápida, o progresso da nota "mais avançada" é criado enquanto ela é
  a única aberta: com duas notas abertas o `resolveScan` decidiria a alocação e o
  cenário deixaria de ser determinístico.
- `buildNote` deriva `expectedTotal`/`confirmedTotal` dos itens; para a fila passe
  `items: []` junto dos totais explícitos.

## Files / Surfaces

- Novos: `frontend/src/features/notes/DeleteNoteDialog.tsx` (+ `.test.tsx`),
  `NoteQueueCard.test.tsx`, `NotesQueueScreen.test.tsx`,
  `frontend/src/components/ui/PillButton.test.tsx`, `frontend/src/api/client.test.ts`,
  `e2e/specs/melhorias-fila-e2e-001..005-*.spec.ts`.
- Modificados: `PillButton.tsx` (variant `danger`), `api/client.ts` (`del<T>`,
  `deleteNote`), `NoteQueueCard.tsx`, `NotesQueueScreen.tsx`, `e2e/support/fixtures.ts`,
  `e2e/specs/e2e-001..005-*.spec.ts` (locators).
- Intocados, como exige o ADR-002: `ScanRoute.tsx`, rotas do `App.tsx`, `resolveScan`.

## Errors / Corrections

- Nenhuma correção de rumo: os testes passaram na primeira execução após a implementação.

## Ready for Next Run

- Nada pendente. Sem commit automático (`--auto-commit=false`): o diff está pronto para
  revisão manual.
