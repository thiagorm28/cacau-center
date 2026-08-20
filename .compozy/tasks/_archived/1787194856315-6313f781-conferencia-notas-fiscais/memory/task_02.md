# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Backend NestJS completo (auth + notas + bipagem + relatório + histórico), Drizzle/Postgres,
`NfeGateway` HTTP. Concluído: UT-011–043 e IT-001–028 implementados e passando.
Status marcado como `completed` após conferência de paridade de contrato (techspec:
schema, tabela de endpoints/status, tipos de use case; `_tests.md`: os 61 IDs atribuídos
conferidos um a um contra os testes existentes — nenhum faltando).

## Important Decisions

- Guardas globais via `APP_GUARD` (`AuthGuard` depois `RoleGuard`) + `@Public()` só no login,
  em vez de `@UseGuards` por rota — o techspec exige sessão em todas as rotas.
- Mapeamento de status HTTP centralizado no filtro global (`ErrorFilter`), não nos
  controllers como a prosa do techspec sugere: mesmo comportamento observável, controller
  continua fino.
- `UnitOfWork` (`infra/database/UnitOfWork.ts`) entrega repositórios já ligados à `tx`.
  Foi o jeito de manter "read-then-write na mesma transação" sem vazar Drizzle para os
  casos de uso — e é o que torna os testes de unidade possíveis com `FakeUnitOfWork`.
- `SyncScanEvents` injeta `ApplyScanEvent` e chama `applyWithin(repos, input)` (uma
  transação por evento), conforme o techspec manda reusar a mesma lógica.
- `GET /notes/history` é declarado antes de `GET /:id` no controller, senão "history"
  casa como id.

## Learnings

- `emitDecoratorMetadata` não existe no esbuild: `vitest.config.js` usa `unplugin-swc`,
  senão a DI do Nest e o `ValidationPipe` quebram nos testes de integração.
- `useClass` falha em provider cujo construtor tem parâmetro com default
  (`PasswordHasherBcrypt(rounds = 10)`) — Nest tenta injetar `Number`. Usar `useFactory`.
- Caminhos derivam de `process.cwd()` (migrations e fixture): rodar sempre a partir de
  `backend/`. Rodar da raiz do repo faz o vitest ignorar `backend/vitest.config.js`.
- Postgres de teste local: `docker run` + `CREATE DATABASE cacau_test`, e
  `DATABASE_URL=postgres://cacau:cacau@localhost:<porta>/cacau_test npx vitest run`.

## Files / Surfaces

- `backend/` inteiro (novo), `docker-compose.yaml` (novo), root `package.json` (workspaces).
- `backend/drizzle/0000_init.sql` — migration inicial, 4 tabelas no schema `public`.

## Errors / Corrections

- UT-022/UT-024 escritos primeiro com nota de item único: a nota auto-completa e sai das
  candidatas, então `exceeded` nunca acontece. Arranjo corrigido (item extra pendente) —
  o código estava certo, o teste é que estava errado.
- `SearchNote.Output` tinha `invoiceNumber`/`supplierName` a mais que o tipo do techspec;
  removidos na conferência de paridade de contrato.

## Ready for Next Run

- Task 3 (frontend) consome: cookie `session` (httpOnly/Secure/SameSite=Lax, 8h),
  `GET /notes/:id` com `expectedTotal`/`confirmedTotal`/`items[].missingQty`, e o
  relatório com `missingItems`/`exceededScans`/`unidentifiedScans`.
- `CORS` já liberado para `FRONTEND_ORIGIN` (default `http://localhost:5174`) com
  `credentials: true`.
