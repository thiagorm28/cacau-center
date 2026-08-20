# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- `NavDrawer` completo + embutido no `Screen`; `LogoutButton` removido de 6 telas (ScanScreen mantendo o `BigCounter`). Concluída, sem commit (`--auto-commit=false`).

## Important Decisions

- Fundo escurecido é um `<button aria-label="Fechar menu de navegação">` cobrindo a tela, não uma `<div>` com `onClick`: dá alvo acessível e query direta nos testes.
- Painel só existe no DOM quando aberto (o contrato UT-011/UT-012 exige zero nós `role="dialog"` fechado); a animação de entrada vem de um estado `isEntered` que troca `translateX(-100%)` por `0` logo após a montagem.
- O gesto é ignorado quando o `touchstart` cai sobre elemento focável (`closest(FOCUSABLE_SELECTOR)`) — cobre o risco "arrasto começando num item de navegação" do TechSpec sem precisar de camada de fundo separada.
- A transição CSS é desligada enquanto `dragOffsetPx !== 0`, senão o painel ficaria atrasado em relação ao dedo.
- Fallback de nome vazio: `"Usuário sem nome"` (UT-024 só exige não-vazio).
- UT-022 (papel sem itens) é impossível pelos dados reais: `getNavItemsForRole` é espionado com `vi.fn(actual)` e o real é reinjetado no `beforeEach` via `vi.importActual`.

## Learnings

- `Screen` agora chama `useLocation()` (via `NavDrawer`), então **qualquer** teste que renderize uma tela precisa de `MemoryRouter`. Sete suítes existentes quebraram por isso e ganharam um helper `routed()` local (ou wrapper direto): ChangePasswordScreen, HistoryScreen, ReportScreen, ScanScreen, UsersScreen, RequireRole e SessionContext (esta última por renderizar a `LoginScreen`).
- `withSession()` não pôde embutir o `MemoryRouter` porque `App.test.tsx` já passa o próprio router por dentro dele — aninhar routers quebra o react-router v7.
- `fireEvent.touchStart/Move/End` com `{ touches: [{ clientX }] }` funciona no jsdom deste repo sem polyfill.
- `npm run build` no frontend reescreve `frontend/dist/`, que é versionado — reverter (`git checkout -- frontend/dist`) depois de usá-lo como verificação.

## Files / Surfaces

- Novos: `frontend/src/components/ui/NavDrawer.tsx`, `NavDrawer.test.tsx` (UT-005–UT-027), `Screen.test.tsx` (IT-001–IT-005, IT-009, IT-010).
- Modificados: `Screen.tsx`; `NotesQueueScreen`, `ScanScreen`, `ReportScreen`, `HistoryScreen`, `UsersScreen`, `RequireRole` (só remoção do `LogoutButton`); 7 suítes existentes ganhando `MemoryRouter`.
- Intocados como manda o contrato: `LogoutButton.tsx`, `ChangePasswordScreen.tsx`, `frontend/package.json`.

## Errors / Corrections

- UT-024 nasceu com um `getByText(/\S/)` redundante que casava vários nós; ficou só a asserção do texto de fallback dentro do painel.

## Ready for Next Run

- task_03 (E2E): o logout agora é `Abrir menu de navegação` → botão `Sair` dentro do `role="dialog"`. As 4 specs `gestao-usuarios-e2e-001..004` continuam consultando "Sair" direto e vão falhar até o helper `logout(page)` existir.
