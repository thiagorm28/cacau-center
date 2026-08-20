# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01, task_02 e task_03 concluídas (registro `navigation.ts` + refatoração do `App.tsx`; `NavDrawer` + `Screen` + limpeza do `LogoutButton` em 6 telas; IT-008, helper `logout(page)` e a jornada E2E-001 da gaveta), sem commit — `--auto-commit=false`.

## Shared Decisions

- `getHomePathForRole` ≠ primeiro item de `getNavItemsForRole`: para o admin a lista começa em `/notas` mas a tela inicial é `/usuarios`. Quem for reusar essas funções não deve derivar uma da outra.

## Shared Learnings

- `Screen` passou a renderizar o `NavDrawer`, que chama `useLocation()`: todo teste que renderiza uma tela precisa de `MemoryRouter` em volta. `withSession()` continua sem router próprio de propósito (o `App.test.tsx` passa o dele por dentro).
- O logout deixou de ser um botão "Sair" solto no cabeçalho: agora vive dentro do painel `role="dialog"`, atrás do gatilho `Abrir menu de navegação`. Vale para Vitest e Playwright.
- `frontend/dist/` é versionado — `npm run build` suja o diff; reverter depois de usá-lo como verificação.
- Verificação local: o `DATABASE_URL` do `.env` da raiz aponta para o host `postgres` (rede do docker), então `npm test` na raiz derruba as 9 suítes de integração do backend com `EAI_AGAIN`. Rodar com `DATABASE_URL="postgres://cacau:cacau@localhost:5432/cacau_test"` deixa backend 157/157 verde. Isso não é regressão de nenhuma task.
- O `tsconfig` do frontend recusa indexação não checada (`items[0].x`) — vale para testes também; `npm run typecheck` é gate separado do `vitest`.
- Testes que montam o `App` inteiro precisam de `vi.mock` em `src/api/client` (`listNotes`, `listHistory`, `listUsers`).
- Rodar a suíte Playwright nesta máquina exige dois contornos, ambos sem root: (1) o Chromium não sobe sem `libnspr4`/`libnss3`/`libasound2t64` — baixar os .deb com `apt-get download`, extrair com `dpkg -x` e exportar `LD_LIBRARY_PATH`; (2) o ambiente de dev ocupa exatamente as portas da suíte (backend em container na 3001, vite na 5174) e o `reuseExistingServer` os reaproveita, deixando o banco E2E sem migrar — rodar com portas alternativas no `playwright.config.ts` (e o `BACKEND_URL` hardcoded do `fixtures.ts` junto) e reverter depois.

## Open Risks

- Nenhum aberto. (O risco das 4 specs E2E que clicavam em "Sair" direto na tela foi fechado na task_03, via o helper `logout(page)` do `e2e/support/fixtures.ts`.)

## Handoffs

- Feature implementada e verificada de ponta a ponta; falta apenas o commit manual.
