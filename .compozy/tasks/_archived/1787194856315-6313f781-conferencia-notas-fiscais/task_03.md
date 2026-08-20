---
status: completed
title: Frontend — PWA de conferência
type: frontend
complexity: high
---

# Task 3: Frontend — PWA de conferência

## Overview

Implementa o PWA `frontend` inteiro: a experiência do operador (busca de nota, fila
multi-nota, bipagem por câmera com feedback imediato, relatório) e a visão do
gerente/dono (histórico), seguindo o sistema visual `DESIGN.md` e operando offline
depois que uma nota é carregada. Reaproveita `resolveScan` do pacote `shared` para dar
feedback local instantâneo tanto online quanto offline.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST scaffold `frontend/` (Vite + React + TypeScript + Tailwind) as an npm workspace member (extend root `package.json` workspaces with `"frontend"`), depending on `shared` via workspace reference.
- MUST follow `react-frontend-conventions`: functional components only, explicit typed props (no prop-spreading onto shared primitives), state colocated near its consumers, Context only for genuinely cross-cutting state, `use`-prefixed custom hooks, Tailwind utility classes only, automated tests for every user-facing component.
- MUST apply `DESIGN.md`'s exact tokens (colors, radii, typography scale, shadows) — read `DESIGN.md` in full before building any screen, per the project's root `CLAUDE.md` instruction.
- MUST implement `useBarcodeScanner` using an open-source WASM-based library (ZXing-wasm) per ADR-008, with frame debounce and rejection of low-confidence/partial decodes.
- MUST implement `useOfflineQueue` persisting scan events to IndexedDB while offline and flushing them to `POST /scan-events/sync` automatically on reconnect, per ADR-003/ADR-007/ADR-010; queued events carry a client-generated `clientEventId` for idempotency.
- MUST implement, at minimum, these screens/flows: login; `NoteSearchForm` (número de faturamento only — no QR code, per ADR-005); the open-notes queue; `ScanScreen` (live per-item progress counter, "quantidade já atingida" warning, manual-item-selection fallback, finalize-incomplete confirmation dialog); `ReportScreen` (missing / exceeded / unidentified sections); `HistoryScreen` (gerente-only, with an empty state).
- MUST configure `vite-plugin-pwa` for an installable manifest and app-shell offline caching (the app shell and static assets must load even without connectivity; API calls remain network-dependent except for the offline-queued scan flow).
- MUST call `resolveScan` from `shared` on every scan (online and offline) for the immediate UI update, independent of the server round-trip that confirms/persists it.
- MUST run on the Vite dev server, port 5174, reading `VITE_API_URL` for the backend base URL, per `CLAUDE.md`.
- MUST NOT implement any QR-code scanning for note entry — that flow was explicitly withdrawn (US-002, ADR-005). Camera access in this app is used exclusively for box barcode scanning.
</requirements>

## Subtasks
- [x] 3.1 Scaffold `frontend/` (Vite+React+TS+Tailwind), extend root workspaces, depend on `shared`.
- [x] 3.2 Translate `DESIGN.md` tokens into the Tailwind theme/CSS variables and build shared UI primitives (pill buttons, cards, pill progress bar, Caprasimo counter).
- [x] 3.3 Implement auth screens and session handling (`GET /auth/me`, cookie-based, role-aware routing between operador/gerente views).
- [x] 3.4 Implement `NoteSearchForm` (valid/invalid/empty input, 404/502 messaging, offline-blocked state).
- [x] 3.5 Implement the open-notes queue view showing per-note progress.
- [x] 3.6 Implement `useBarcodeScanner` (ZXing-wasm, debounce, low-confidence rejection).
- [x] 3.7 Implement `ScanScreen` (live progress, exceeded warning, manual-match modal, finalize-confirmation dialog).
- [x] 3.8 Implement `useOfflineQueue` (IndexedDB persistence, automatic sync flush, offline-created finalize actions).
- [x] 3.9 Configure `vite-plugin-pwa` (manifest, service worker, installability, app-shell caching).
- [x] 3.10 Implement `ReportScreen` (missing/exceeded/unidentified sections, "tudo certo" confirmation state).
- [x] 3.11 Implement `HistoryScreen` (gerente-only list + empty state).
- [x] 3.12 Write all assigned unit/component tests.

## Implementation Details

Reference `_techspec.md` → System Architecture (Data Flow steps 2-4) for how scanning,
offline queueing, and sync interact; Core Interfaces for the exact `resolveScan`
signature to import from `shared`; and Technical Considerations → Key Decisions for the
ADR-driven constraints (WASM scanner, single-device offline sync, no QR). Read
`DESIGN.md` in full before building any screen — this is a hard project rule, not just
a suggestion.

### Relevant Files
- `.compozy/tasks/conferencia-notas-fiscais/_techspec.md` — Data Flow, Core Interfaces, API Endpoints (consumed contract), Key Decisions.
- `DESIGN.md` (repo root) — full visual token set (colors, radii, typography, shadows) that every screen must follow.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-003.md` — offline-first requirement driving `useOfflineQueue`.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-005.md` — número de faturamento only, no QR code.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-006.md` — why `resolveScan` is imported from `shared` rather than reimplemented.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-008.md` — WASM-based open-source scanner choice and rationale.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-009.md` — session model (cookie-based, no client-side token handling).
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-010.md` — single-device offline sync assumption (simplifies `useOfflineQueue`, no conflict-resolution UI needed).
- `.claude/skills/react-frontend-conventions/SKILL.md` — component/hook/state conventions.
- `.claude/skills/vitest-testing/SKILL.md` — component/hook test conventions.
- `.claude/skills/nodejs-typescript-conventions/SKILL.md` — TypeScript conventions.
- `CLAUDE.md` (repo root) — fixes the frontend dev port at 5174 and `VITE_API_URL`, expected by the future `playwright.config.ts` (Task 4).

### Dependent Files
- Root `package.json` — extend `workspaces` with `"frontend"`.
- `shared` package (Task 1) — consumed read-only via `resolveScan` and its types; not modified.
- Consumes the `backend` API contract from Task 2 (no backend files modified).

### Related ADRs
- [ADR-003: Operação offline-first para bipagem, com sincronização posterior](adrs/adr-003.md)
- [ADR-005: Busca de nota por número de faturamento via API interna Cacau Show, sem QR code](adrs/adr-005.md)
- [ADR-006: Monorepo com pacote compartilhado para o motor de alocação](adrs/adr-006.md)
- [ADR-008: Leitura de código de barras via biblioteca open-source baseada em WASM](adrs/adr-008.md)
- [ADR-009: Sessão de autenticação curta (8h) via JWT em cookie httpOnly](adrs/adr-009.md)
- [ADR-010: Sincronização offline assume um único dispositivo ativo por loja](adrs/adr-010.md)

## Deliverables
- Installable PWA running on the Vite dev server, port 5174.
- All required screens/flows implemented and styled per `DESIGN.md`.
- Offline scanning and automatic sync functional.
- UT-044–UT-067 implemented and passing.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-044–UT-047 — `useBarcodeScanner` (decode success, permission denied, debounce, low-confidence rejection).
- [x] UT-048–UT-052 — `useOfflineQueue` (enqueue offline, flush on reconnect, dedupe retry, persistence across reload, offline finalize enqueued).
- [x] UT-053–UT-057 — `NoteSearchForm` (submit success, 404, 502, invalid input, offline-blocked).
- [x] UT-058–UT-062 — `ScanScreen` (live progress, exceeded warning, manual-selection offer, cancel manual selection, cancel finalize confirmation).
- [x] UT-063–UT-065 — `ReportScreen` (missing items, "tudo certo", exceeded listed separately).
- [x] UT-066–UT-067 — `HistoryScreen` (list, empty state).

## Success Criteria
- Every assigned test case implemented and passing
- The app is installable (valid manifest + registered service worker)
- Scanning gives immediate visual feedback (via `shared.resolveScan`) both online and with the network disabled in a test environment
