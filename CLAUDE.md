# DESIGN.md

- Toda a UI que você trabalhar, você sempre tem que seguir o ./DESIGN.md completamente
- Leia sempre o DESIGN.md antes de começar tanto planejamento quanto execução de tarefas de UI

# Testes E2E (Playwright)

- Configuração na raiz: `playwright.config.ts` sobe `backend` (`PORT=3001`) e `frontend` (`VITE_API_URL=http://localhost:3001`, porta `5174`) em paralelo via `webServer`.
- A suíte exige um Postgres próprio em `localhost:55432` (`docker-compose.e2e.yaml`), separado do de desenvolvimento porque cada teste trunca todas as tabelas. Suba com `npm run e2e:db:up` e derrube com `npm run e2e:db:down`.
- Rodar localmente: `npm install` na raiz, `npx playwright install chromium`, `npm run e2e:db:up`, `npm run test:e2e`. UI mode: `npm run test:e2e:ui`.
- Para usar um Postgres já existente em vez do container, aponte `E2E_DATABASE_URL` para ele — use sempre um banco descartável.
- No Linux, o Chromium do Playwright ainda depende de bibliotecas do sistema (`libnss3`, `libnspr4`, `libasound2`): use `npx playwright install --with-deps chromium` (pede root) ou o navegador falha ao iniciar.