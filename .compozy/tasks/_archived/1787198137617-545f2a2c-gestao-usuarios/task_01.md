---
status: completed
title: Fundação de autenticação e schema para gestão de usuários
type: backend
complexity: critical
---

# Task 1: Fundação de autenticação e schema para gestão de usuários

## Overview

Estabelece o contrato do qual toda a feature depende: as colunas novas na tabela
`users`, a validação de CPF, a revogação de sessão para desativação imediata
(ADR-005), o bypass do papel `admin` nos guards (ADR-006), o bloqueio de rota por
troca de senha pendente (ADR-002) e o script de provisionamento do admin (ADR-001).
Nenhuma rota existente (`NoteController`, `ScanEventController`) muda de código —
o acesso irrestrito do admin é resolvido inteiramente dentro do `RoleGuard`.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST add `cpf` (text, not null, unique), `birth_date` (date, not null), `active` (boolean, not null, default true), `must_change_password` (boolean, not null, default false) columns to `users`, and widen the `user_role` pg enum to include `"admin"`.
- MUST verify the generated migration does not group the enum `ALTER TYPE ... ADD VALUE` with the `ALTER TABLE ADD COLUMN` statements in a single transaction — split into two migration files if `drizzle-kit generate` groups them (Postgres rejects `ADD VALUE` inside a transaction that also does other DDL in the same statement batch).
- MUST implement `Cpf.create(raw: string)` (domain value object) validating the 11-digit check-digit algorithm and rejecting all-same-digit sequences (e.g. `"11111111111"`), throwing a plain `Error` on failure (US-004.AC-1, US-004.EC-1).
- MUST widen the `Role` union in `backend/src/domain/SessionUser.ts` to `"operador" | "gerente" | "admin"`.
- MUST extend `UserRepository` (interface + Drizzle impl + `InMemoryUserRepository` fake) with `findByCpf`, `list`, `create`, `update`, `setActive`, `setPassword`.
- MUST implement `SessionRevocationStore` as an in-memory singleton (`revoke(userId): void`, `isRevoked(userId, tokenIssuedAtSeconds): boolean`), registered as a provider in `AuthModule` and exported (ADR-005).
- MUST widen `JwtPayload` with `mustChangePassword: boolean`; `JwtStrategy.validate` MUST return `false` when `SessionRevocationStore.isRevoked(payload.sub, payload.iat)` is true, reusing the existing `AuthGuard.handleRequest` 401 path — do not throw a new error type here.
- MUST modify `RoleGuard.canActivate` so `user.role === "admin"` returns `true` immediately, before checking the route's `@Roles(...)` list (ADR-006).
- MUST implement `PasswordChangeGuard` (registered globally in `app.module.ts`, ordered after `AuthGuard`) and an `AllowPendingPasswordChange()` decorator (mirrors the existing `@Public()` pattern): the guard throws `ForbiddenError` (403) when `user.mustChangePassword === true` and the route lacks the decorator.
- MUST modify `Login` usecase to reject with the existing generic `UnauthorizedError("Credenciais inválidas")` when the matched user has `active === false` — same message as wrong credentials, no user-enumeration leak.
- MUST implement `backend/scripts/bootstrap-admin.ts`: reads `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_CPF`/`ADMIN_BIRTH_DATE`/`ADMIN_PASSWORD` from env, validates CPF and the password policy (≥8 chars, ≥1 digit), checks for an existing `role = "admin"` row before inserting (idempotent — ADR-001 risk), inserts with `active: true`, `mustChangePassword: true`.
- MUST add an `npm run bootstrap:admin -w backend` script wired to the new file.
- MUST NOT modify `NoteController`, `ScanEventController`, or any existing `@Roles(...)` call site — admin's unrestricted access must come only from the `RoleGuard` bypass.
</requirements>

## Subtasks

- [x] 1.1 Add `cpf`, `birth_date`, `active`, `must_change_password` columns and widen `user_role` enum in `schema/users.ts`; generate and verify the migration (including the enum-in-its-own-transaction check).
- [x] 1.2 Implement `domain/valueobject/Cpf.ts` with checksum validation and repeated-digit rejection.
- [x] 1.3 Widen `Role` (backend) and extend `UserRepository` (interface, Drizzle impl, `InMemoryUserRepository`) with the new methods.
- [x] 1.4 Implement `SessionRevocationStore` and register/export it in `AuthModule`.
- [x] 1.5 Extend `JwtPayload`/`TokenGenerator` with `mustChangePassword`; wire the revocation check into `JwtStrategy.validate`.
- [x] 1.6 Add the admin bypass to `RoleGuard` (ADR-006).
- [x] 1.7 Implement `PasswordChangeGuard` + `AllowPendingPasswordChange` decorator and register the guard globally.
- [x] 1.8 Modify `Login` usecase to reject deactivated users with the generic credentials error.
- [x] 1.9 Implement `bootstrap-admin.ts` (idempotent) + its npm script.
- [x] 1.10 Extend `TestApp` with an `ADMIN` fixture (and helpers needed by this task's own tests).
- [x] 1.11 Implement every unit and integration test assigned below.

## Implementation Details

Reference `_techspec.md` sections "Core Interfaces", "Data Models", and "Data Flow"
(steps 1–3) for exact shapes — do not re-derive them here. `SessionRevocationStore`'s
interface and the `PasswordChangeGuard` sketch are both given verbatim in the
TechSpec's Core Interfaces subsection.

### Relevant Files

- `backend/src/infra/database/schema/users.ts` — add the four columns and widen `userRole` pgEnum.
- `backend/drizzle.config.ts`, `backend/drizzle/` — migration generation output.
- `backend/src/domain/SessionUser.ts` — `Role` union and `SESSION_TTL_SECONDS`.
- `backend/src/domain/valueobject/` (new directory) — `Cpf.ts`.
- `backend/src/infra/repository/UserRepository.ts` — interface + Drizzle-backed impl to extend.
- `backend/test/support/InMemoryRepositories.ts:214-239` — `InMemoryUserRepository` fake to extend in lockstep.
- `backend/src/infra/auth/TokenGenerator.ts` — `JwtPayload` type and signing call.
- `backend/src/infra/auth/JwtStrategy.ts:26-33` — `validate` method, needs `SessionRevocationStore` injected.
- `backend/src/infra/auth/SessionRevocationStore.ts` (new file).
- `backend/src/infra/guard/RoleGuard.ts:1-25` — add the admin bypass.
- `backend/src/infra/guard/Roles.ts`, `backend/src/infra/guard/Public.ts` — pattern to mirror for the new `AllowPendingPasswordChange` decorator.
- `backend/src/infra/guard/PasswordChangeGuard.ts` (new file).
- `backend/src/application/usecase/Login.ts:1-49` — add the `active` check.
- `backend/src/infra/util/PasswordHasher.ts` — `PasswordHasherBcrypt`, reused by the bootstrap script.
- `backend/src/app.module.ts:1-19` — register `PasswordChangeGuard` as a global `APP_GUARD`, after `AuthGuard`.
- `backend/src/infra/module/AuthModule.ts` — register/export `SessionRevocationStore`, same pattern as the existing `PasswordHasher` export.
- `backend/package.json` — new `bootstrap:admin` script.
- `backend/test/support/TestApp.ts:61-74` — direct-insert pattern to model the bootstrap script after, and the fixture to extend with `ADMIN`.
- `backend/test/unit/Auth.test.ts` — existing pattern for hand-built `ExecutionContext` guard tests.

### Dependent Files

- `backend/src/application/usecase/FinalizeNote.ts`, `GetNoteReport.ts`, and any other usecase matching on `Role` via a switch/union — verify they still compile against the widened `Role` type (no behavior change expected, since `admin` is never assigned to `operador`/`gerente`-scoped data).
- `backend/src/infra/controller/NoteController.ts`, `ScanEventController.ts` — no code change, but their existing `@Roles(...)` routes are exercised by this task's integration tests to prove the admin bypass works without touching them.

### Related ADRs

- [ADR-001: Papel admin único, provisionado fora da aplicação](adrs/adr-001.md) — governs the bootstrap script's shape and idempotency requirement.
- [ADR-002: Senha inicial previsível com troca obrigatória no primeiro login](adrs/adr-002.md) — `mustChangePassword` claim and `PasswordChangeGuard` are its enforcement mechanism.
- [ADR-005: Corte de acesso imediato via store de revogação em memória](adrs/adr-005.md) — `SessionRevocationStore` design and accepted restart risk.
- [ADR-006: Bypass automático do admin nos guards de papel](adrs/adr-006.md) — `RoleGuard` change.

## Deliverables

- Migrated `users` schema with `cpf`/`birth_date`/`active`/`must_change_password` and the widened `user_role` enum.
- `Cpf` value object, widened `Role` type, extended `UserRepository` (real + in-memory).
- `SessionRevocationStore`, widened `JwtPayload`, revocation check wired into `JwtStrategy.validate`.
- `RoleGuard` admin bypass; `PasswordChangeGuard` + `AllowPendingPasswordChange` decorator, registered globally.
- `Login` usecase rejecting deactivated users.
- `backend/scripts/bootstrap-admin.ts` + `npm run bootstrap:admin` script.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition
there before writing tests.

- [x] UT-001, UT-002, UT-003, UT-004, UT-005 — `Cpf` value object (happy, punctuation-stripping, invalid check digit, repeated digits, wrong length)
- [x] UT-006, UT-007, UT-008 — `SessionRevocationStore` (unrevoked, revoked-before-iat, revoked-after-iat)
- [x] UT-009, UT-010, UT-011 — `RoleGuard` (admin bypass, non-matching role still rejected, no user rejected)
- [x] UT-012, UT-013, UT-014 — `PasswordChangeGuard` (not pending, pending+allowed, pending+blocked)
- [x] UT-015, UT-016 — `JwtStrategy.validate` (valid non-revoked, revoked)
- [x] UT-039, UT-040 — `Login` usecase (deactivated user rejected, `mustChangePassword` propagated)
- [x] IT-001 — `POST /auth/login` as admin returns `mustChangePassword` in body
- [x] IT-002 — admin session hits an existing `@Roles("operador")` route (bipagem) without route changes
- [x] IT-003 — admin session hits an existing `@Roles("gerente")` route (histórico) without route changes
- [x] IT-004 — logout then reusing the old cookie on a protected route returns 401
- [x] IT-028 — `bootstrap-admin.ts` run twice is idempotent, no duplicate admin row

## Success Criteria

- Every assigned test case implemented and passing
- The full existing test suite (pre-feature) still passes unmodified — no `NoteController`/`ScanEventController` route changed
- `npm run bootstrap:admin -w backend` run twice against a fresh database creates exactly one admin row
- `RoleGuard` and `PasswordChangeGuard` unit tests explicitly cover both the allow and deny paths introduced by this task
