---
status: completed
title: Suíte E2E
type: test
complexity: medium
---

# Task 4: Suíte E2E

## Overview

Adiciona a configuração raiz do Playwright (já assumida pelo `CLAUDE.md` mas ainda
inexistente) e implementa as 7 jornadas ponta a ponta do catálogo de user stories,
exercitando `backend` e `frontend` juntos exatamente como um operador ou gerente
usaria o produto.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create the root `playwright.config.ts` with a `webServer` array starting `backend` (`PORT=3001`) and `frontend` (`VITE_API_URL=http://localhost:3001`, port `5174`) in parallel, exactly as already documented in `CLAUDE.md`.
- MUST add root `package.json` scripts `test:e2e` and `test:e2e:ui`.
- MUST implement E2E-001 through E2E-007 exactly as scoped in `_tests.md` (End-to-End Tests section).
- MUST use Playwright's `context.setOffline(true)`/`(false)` to simulate connectivity loss/restore for the offline journey (E2E-004).
- MUST seed deterministic test data for each run: at least one `operador` account, one `gerente` account, and a way to make `NfeGateway` resolve against local fixture XML (derived from `004005647.xml`) instead of the real `hybrisreports.cacaushow.com.br` endpoint, so the suite never depends on network access to the live Cacau Show API.
- SHOULD keep one Playwright `test()` per E2E ID (or a tightly-related small group sharing setup), matching the "Bipagem sem correspondência", "Operação offline", etc. groupings already used in `_tests.md`.
</requirements>

## Subtasks
- [x] 4.1 Create root `playwright.config.ts` (webServer for backend+frontend, base URL, chromium project) matching the ports and env vars already documented in `CLAUDE.md`.
- [x] 4.2 Add root `package.json` scripts `test:e2e`/`test:e2e:ui` and the `playwright` devDependency.
- [x] 4.3 Build E2E fixtures/seed helpers: test users (operador/gerente), and a mechanism to point the backend's `NfeGateway` at local fixture data for the test run.
- [x] 4.4 Implement E2E-001 (single-note happy path: login → busca → bipagem completa → relatório sem pendências).
- [x] 4.5 Implement E2E-002 (multi-note trufa scenario → nota 2 completa → finaliza nota 1 incompleta → relatório correto).
- [x] 4.6 Implement E2E-003 (bipagem sem correspondência → seleção manual → caixa não identificada).
- [x] 4.7 Implement E2E-004 (bipagem offline → reconexão → sincronização automática).
- [x] 4.8 Implement E2E-005 (busca com número inexistente → mensagem de erro → nova tentativa bem-sucedida).
- [x] 4.9 Implement E2E-006 (gerente: histórico → relatório de nota específica) and E2E-007 (gerente: acesso negado à bipagem).

## Implementation Details

Reference `_techspec.md` → Testing Approach (E2E bullet) for the intended journey list
and `_tests.md` → End-to-End Tests for the exact scope of each of the 7 cases.
`CLAUDE.md` already documents the expected `webServer` shape (ports/env) this config
must match — do not invent a different port scheme.

### Relevant Files
- `.compozy/tasks/conferencia-notas-fiscais/_tests.md` — End-to-End Tests section has the exact scope of each E2E-NNN case.
- `.compozy/tasks/conferencia-notas-fiscais/_techspec.md` — Testing Approach section, ADR-001 reference scenario reused in E2E-002.
- `CLAUDE.md` (repo root) — canonical Playwright ports/env: backend `3001`, frontend `5174`, `VITE_API_URL`.
- `backend/` (Task 2 output) — consumed as a running service; not modified by this task.
- `frontend/` (Task 3 output) — consumed as a running service; not modified by this task.

### Dependent Files
- Root `package.json` — add `test:e2e`/`test:e2e:ui` scripts and the `playwright` devDependency.

## Deliverables
- Root `playwright.config.ts` matching `CLAUDE.md`'s documented setup.
- 7 E2E specs implemented and passing.
- `npm run test:e2e` green without depending on network access to the real Cacau Show API.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] E2E-001 — busca e bipagem completa de uma nota.
- [x] E2E-002 — conferência multi-nota com alocação automática (cenário de referência da trufa).
- [x] E2E-003 — bipagem sem correspondência → seleção manual → não identificada.
- [x] E2E-004 — operação offline → reconexão → sincronização.
- [x] E2E-005 — falha de busca → nova tentativa bem-sucedida.
- [x] E2E-006 — histórico e relatório gerencial.
- [x] E2E-007 — acesso negado à bipagem para o papel gerente.

## Success Criteria
- Every assigned test case implemented and passing
- The suite runs headlessly end-to-end via `npm run test:e2e` without any dependency on the live `hybrisreports.cacaushow.com.br` endpoint
