---
status: completed
title: "Routing: shared route registry + App.tsx refactor"
type: frontend
complexity: medium
---

# Task 1: Routing: shared route registry + App.tsx refactor

## Overview

Introduce `frontend/src/routes/navigation.ts` as the single source of truth for the app's three top-level features (path, label, required role), and refactor `App.tsx` to read from it instead of the role literals currently duplicated across each `<Route>` and the post-login home redirect. This unblocks task_02, whose `NavDrawer` component needs the same role→items mapping the drawer will render.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `frontend/src/routes/navigation.ts` exporting `NAV_ROUTES: readonly NavRouteItem[]` (`{ path, label, role }` for `/notas`→operador "Fila de notas", `/historico`→gerente "Histórico", `/usuarios`→admin "Gestão de usuários", in that fixed order), `getNavItemsForRole(role): readonly NavRouteItem[]`, and `getHomePathForRole(role): string`.
- MUST make `getNavItemsForRole("admin")` return all three items (admin's existing all-access bypass, per `RequireRole`'s ADR-006 comment); other roles get only their own matching item.
- MUST NOT include sub-flow routes (`/notas/:noteId/bipagem`, `/notas/:noteId/relatorio`) or the change-password route in `NAV_ROUTES` — they are not top-level navigation destinations (PRD ADR-003).
- MUST refactor `App.tsx`'s three `<RequireRole role="...">` call sites (`/notas`, `/historico`, `/usuarios`) to read the role from `navigation.ts` instead of the inline string literal.
- MUST refactor `App.tsx`'s home-redirect calculation (`user.role === "operador" ? "/notas" : ...`) to use `getHomePathForRole(user.role)`.
- MUST NOT change `RequireRole.tsx`'s own logic (its `role` prop and admin-bypass check stay as-is) — only what `App.tsx` passes into it changes.
- MUST NOT change any actual role-to-route access behavior — this is a refactor of where values come from, not what they are; existing `RequireRole.test.tsx` assertions MUST keep passing unchanged.
</requirements>

## Subtasks
- [x] 1.1 Create `NavRouteItem` type and the `NAV_ROUTES` constant in `frontend/src/routes/navigation.ts`.
- [x] 1.2 Implement `getNavItemsForRole(role)`, special-casing admin to return all items.
- [x] 1.3 Implement `getHomePathForRole(role)`.
- [x] 1.4 Replace the three `<RequireRole role="...">` literals in `App.tsx` with reads from `navigation.ts`.
- [x] 1.5 Replace the home-redirect ternary in `App.tsx` with `getHomePathForRole(user.role)`.
- [x] 1.6 Verify `RequireRole.test.tsx` still passes unchanged after the refactor (no test edits expected — it exercises `RequireRole` directly, not `App.tsx`).
- [x] 1.7 Write unit tests for `navigation.ts` (UT-001–UT-004).
- [x] 1.8 Write/extend integration tests exercising `App.tsx`'s routing and home-redirect through the refactored registry (IT-006, IT-007).

## Implementation Details

See TechSpec `## Implementation Design — Core Interfaces` for the exact `navigation.ts` shape, and `## System Architecture — Component Overview` for how `App.tsx`, `RequireRole`, and (later, in task_02) `NavDrawer` all read from this one module. See TechSpec `## Technical Considerations — Known Risks` for the regression-risk mitigation this task must satisfy (values don't change, only their source).

### Relevant Files
- `frontend/src/App.tsx` — the three `<RequireRole role="...">` call sites and the `home` ternary to refactor; also has an early-return `<Screen title="Conferência de notas">{null}</Screen>` for `status === "loading"` and renders `<LoginScreen />` when `user === null`, both unaffected by this task.
- `frontend/src/routes/RequireRole.tsx` — receives the `role` prop this task changes the source of; its own admin-bypass logic (comment references its own prior "ADR-006", unrelated to this feature's ADR numbering) is unchanged.
- `frontend/src/api/types.ts` — `UserRole = "operador" | "gerente" | "admin"`, the type `NavRouteItem.role` and both new functions are built on.

### Dependent Files
- `frontend/src/routes/RequireRole.test.tsx` — existing coverage (admin-bypass, gerente-blocked-from-operador-route) must keep passing unchanged; it renders `RequireRole` directly via `withSession()`, not through `App.tsx`, so it is unaffected by the refactor itself but is the regression signal to watch.
- `frontend/src/test/session.tsx` — exports `withSession()` and the `OPERADOR` fixture used by routing tests; may need inline `gerente`/`admin` overrides for IT-006/IT-007 (existing pattern, see `RequireRole.test.tsx`'s inline overrides — no fixture file changes required).

### Related ADRs
- [ADR-005: Extract a single shared route/role registry consumed by routing and the navigation drawer](adrs/adr-005.md) — this task is ADR-005's entire implementation.
- [ADR-003: Drawer navigation list is scoped to top-level features by role, excluding account-action routes](adrs/adr-003.md) — defines which three routes belong in `NAV_ROUTES` and why sub-flow/account routes are excluded.

## Deliverables
- `frontend/src/routes/navigation.ts` with `NAV_ROUTES`, `getNavItemsForRole`, `getHomePathForRole`.
- `App.tsx` refactored to source role literals and the home path from `navigation.ts`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002, UT-003 — `getNavItemsForRole` for operador/gerente/admin
- [x] UT-004 — `getHomePathForRole` for all three roles (boundary case)
- [x] IT-006 — role-gating on `/usuarios`, `/notas`, `/historico` unchanged after refactor (regression)
- [x] IT-007 — home redirect (`/`) resolves correctly per role via `getHomePathForRole`

## Success Criteria
- Every assigned test case implemented and passing
- `navigation.ts` is the only place `NAV_ROUTES`-shaped data is defined; `App.tsx` contains no remaining inline role-literal strings on its `<RequireRole>` call sites or in the home-redirect calculation
- `RequireRole.test.tsx` passes without modification
