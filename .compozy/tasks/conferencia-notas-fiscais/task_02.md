---
status: completed
title: Backend — serviço de conferência
type: backend
complexity: high
---

# Task 2: Backend — serviço de conferência

## Overview

Implementa o serviço `backend` inteiro — o primeiro bounded context do repositório —
cobrindo autenticação por papel, a integração com a API interna da Cacau Show, e todo o
domínio de notas/itens/eventos de bipagem que é a fonte de verdade do sistema. É a
maior fatia vertical do produto: sem ela, não existe API para o frontend consumir nem
dado para conferir.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST scaffold `backend/` as an npm workspace member (extend root `package.json` workspaces with `"backend"`), with `package.json`, `tsconfig.json` (`strict: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`), `vitest.config.js`, depending on `shared` via the workspace reference (`"shared": "*"`).
- MUST follow `nestjs-ddd-backend-conventions` layering: `domain` / `application/usecase` / `infra` (`controller`, `repository`, `gateway`, `database`, `module`), one class per file, a port's interface declared in the same file as its primary adapter, dependency injection via provider tokens (`@Inject("XxxRepository")`), `Input`/`Output` plain types per use case, a single global `@Catch(Error)` filter mapping domain errors to HTTP 422.
- MUST use Drizzle ORM per `drizzle-orm-conventions` (and its `schema-and-types.md`, `migrations-and-config.md`, `relations-and-queries.md` references) for schema definition, `drizzle-kit generate`+`migrate` migrations, and `db.transaction` wherever a read informs a write in the same operation (the allocation path in particular).
- MUST implement the `users`, `invoice_notes`, `note_items`, `scan_events` tables exactly as specified in `_techspec.md` (Data Models): plain `pgTable` (no schema namespace — `ccca` has been explicitly removed from this project), enums `user_role`/`note_status`/`scan_result`, and the listed indexes.
- MUST implement `NfeGateway`/`NfeGatewayHttp` (`backend/src/infra/gateway/NfeGateway.ts`) calling `GET http://hybrisreports.cacaushow.com.br/ConsultaNotaFiscal/GerarXML?empresa=<EMPRESA_CODE>&documento=<invoiceNumber>` via `axios`, parsing the raw XML response with `fast-xml-parser`, and throwing `NfeNotFoundError` (no recognizable `nfeProc` structure) or `NfeServiceUnavailableError` (network error/timeout/5xx).
- MUST read `EMPRESA_CODE` from an environment variable — never hardcode the company code.
- MUST implement `SearchNote`, `ApplyScanEvent`, `FinalizeNote`, `SyncScanEvents` use cases exactly per `_techspec.md` (Core Interfaces), including: idempotency by `client_event_id` in `ApplyScanEvent`/`SyncScanEvents`; automatic note completion when the last unit of the last item is confirmed; the `FinalizeNote` rule that claims any unclaimed `unidentified` scan events (`note_id IS NULL`) into the note being finalized.
- MUST implement `AuthModule` with JWT (`@nestjs/passport` + `@nestjs/jwt`), 8h expiry, delivered as an `httpOnly`, `Secure`, `SameSite=Lax` cookie, plus `AuthGuard` and `RoleGuard` enforcing `operador`/`gerente` per route, per ADR-009.
- MUST implement every endpoint in `_techspec.md`'s API Endpoints table with the exact documented status codes (`201`/`200`/`204`/`400`/`401`/`403`/`404`/`409`/`422`/`502`).
- MUST register a dev `docker-compose.yaml` with `backend` + `postgres` services per `new-bounded-context-scaffold`.
- MUST NOT introduce a Postgres schema namespace (`ccca` or otherwise) — use the default `public` schema.
- MUST NOT call another bounded context's source directly — this is the only backend service in the repo today, but keep the `gateway`/`queue` boundary discipline for the one external integration (`NfeGateway`).
</requirements>

## Subtasks
- [x] 2.1 Scaffold `backend/` (package.json, tsconfig, vitest config, Nest CLI baseline), extend root workspaces, depend on `shared`.
- [x] 2.2 Define the Drizzle schema (`users`, `invoice_notes`, `note_items`, `scan_events`) and generate the initial migration.
- [x] 2.3 Implement `AuthModule`: users repository, password hashing, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `AuthGuard`, `RoleGuard`.
- [x] 2.4 Implement `NfeGateway`/`NfeGatewayHttp` with XML parsing and error mapping, using `004005647.xml` as the parsing fixture.
- [x] 2.5 Implement `SearchNote` use case + `POST /notes`, `GET /notes`, `GET /notes/:id`.
- [x] 2.6 Implement `ApplyScanEvent` use case (wiring `shared.resolveScan`, manual match, unidentified, exceeded paths) + `POST /scan-events`.
- [x] 2.7 Implement `FinalizeNote` use case (pending-confirmation flow, unidentified-event claiming) + `POST /notes/:id/finalize`, `GET /notes/:id/report`.
- [x] 2.8 Implement `SyncScanEvents` use case + `POST /scan-events/sync`.
- [x] 2.9 Implement `GET /notes/history` (gerente-only).
- [x] 2.10 Wire the global exception filter (domain `Error` → 422) and register it in `main.ts`; fix the service to listen on port 3001 per `CLAUDE.md`.
- [x] 2.11 Write `docker-compose.yaml` (dev) registering `backend` + `postgres`.
- [x] 2.12 Write all assigned unit and integration tests.

## Implementation Details

Reference `_techspec.md` in full for this task: Core Interfaces (all four use-case code
blocks plus `NfeGateway`), Data Models (complete schema), API Endpoints table, and
Integration Points (exact URL, error mapping, `EMPRESA_CODE`). Reference
`nestjs-ddd-backend-conventions` for the precise layering/DI/controller/filter patterns
and `drizzle-orm-conventions` for schema/migration/transaction patterns — in particular
the "read-then-write inside the same `db.transaction`" guidance for the allocation path
in `ApplyScanEvent` and `SyncScanEvents`.

### Relevant Files
- `.compozy/tasks/conferencia-notas-fiscais/_techspec.md` — primary source for every interface, schema table, and endpoint this task implements.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-002.md` — `cProd`-first matching rationale (feeds `NfeGateway`'s parsed item shape).
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-005.md` — número de faturamento search, no QR code (`POST /notes` contract).
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-007.md` — event log + denormalized counter pattern for `scan_events`/`note_items`.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-009.md` — 8h JWT cookie session model.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-010.md` — single-device sync assumption (`SyncScanEvents` simplification).
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-011.md` — `EMPRESA_CODE` as env var, deploy topology context.
- `004005647.xml` (repo root) — canonical fixture for `NfeGatewayHttp` parsing tests (UT-011, IT-001, IT-018).
- `.claude/skills/nestjs-ddd-backend-conventions/SKILL.md` — layering, DI, controller/filter conventions.
- `.claude/skills/drizzle-orm-conventions/SKILL.md` + `references/schema-and-types.md`, `references/migrations-and-config.md`, `references/relations-and-queries.md` — schema/migration/transaction patterns.
- `.claude/skills/new-bounded-context-scaffold/SKILL.md` — scaffold steps for a brand-new `backend-*`-style service (docker-compose registration in particular; the create-database-script step has been removed from this skill and does not apply).
- `.claude/skills/vitest-testing/SKILL.md` — unit/integration test conventions, including the "no Supertest, hit the real HTTP server via `fetch`" rule for integration tests.
- `.claude/skills/nodejs-typescript-conventions/SKILL.md` — TypeScript conventions.
- `CLAUDE.md` (repo root) — fixes the backend dev port at 3001, expected by the future `playwright.config.ts` (Task 4).

### Dependent Files
- Root `package.json` — extend `workspaces` with `"backend"`.
- `shared` package (Task 1) — consumed read-only via `resolveScan` and its types; not modified.

### Related ADRs
- [ADR-002: Identificação de item por código de produto interno (cProd)](adrs/adr-002.md)
- [ADR-005: Busca de nota por número de faturamento via API interna Cacau Show, sem QR code](adrs/adr-005.md)
- [ADR-007: Log de eventos de bipagem append-only com contadores denormalizados](adrs/adr-007.md)
- [ADR-009: Sessão de autenticação curta (8h) via JWT em cookie httpOnly](adrs/adr-009.md)
- [ADR-010: Sincronização offline assume um único dispositivo ativo por loja](adrs/adr-010.md)
- [ADR-011: Deploy em VPS próprio via Docker Compose com reverse proxy TLS](adrs/adr-011.md)

## Deliverables
- `backend` service runnable via its workspace start script, listening on port 3001.
- Drizzle schema + initial migration applied.
- All API endpoints from `_techspec.md` implemented with documented status codes.
- Dev `docker-compose.yaml` with `backend` + `postgres`.
- UT-011–UT-043 and IT-001–IT-028 implemented and passing.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-011–UT-014 — `NfeGatewayHttp` parsing and error mapping.
- [x] UT-015–UT-018 — `SearchNote` use case (happy path, duplicate, gateway errors).
- [x] UT-019–UT-027 — `ApplyScanEvent` use case (matched, auto-complete, idempotency, exceeded, manual match, unidentified, zero-open-notes error).
- [x] UT-028–UT-032 — `FinalizeNote` use case (already complete, pending without confirm, pending with confirm, unidentified-claim, idempotent re-finalize).
- [x] UT-033–UT-036 — `SyncScanEvents` use case (batch apply, idempotent duplicates, ordering, empty batch).
- [x] UT-037–UT-043 — Auth module and guards (login success/failure, token expiry, role enforcement).
- [x] IT-001–IT-004 — `POST /notes` lifecycle (create, duplicate, not-found, gateway-unavailable).
- [x] IT-005–IT-006 — `POST /scan-events` progress and auto-completion via HTTP.
- [x] IT-007–IT-008 — `POST /notes/:id/finalize` and `GET /notes/:id/report`.
- [x] IT-009 — multi-note allocation reference scenario end-to-end via HTTP.
- [x] IT-010–IT-011 — `POST /scan-events/sync` batch apply and idempotent replay.
- [x] IT-012–IT-015, IT-023–IT-024 — auth/session/role endpoints.
- [x] IT-016–IT-017, IT-022 — history and report endpoints, including scale.
- [x] IT-018 — `NfeGatewayHttp` integration against a local fixture server.
- [x] IT-019–IT-021 — unidentified-event claiming, 10+ concurrent open notes, finalize-then-reallocate.
- [x] IT-025–IT-028 — `GET /notes`, `GET /notes/:id` (success/404), `POST /scan-events` payload validation.

## Success Criteria
- Every assigned test case implemented and passing
- `POST /notes` against the real `004005647.xml` fixture returns items matching that XML exactly
- The ADR-001 reference multi-note scenario (10 panetones + 1 trufa) is reproducible end-to-end via the HTTP API (IT-009)
- No Postgres schema namespace introduced; all tables live in the default `public` schema
