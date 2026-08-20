---
status: completed
title: "Integration & E2E: full drawer navigation flow"
type: test
complexity: medium
---

# Task 3: Integration & E2E: full drawer navigation flow

## Overview

Close the loop once routing (task_01) and the drawer itself (task_02) are both in place: verify real navigation through the app via the drawer, add the Playwright critical-path journey for the new feature, and — a gap discovered during task planning, not originally in the TechSpec — fix four already-shipped E2E specs that assert the logout button is directly visible on-screen, which silently breaks the moment logout moves into the drawer.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST verify, via a component/integration test rendering a representative slice of the real app routes in a `MemoryRouter`, that tapping a nav item in the drawer actually navigates and closes the drawer (IT-008).
- MUST verify, via a component/integration test, that a `popstate`-triggered back navigation while the drawer is open does not leave inconsistent DOM (IT-010 is assigned to task_02, but IT-008 in this task exercises the same real-routes wiring — read both before starting to avoid duplicating fixtures).
- MUST add a shared `logout(page)` helper to `e2e/support/fixtures.ts` that opens the drawer via its trigger and taps the drawer's logout control (replacing the current direct `page.getByRole("button", { name: "Sair" })` query pattern).
- MUST update `e2e/specs/gestao-usuarios-e2e-001-cadastro.spec.ts`, `-002-desativacao.spec.ts`, `-003-reset-senha.spec.ts` to use the new `logout(page)` helper at their existing account-switch step, with no other change to their assertions or journey.
- MUST update `e2e/specs/gestao-usuarios-e2e-004-logout.spec.ts` — the dedicated logout journey — to open the drawer before asserting the logout button, then verify the rest of its journey (redirect to login, protected route inaccessible) unchanged.
- MUST write a new Playwright E2E case (E2E-001 in `_tests.md`) covering: admin logs in → opens the drawer → sees name, role label, and all three nav items → taps "Histórico" → lands on the Histórico screen with the drawer closed → reopens the drawer → taps logout → lands on the login screen and cannot reach `/usuarios` by navigating back.
- MUST NOT modify the assertions or arrange/act structure of the four existing specs beyond the logout-step change described above — they remain regression coverage for their original features (gestão de usuários), not this feature.
</requirements>

## Subtasks
- [x] 3.1 Write IT-008: render a representative slice of real app routes in a `MemoryRouter` as an admin session, open the drawer, tap "Histórico", assert the rendered route changes and the drawer closes.
- [x] 3.2 Write IT-010 (if not already covered by task_02's own IT-010 case — confirm with task_02's test file before duplicating): `popstate` while the drawer is open leaves no orphaned dialog node.
- [x] 3.3 Add `logout(page)` to `e2e/support/fixtures.ts`, opening the drawer trigger then tapping the drawer's logout control.
- [x] 3.4 Update the three incidental `page.getByRole("button", { name: "Sair" }).click()` call sites (`-001-cadastro`, `-002-desativacao`, `-003-reset-senha`) to use `logout(page)`.
- [x] 3.5 Update `-004-logout.spec.ts`'s visibility assertion and click to go through the drawer, keeping its final assertions (redirect to login, protected route inaccessible, no "sessão expirou" message) unchanged.
- [x] 3.6 Write the new E2E-001 spec for the drawer's own critical path (open → navigate → logout).
- [x] 3.7 Run the full Playwright suite locally (`npm run e2e:db:up`, `npm run test:e2e`) to confirm no other spec silently depends on the old on-screen logout button.

## Implementation Details

See TechSpec `## Testing Approach` for the overall test-level split, and the amended `## Impact Analysis` and `## Technical Considerations — Known Risks` rows covering the four existing E2E specs — added during this feature's planning specifically because this gap was not visible from the TechSpec's original component-level analysis.

The existing `-004-logout.spec.ts` journey, for reference (its `Sair` query is what changes; everything after stays the same):
```ts
await loginAs(page, account.credentials);
await expect(page.getByRole("heading", { name: account.home })).toBeVisible();
const logout = page.getByRole("button", { name: "Sair" }); // → becomes: open drawer, then find "Sair" inside it
await logout.click();
await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
```

### Relevant Files
- `e2e/support/fixtures.ts` — `loginAs(page, credentials)` already exists as the login counterpart; add `logout(page)` alongside it. Also exports `ADMIN`, `OPERADOR`, `GERENTE` credentials (`{ email, password }`) needed for E2E-001.
- `e2e/specs/gestao-usuarios-e2e-004-logout.spec.ts` — dedicated logout journey for operador and gerente; deepest rework (asserts on-screen visibility of "Sair" before clicking).
- `e2e/specs/gestao-usuarios-e2e-001-cadastro.spec.ts` (line ~43), `-002-desativacao.spec.ts` (line ~27), `-003-reset-senha.spec.ts` (line ~21) — incidental `Sair` click as an account-switch step mid-journey.
- `e2e/specs/e2e-001-bipagem-completa.spec.ts` through `-005-falha-de-busca.spec.ts`, `e2e-006-007-gerente.spec.ts` — confirmed via repo-wide search to NOT reference "Sair"; no changes expected, but Subtask 3.7's full-suite run is what confirms it.
- `playwright.config.ts` — E2E suite topology (backend :3001, frontend :5174, dedicated Postgres) per `CLAUDE.md`; no changes needed, just context for running the suite.
- `frontend/src/components/ui/NavDrawer.tsx`, `frontend/src/components/ui/Screen.tsx` (from task_02) — the real components this task's tests exercise; not modified here.
- `frontend/src/App.tsx`, `frontend/src/routes/navigation.ts` (from task_01) — the real routing this task's IT-008 exercises; not modified here.

### Dependent Files
- `e2e/specs/gestao-usuarios-e2e-001-cadastro.spec.ts`, `-002-desativacao.spec.ts`, `-003-reset-senha.spec.ts`, `-004-logout.spec.ts` — all four are edited by this task.
- `e2e/support/fixtures.ts` — gains the `logout(page)` export.

### Related ADRs
- [ADR-001: Global overlay navigation drawer, triggered from every authenticated screen](adrs/adr-001.md) — the journey E2E-001 exercises end to end.
- [ADR-002: Consolidate logout into the navigation drawer, removed from per-screen headers](adrs/adr-002.md) — the direct cause of the four existing specs' breakage this task fixes.

## Deliverables
- `IT-008` (and `IT-010` if not already satisfied by task_02) implemented against real app routing.
- `logout(page)` helper in `e2e/support/fixtures.ts`.
- Four existing E2E specs updated to use it, with their original assertions otherwise intact.
- New `E2E-001` Playwright spec for the drawer's open → navigate → logout journey.
- Full Playwright suite passing locally.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] IT-008 — drawer-driven navigation through real app routes (admin taps "Histórico", route changes, drawer closes)
- [x] E2E-001 — full critical path: login → open drawer → see identity + all nav items → navigate → logout → redirected, cannot reach `/usuarios` by back-navigation

## Success Criteria
- Every assigned test case implemented and passing
- `npm run test:e2e` passes in full, including the four updated existing specs and the new E2E-001 spec
- No remaining `page.getByRole("button", { name: "Sair" })` query anywhere in `e2e/specs` that assumes the button is directly on-screen without opening the drawer first
