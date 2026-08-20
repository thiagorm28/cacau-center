---
status: completed
title: Usecases e API de gestão de usuários
type: backend
complexity: high
---

# Task 2: Usecases e API de gestão de usuários

## Overview

Entrega o CRUD completo de usuários exigido pelo PRD (cadastro, listagem, edição,
desativação, reativação, reset de senha) e a troca de senha obrigatória
self-service, expostos via `UserController` (admin-only) e uma extensão de
`AuthController`. Depende inteiramente do contrato construído na task_01
(`SessionRevocationStore`, `PasswordChangeGuard`, colunas novas de `users`).

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST implement `CreateUser` (`name`, `email`, `cpf`, `birthDate`, `role: "operador"|"gerente"`): validates via `Cpf.create`, rejects duplicate email or CPF (active or inactive rows) with a field-specific `ConflictError`, hashes the initial password as `${cpfDigits}@${DDMMAAAA}`, inserts with `active: true`, `mustChangePassword: true`. MUST reject a directly-supplied `role: "admin"` even though the DTO type excludes it structurally (defense-in-depth per ADR-001).
- MUST implement `ListUsers`: returns every user (including the admin row) with fields needed both for the list view and to prefill the edit form — no pagination (small expected volume).
- MUST implement `UpdateUser` (`id`, `name`, `birthDate`, `role: "operador"|"gerente"`): rejects with `NotFoundError` if the target doesn't exist, with `ForbiddenError` if the target's current role is `"admin"`. CPF and e-mail are NOT editable — do not add fields for them.
- MUST implement `DeactivateUser` (`id`): rejects with `NotFoundError` if missing, `ForbiddenError("A conta admin não pode ser desativada")` if the target's role is `"admin"` (this single check covers both self-deactivation and any direct-API attempt, since the route is admin-only and there is exactly one admin — US-013). On success, sets `active: false` and calls `SessionRevocationStore.revoke(id)`.
- MUST implement `ReactivateUser` (`id`): sets `active: true`, does not touch `passwordHash` or `mustChangePassword`, does not call the revocation store.
- MUST implement `ResetPassword` (`id`): rejects with `ConflictError` if the target is `!active`; otherwise recomputes `CPF@DDMMAAAA` from the stored CPF/birth date, updates `passwordHash`, sets `mustChangePassword: true`. Idempotent under repeated calls.
- MUST implement `ChangeInitialPassword` (`userId`, `newPassword`, `confirmPassword`): rejects (plain `Error`, 422) if the two don't match, if the password fails the policy (≥8 chars, ≥1 digit), or if it equals the initial password recomputed from the user's stored CPF/birth date. On success, updates `passwordHash` and sets `mustChangePassword: false`.
- MUST implement `UserController` (`@Roles("admin")` — no need to also list `"operador"`/`"gerente"`, since `RoleGuard`'s admin bypass from task_01 only matters for non-admin roles reaching admin-only routes, which must still be rejected) exposing `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/deactivate`, `POST /users/:id/reactivate`, `POST /users/:id/reset-password`, per the API table in `_techspec.md`.
- MUST add `POST /auth/change-password` to `AuthController`, calling `ChangeInitialPassword` and then re-issuing the session cookie (extract the existing login cookie-setting logic into a shared private method, reused by both `login` and `change-password`) with a fresh JWT (`mustChangePassword: false`).
- MUST annotate `POST /auth/logout`, `GET /auth/me`, and the new `POST /auth/change-password` with `@AllowPendingPasswordChange()` so a user with a pending forced change can still sign out, check identity, and complete the change.
- MUST create `UserModule` (mirrors `NoteModule`/`ScanEventModule`), importing `AuthModule` for `PasswordHasher` and `SessionRevocationStore`, and register it in `AppModule.imports`.
- MUST validate DTOs with `class-validator` (shape/type only — CPF checksum, duplicate checks, and password policy stay in the usecases, per the existing convention).
</requirements>

## Subtasks

- [x] 2.1 Implement `CreateUser` usecase + `POST /users` route.
- [x] 2.2 Implement `ListUsers` usecase + `GET /users` route.
- [x] 2.3 Implement `UpdateUser` usecase + `PATCH /users/:id` route.
- [x] 2.4 Implement `DeactivateUser` usecase + `POST /users/:id/deactivate` route.
- [x] 2.5 Implement `ReactivateUser` usecase + `POST /users/:id/reactivate` route.
- [x] 2.6 Implement `ResetPassword` usecase + `POST /users/:id/reset-password` route.
- [x] 2.7 Implement `ChangeInitialPassword` usecase.
- [x] 2.8 Add `POST /auth/change-password` to `AuthController`; extract the shared cookie-issuing method; apply `@AllowPendingPasswordChange()` to `logout`/`me`/`change-password`.
- [x] 2.9 Wire `UserController` + usecases into a new `UserModule`; register in `AppModule`.
- [x] 2.10 Extend `TestApp` with `USER_PENDING_CHANGE` and `USER_DEACTIVATED` fixtures.
- [x] 2.11 Implement every unit and integration test assigned below.

## Implementation Details

Reference `_techspec.md` "Core Interfaces" for every usecase's `Input`/`Output`
shape and the "API Endpoints" table for exact routes/status codes — do not
re-derive them here.

### Relevant Files

- `backend/src/application/usecase/` — add `CreateUser.ts`, `ListUsers.ts`, `UpdateUser.ts`, `DeactivateUser.ts`, `ReactivateUser.ts`, `ResetPassword.ts`, `ChangeInitialPassword.ts`, following the `Injectable`/`Input`/`Output`/`execute()` shape of `FinalizeNote.ts`.
- `backend/src/infra/controller/UserController.ts` (new) — model on `NoteController.ts:1-79` (per-route `@Roles(...)`, `@CurrentUser()`, `ParseUUIDPipe` with the custom `exceptionFactory` that turns a bad UUID into 404).
- `backend/src/infra/controller/dto/` — new `UserDto.ts` (create/update/change-password request shapes), following `AuthDto.ts`/`NoteDto.ts` conventions.
- `backend/src/infra/controller/AuthController.ts:1-48` — add `change-password`, extract the cookie-setting logic, add `@AllowPendingPasswordChange()`.
- `backend/src/infra/module/UserModule.ts` (new) — mirror `NoteModule`/`ScanEventModule`.
- `backend/src/app.module.ts:1-19` — add `UserModule` to `imports`.
- `backend/src/domain/error/DomainErrors.ts:9-19` — reuse `ConflictError`/`ForbiddenError`/`NotFoundError`, no new error classes needed.
- `backend/src/infra/database/UnitOfWork.ts:1-41` — `Repositories` type already includes `users`; usecases consume it the same way `FinalizeNote` does.
- `backend/test/support/TestApp.ts:61-74` — fixtures to extend (`USER_PENDING_CHANGE`, `USER_DEACTIVATED`).
- `backend/test/integration/` — existing integration test files as the pattern for the new `Users.test.ts`/`ChangePassword.test.ts`.

### Dependent Files

- `backend/src/infra/repository/UserRepository.ts`, `backend/test/support/InMemoryRepositories.ts` — consumed via `UnitOfWork`, delivered by task_01; no further changes expected here beyond usage.
- `backend/src/infra/auth/SessionRevocationStore.ts` — `DeactivateUser` calls `revoke(id)`; delivered by task_01.
- `backend/src/infra/guard/PasswordChangeGuard.ts` — the `AllowPendingPasswordChange` decorator applied here was implemented in task_01.

### Related ADRs

- [ADR-001: Papel admin único, provisionado fora da aplicação](adrs/adr-001.md) — `CreateUser`'s defense against a direct `role: "admin"` call.
- [ADR-002: Senha inicial previsível com troca obrigatória no primeiro login](adrs/adr-002.md) — `ChangeInitialPassword`, `ResetPassword`.
- [ADR-003: Desativação em vez de exclusão de usuários](adrs/adr-003.md) — `DeactivateUser`/`ReactivateUser`.
- [ADR-005: Corte de acesso imediato via store de revogação em memória](adrs/adr-005.md) — `DeactivateUser` → `SessionRevocationStore.revoke`.

## Deliverables

- `UserController` with all six admin-only routes wired through `UserModule`.
- `AuthController` extended with `POST /auth/change-password` and the shared cookie-issuing method.
- Seven usecases implementing the full CRUD + password lifecycle described in the PRD.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition
there before writing tests.

- [x] UT-017, UT-018, UT-019, UT-020, UT-021 — `CreateUser` (happy, admin-role defense, duplicate email, duplicate CPF, invalid CPF)
- [x] UT-022, UT-023 — `ListUsers` (full list, admin-only boundary)
- [x] UT-024, UT-025, UT-026 — `UpdateUser` (happy, not found, target-is-admin)
- [x] UT-027, UT-028, UT-029 — `DeactivateUser` (happy + revoke called, not found, target-is-admin)
- [x] UT-030, UT-031 — `ReactivateUser` (happy, not found)
- [x] UT-032, UT-033, UT-034 — `ResetPassword` (happy, inactive target, idempotency)
- [x] UT-035, UT-036, UT-037, UT-038 — `ChangeInitialPassword` (happy, mismatch, equals-initial, policy boundary)
- [x] IT-005, IT-006, IT-007, IT-008, IT-009, IT-010, IT-011 — `POST /users` (happy, admin-role rejected, missing field, duplicate email, duplicate CPF on inactive user, invalid CPF, concurrent duplicate)
- [x] IT-012, IT-013 — `GET /users` (non-admin rejected, admin sees all)
- [x] IT-014, IT-015 — `PATCH /users/:id` (happy, admin-role rejected)
- [x] IT-016, IT-017, IT-018, IT-019 — deactivate flow (happy + login rejected, history preserved, open-session revoked, self-deactivation rejected)
- [x] IT-020 — reactivate flow (happy, old password still works)
- [x] IT-021, IT-022, IT-023 — reset-password flow (happy, inactive target, idempotency)
- [x] IT-024, IT-025, IT-026 — forced password change flow (full flow, persists across logout/login, equals-initial rejected)
- [x] IT-027 — non-admin direct `POST /users` call rejected, no data leaked

## Success Criteria

- Every assigned test case implemented and passing
- Every route in the API Endpoints table of `_techspec.md` responds with the documented status codes for both its success and failure shapes
- `DeactivateUser` is the only usecase that calls `SessionRevocationStore.revoke`
