# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Fechar a feature no nível de integração/E2E: IT-008 sobre as rotas reais, helper `logout(page)`, as 4 specs `gestao-usuarios-e2e-001..004` passando pela gaveta e a nova jornada E2E-001. Concluída.

## Important Decisions

- IT-010 **não** foi duplicado: já está implementado pela task_02 em `Screen.test.tsx:109` (popstate com a gaveta aberta). O subtask 3.2 pedia justamente para confirmar antes de duplicar.
- IT-008 foi para o `App.test.tsx` (e não um arquivo novo): é lá que a fatia real do `App` já está montada em `MemoryRouter` com os mocks do `api/client`.
- A nova spec virou `e2e/specs/navegacao-e2e-001-gaveta.spec.ts`, seguindo o prefixo por feature que as specs de gestão de usuários já usam (os IDs `E2E-00x` se repetem entre features de propósito).

## Learnings

- O logout na spec E2E precisa ser escopado no painel (`page.getByRole("dialog").getByRole("button", { name: "Sair" })`); "Sair" solto na página não existe mais.
- A jornada E2E-001 confirma o bloqueio pós-logout com `page.goBack()` **e** `page.goto("/usuarios")` — só o goBack cairia na rota anterior (`/historico`), não em `/usuarios`.

## Files / Surfaces

- `frontend/src/App.test.tsx` (IT-008), `e2e/support/fixtures.ts` (`logout`), `e2e/specs/gestao-usuarios-e2e-001..004`, `e2e/specs/navegacao-e2e-001-gaveta.spec.ts` (novo).

## Errors / Corrections

- Primeira rodada da suíte E2E: todas as 17 specs falharam por `libnspr4.so` ausente (o aviso do `CLAUDE.md`), sem root para `--with-deps`. Contornado sem sudo: `apt-get download libnspr4 libnss3 libasound2t64` em `/tmp/pwlibs`, `dpkg -x`, e `LD_LIBRARY_PATH=/tmp/pwlibs/root/usr/lib/x86_64-linux-gnu`.
- Segunda rodada: `reset do estado de teste` 500 — o `reuseExistingServer` reaproveitou o backend de dev (container docker na 3001) e o vite de dev (5174), que são exatamente as portas da suíte; o banco E2E nunca migrava. Contornado com override temporário no `playwright.config.ts` (3011/5184, `reuseExistingServer: false`) + `BACKEND_URL` do `fixtures.ts` na mesma porta, revertido depois.

## Ready for Next Run

- Suíte E2E verde: 17/17. Frontend: 113/113 + typecheck limpo. Sem commit (`--auto-commit=false`).
