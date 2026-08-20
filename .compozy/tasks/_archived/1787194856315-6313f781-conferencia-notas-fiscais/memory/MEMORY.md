# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Task 1 concluída: `shared` exporta `resolveScan` + tipos, com UT-001–UT-010 passando.
- Task 2 concluída: `backend` NestJS completo (auth, notas, bipagem, relatório, histórico),
  Drizzle/Postgres no schema `public`, `NfeGateway` HTTP. UT-011–043 e IT-001–028 passando;
  typecheck e build limpos nos dois workspaces.
- Task 3 concluída: PWA `frontend` (Vite+React+TS+Tailwind v4) com todas as telas,
  `useBarcodeScanner` (ZXing-wasm), `useOfflineQueue` (IndexedDB) e `vite-plugin-pwa`.
  UT-044–067 passando; typecheck e build limpos.
- Task 4 concluída: suíte E2E Playwright na raiz (`playwright.config.ts`, `e2e/`),
  E2E-001–E2E-007 passando sem tocar a API real da Cacau Show.
- Task 5 concluída: `docker-compose.prod.yaml` + `Caddyfile` (TLS automático, `/api/*`
  para o backend na porta interna 3000, resto para o build estático) + `.env.example` +
  `DEPLOY.md`. Stack validado com `config` e smoke test HTTP local.
- O repositório **não** é um repositório git (não há histórico para consultar nem commits
  possíveis).

## Shared Decisions

- Testes unitários do pacote `shared` ficam co-locados em `src/**/*.test.ts`
  (`tsconfig.build.json` os exclui do `dist`). O `backend` usa `test/**/*.test.ts` e
  resolve `shared` por alias para `shared/src/index.ts`, então não depende de build prévio.

## Shared Learnings

- `resolveScan` é guloso por bipagem e **não é** independente da ordem de bipagem em
  cenários assimétricos. Qualquer task que reaplique um lote de eventos (sync offline,
  E2E) precisa preservar a ordem original dos eventos para reproduzir a mesma alocação.

## Open Risks

- US-009.AC-3 / UT-003 afirmam que o cenário de referência (10 panetones + 1 trufa)
  credita tudo à nota 2 "em qualquer ordem". O algoritmo da ADR-001 só entrega isso
  quando a trufa é bipada antes dos panetones compartilhados; com a trufa por último a
  nota 1 fica completa. Divergência de spec, fixada por teste em Task 1 e ainda não
  resolvida com o produto — Tasks 2/3/4 herdam esse comportamento.

## Handoffs

- Imagens Docker: o workspace `shared` tem um script `prepare` que o npm executa mesmo
  com `--ignore-scripts`. Qualquer Dockerfile que rode `npm ci` a partir da raiz precisa
  de `npm pkg delete scripts.prepare --workspace shared` antes, senão o build quebra
  (`tsc: not found` ou `tsconfig.build.json` inexistente).
- Rodar a suíte do `backend` exige que o database `cacau_test` já exista no Postgres
  local — `TestApp.ts` roda as migrations, mas não cria o database.

- Task 2/3: importar de `shared` (`resolveScan`, `PendingNote`, `PendingNoteItem`,
  `ScanResolution`); o pacote é framework-free e não conhece persistência.
- Tasks 3/4/5 consomem o backend na porta 3001, sessão via cookie `session`
  (httpOnly/Secure/SameSite=Lax, 8h) e CORS liberado para `FRONTEND_ORIGIN`
  (default `http://localhost:5174`, `credentials: true`).
- Rodar a suíte do `backend` exige um Postgres real e `cwd` = `backend/`
  (migrations e fixture derivam de `process.cwd()`).
- Task 5: a suíte E2E sobe três serviços (`backend` 3001, `frontend` 5174 e um servidor
  local de fixtures NFe na 3002). O `backend` recebe `NFE_BASE_URL` apontando para esse
  servidor — é isso que mantém a suíte independente de `hybrisreports.cacaushow.com.br`.
  O banco é exclusivo da suíte (`cacau_e2e`, sobrescrevível por `E2E_DATABASE_URL`) e é
  truncado a cada teste. Rodar exige `npx playwright install chromium` (+ `install-deps`).
- Task 4/5: a suíte do `frontend` roda com `vitest run --mode test` — esse mode desliga o
  `VitePWA` no config, evitando gerar service worker a cada execução de teste.
- Task 4 (E2E): o dev server em 5174 serve `/manifest.webmanifest`, `/dev-sw.js?dev-sw` e
  `/icons/icon-{192,512}.png`; os ícones vivem em `frontend/public/icons/` e são
  pré-cacheados junto com o `.wasm` do ZXing.
