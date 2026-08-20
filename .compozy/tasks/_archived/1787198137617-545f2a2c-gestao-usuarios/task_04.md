---
status: completed
title: Tela de gestão de usuários (admin)
type: frontend
complexity: medium
---

# Task 4: Tela de gestão de usuários (admin)

## Overview

Entrega a tela nova, exclusiva do admin, para cadastrar, listar, editar,
desativar/reativar e resetar a senha de operadores/gerentes — o núcleo visível do
PRD. Depende da task_03 (rota protegida, `RequireRole` com bypass de admin, slot de
logout já estabelecido) e da task_02 (endpoints de `/users`).

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST add a `/usuarios` route in `App.tsx`, wrapped in `RequireRole role="admin"`, with no nav link visible to non-admin roles (US-012).
- MUST implement `UsersScreen` (`features/users/`) listing every user returned by `GET /users` as `Card`-per-row entries (matching the existing `HistoryScreen` list pattern — no table component exists in this project), showing name, role, and a visually distinct active/inactive indicator (US-005).
- MUST implement `UserFormDialog` (create and edit, reusing the existing `Dialog` bottom-sheet component) with fields name, birth date, CPF, e-mail, and a role selector offering only "operador"/"gerente" — `"admin"` MUST never appear as an option (US-003.AC-3, US-006.EC-1). CPF and e-mail fields MUST be disabled/absent in edit mode (not editable per PRD Core Features).
- MUST block create-form submission when a required field is empty (US-003.EC-1) or no role is selected (US-003.EC-2), and surface backend validation/conflict errors (invalid CPF, duplicate CPF/e-mail) via the existing `Banner` component.
- MUST implement deactivate/reactivate/reset-password actions per user row, each behind a confirmation step (`Dialog`), calling the corresponding task_02 endpoint and refreshing the list on success.
- MUST hide or disable the deactivate action on the admin's own row in the list (US-013) — this is a UX affordance only; the authoritative rejection already happens server-side in `DeactivateUser` (task_02).
- MUST follow `DESIGN.md` and the existing plain-`useState`-form convention, same as task_03 — no new dependency (no table library, no form library).
- MUST NOT modify `RequireRole`, `SessionContext`, or the logout button — those are task_03's scope; only add the new route and screen.
</requirements>

## Subtasks

- [x] 4.1 Add `api/client.ts` functions for the five `/users` endpoints (list, create, update, deactivate, reactivate, reset-password) and their request/response types in `api/types.ts`.
- [x] 4.2 Add the `/usuarios` route in `App.tsx`, wrapped in `RequireRole role="admin"`.
- [x] 4.3 Implement `UsersScreen` listing users as `Card` rows with a status indicator.
- [x] 4.4 Implement `UserFormDialog` for create, with field/role validation.
- [x] 4.5 Implement `UserFormDialog` edit mode (name/birth date/role only).
- [x] 4.6 Implement deactivate/reactivate/reset-password actions with confirmation dialogs.
- [x] 4.7 Disable/hide the deactivate action on the admin's own row.
- [x] 4.8 Implement every unit test and E2E test assigned below.

## Implementation Details

Reference `_techspec.md` "API Endpoints" for exact request/response shapes and
"Component Overview" for the `features/users/` layout — do not re-derive them here.

### Relevant Files

- `frontend/src/features/history/HistoryScreen.tsx` — closest existing list pattern (`Card`-per-row, `<ul>` stack, no table).
- `frontend/src/features/scan/FinalizeDialog.tsx`, `ManualItemDialog.tsx` — existing `Dialog`-based confirmation/form patterns to follow for `UserFormDialog` and the deactivate/reactivate/reset confirmations.
- `frontend/src/components/ui/{Card,Dialog,PillButton,Banner}.tsx` — components to reuse, no new primitives.
- `frontend/src/features/notes/NoteSearchForm.tsx:35-52` — plain-`useState` form validation pattern to follow.
- `frontend/src/api/types.ts`, `frontend/src/api/client.ts` — extend with the `/users` surface.
- `frontend/src/App.tsx` — add the `/usuarios` route (already imports `RequireRole`, `Routes`, `Route`).
- `frontend/src/routes/RequireRole.tsx` — consumed as-is (admin bypass delivered by task_03), not modified here.
- `DESIGN.md` (repo root) — mandatory design rules.

### Dependent Files

- `frontend/src/App.tsx` — touched by both task_03 (redirect wrapper, `/trocar-senha`) and this task (`/usuarios`); this task depends on task_03 landing first to avoid conflicting edits to the same route tree.

### Related ADRs

- [ADR-001: Papel admin único, provisionado fora da aplicação](adrs/adr-001.md) — role selector never offers `"admin"`.
- [ADR-003: Desativação em vez de exclusão de usuários](adrs/adr-003.md) — deactivate/reactivate UX.

## Deliverables

- `/usuarios` route, admin-only, no nav link for other roles.
- `UsersScreen` with list, create, edit, deactivate, reactivate, reset-password.
- `UserFormDialog` with role selector restricted to operador/gerente.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition
there before writing tests.

- [x] UT-044 — list renders distinguishable active/inactive status
- [x] UT-045 — create form blocks submit on empty required field
- [x] UT-046 — create form blocks submit with no role selected
- [x] UT-047 — role selector only offers operador/gerente
- [x] UT-048 — admin's own row has deactivate action disabled/absent
- [x] E2E-001 — cadastro → primeiro acesso → troca de senha → acesso normal
- [x] E2E-002 — desativação → login recusado → histórico preserva o nome
- [x] E2E-003 — reset de senha → login com senha inicial → troca obrigatória
- [x] E2E-005 — operador/gerente sem acesso à tela de gestão de usuários
- [x] E2E-006 — autodesativação do admin bloqueada
- [x] E2E-007 — admin navega por bipagem, histórico e gestão de usuários sem bloqueio

## Success Criteria

- Every assigned test case implemented and passing
- Every user journey from the PRD's "Fluxos principais" section is reachable end-to-end through this screen
- No role selector anywhere in this task's UI ever renders `"admin"` as an option
