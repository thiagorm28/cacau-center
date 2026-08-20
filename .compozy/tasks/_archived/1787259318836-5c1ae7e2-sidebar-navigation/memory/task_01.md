# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Concluída. `navigation.ts` criado e `App.tsx` passou a ler papéis/tela inicial dele. UT-001–UT-004, IT-006, IT-007 implementados e verdes.

## Important Decisions

- `getHomePathForRole` deriva de `NAV_ROUTES.find(item => item.role === role)`, e **não** do primeiro item de `getNavItemsForRole`: a lista do admin começa em `/notas`, mas a tela inicial dele é `/usuarios` (UT-004).
- O guard de `/notas/:noteId/bipagem` também passou a ler o papel do registro (`roleForPath("/notas")`), além dos três pontos de chamada de topo. A rota é sub-fluxo de `/notas` e usava o mesmo literal; isso atende ao critério "nenhum literal de papel sobra nos pontos de chamada de `<RequireRole>`" sem colocar a rota em `NAV_ROUTES`.
- `App.tsx` guarda um helper local `roleForPath(path)` em vez de exportar um lookup de `navigation.ts` — o techspec fixa as três exportações do módulo e nada mais.

## Learnings

- `tsconfig` do frontend usa índice checado: `items[0].path` em teste quebra o `typecheck` mesmo com o teste passando. Assertar via `items.map(i => i.path)`.
- IT-006/IT-007 renderizam o `App` inteiro, então `api/client` precisa de `vi.mock` para `listNotes`/`listHistory`/`listUsers`; as telas carregam em efeito, então use `findByRole("heading", ...)`.
- Mutação de controle: trocar o papel de `/usuarios` para `operador` em `NAV_ROUTES` derruba 7 casos de App/navigation — a suíte de fato pega regressão de papel.

## Files / Surfaces

- Novos: `frontend/src/routes/navigation.ts`, `frontend/src/routes/navigation.test.ts`, `frontend/src/App.test.tsx`.
- Alterado: `frontend/src/App.tsx` (só a origem dos valores).
- Intocados de propósito: `RequireRole.tsx`, `RequireRole.test.tsx` (passa sem edição), `test/session.tsx` (overrides inline bastaram).

## Errors / Corrections

- Primeira versão do `navigation.test.ts` usava `items[0].path` e quebrou o `typecheck`; corrigido antes do fechamento.

## Ready for Next Run

- task_02 consome `getNavItemsForRole` para a lista do `NavDrawer`; a ordem de `NAV_ROUTES` já é a ordem de exibição.
