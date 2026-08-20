---
status: completed
title: Sessão, roteamento e troca de senha obrigatória no frontend
type: frontend
complexity: medium
---

# Task 3: Sessão, roteamento e troca de senha obrigatória no frontend

## Overview

Traz o backend das tasks 1 e 2 para o frontend: tipos e client HTTP atualizados,
`SessionContext` ciente de `mustChangePassword`, bypass do admin em `RequireRole`,
o wrapper de redirecionamento obrigatório para a tela de troca de senha, e o botão
de logout visível — hoje ausente da interface apesar do mecanismo já existir. Task
4 (a tela de gestão de usuários) depende dos padrões de rota e do slot de header
estabelecidos aqui.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST widen `UserRole` in `api/types.ts` to `"operador" | "gerente" | "admin"` and add `mustChangePassword: boolean` to `SessionUser`.
- MUST add `api/client.ts` functions for `POST /auth/change-password` (and any other endpoint this task's screens need) following the existing one-function-per-call flat style — no client class, no new HTTP library.
- MUST modify `RequireRole` so `user.role === "admin"` renders the protected children regardless of the route's required `role`, mirroring the backend `RoleGuard` bypass (ADR-006) — do not require every route to list `"admin"` explicitly.
- MUST implement a redirect wrapper (rendered high in `App.tsx`'s route tree) that sends an authenticated user with `session.user.mustChangePassword === true` to `/trocar-senha` whenever the current location isn't already that route, and stops redirecting once the flag clears — reflects server state on every navigation, no client-side-only tracking (US-011).
- MUST implement `ChangePasswordScreen` (new, `features/auth/`): two password fields (new + confirmation), blocks submit when they don't match, calls the new `change-password` endpoint, and relies on the backend for the "equals initial password" and policy rejections (surface the returned error message, don't duplicate that validation client-side).
- MUST add a visible logout button/action reachable from every authenticated screen. Use the existing `header` slot on `components/ui/Screen.tsx` — do not change `Screen`'s public API, and do not build a new persistent nav shell (out of scope per the PRD, which explicitly leaves that structural decision to implementation but only requires visibility/reachability).
- MUST follow `DESIGN.md` for every new UI element (chocolate/creme palette, `rounded-pill`/`rounded-card` tokens, Caprasimo/Figtree typography via the existing Tailwind `@theme` utilities) — no hardcoded hex values.
- MUST follow the existing frontend convention of plain `useState` forms with manual validation in the submit handler (no react-hook-form, no zod — neither is a dependency in this project).
- MUST NOT touch `features/users/*` or the `/usuarios` route — that is task_04's scope.
</requirements>

## Subtasks

- [x] 3.1 Widen `UserRole`/`SessionUser` in `api/types.ts`; add `change-password` (and related) functions to `api/client.ts`.
- [x] 3.2 Update `SessionContext` to carry `mustChangePassword` from `login`/`me` responses.
- [x] 3.3 Add the admin bypass to `RequireRole`.
- [x] 3.4 Implement the pending-password-change redirect wrapper and wire it into `App.tsx`'s route tree.
- [x] 3.5 Implement `ChangePasswordScreen` and its route.
- [x] 3.6 Implement the logout button and slot it into every existing `Screen` usage's `header`.
- [x] 3.7 Implement every unit test and the E2E test assigned below.

## Implementation Details

Reference `_techspec.md` "Data Flow" step 5 and "Data Models" (frontend types) for
exact shapes — do not re-derive them here.

### Relevant Files

- `frontend/src/api/types.ts:1-122` — `UserRole`, `SessionUser`, new request/response types.
- `frontend/src/api/client.ts:1-114` — flat-function pattern to follow for the new `changePassword` call.
- `frontend/src/session/SessionContext.tsx:1-94` — `useSession()`, `signOut` (already implemented), needs `mustChangePassword` threaded through.
- `frontend/src/routes/RequireRole.tsx:1-26` — exact-match role check to widen with the admin bypass.
- `frontend/src/App.tsx:1-58` — route definitions, role-based default landing route (needs an `admin` case), and where the new redirect wrapper and `/trocar-senha` route are registered.
- `frontend/src/components/ui/Screen.tsx:1-30` — `header` prop slot to reuse for the logout button; do not change its signature.
- `frontend/src/features/auth/LoginScreen.tsx:1-73` — closest existing pattern for a plain-`useState` auth-adjacent form (`FIELD` className constant, `PillButton`, `Banner`).
- `frontend/src/components/ui/{PillButton,Banner}.tsx` — reused by `ChangePasswordScreen` and the logout button.
- `DESIGN.md` (repo root) — mandatory design rules for every new element.
- `frontend/src/session/SessionContext.test.tsx` — existing test pattern to extend/mirror.

### Dependent Files

- `frontend/src/features/history/HistoryScreen.tsx`, `frontend/src/features/report/ReportScreen.tsx`, `frontend/src/features/scan/ScanScreen.tsx`, `frontend/src/features/notes/NotesQueueScreen.tsx` — each needs the new logout button slotted into its `Screen.header` usage.
- `frontend/src/routes/ScanRoute.tsx`, `frontend/src/routes/ReportRoute.tsx` — existing `RequireRole` consumers; verify they keep working once the bypass is added (no code change expected, behavior-only).

### Related ADRs

- [ADR-002: Senha inicial previsível com troca obrigatória no primeiro login](adrs/adr-002.md) — `ChangePasswordScreen` and the redirect wrapper.
- [ADR-006: Bypass automático do admin nos guards de papel](adrs/adr-006.md) — `RequireRole` change.

## Deliverables

- `api/types.ts`/`api/client.ts` updated for the new fields/endpoint.
- `SessionContext` exposing `mustChangePassword`.
- `RequireRole` with the admin bypass.
- Redirect wrapper enforcing the forced password change on every navigation.
- `ChangePasswordScreen` and its route.
- A visible, reachable logout action on every authenticated screen, following `DESIGN.md`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition
there before writing tests.

- [x] UT-041 — `RequireRole` admin bypass
- [x] UT-042, UT-043 — pending-password-change wrapper (redirects when pending, does not once resolved)
- [x] UT-049 — `ChangePasswordScreen` blocks submit on mismatched confirmation
- [x] E2E-004 — logout from any screen returns to login and invalidates the old session

## Success Criteria

- Every assigned test case implemented and passing
- A user with `mustChangePassword: true` cannot reach any screen other than the change-password screen (or logout), verified by the wrapper test and E2E-004's session invalidation check
- The logout action is visible on every existing authenticated screen without altering `Screen`'s public API
