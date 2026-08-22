---
status: completed
title: "Backend: excluir nota em conferência"
type: backend
complexity: medium
---

# Task 2: Backend: excluir nota em conferência

## Overview

Adiciona a primeira forma de excluir uma nota em conferência no sistema: um novo
usecase `DeleteNote` que apaga em cascata (orquestrado na transação, sem depender de
`ON DELETE CASCADE`) a nota, seus itens e todo o histórico de bipagens, exposto como
`DELETE /notes/:id` restrito ao papel `operador`. É o único bloqueador de backend do
task_04 (frontend), que consome este endpoint para o fluxo de exclusão da fila.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST add `delete(noteId: string): Promise<void>` to `NoteRepository` (interface + `NoteRepositoryDatabase`), deleting `note_items` rows for that `noteId` and then the `invoice_notes` row, in that order.
- MUST add `deleteByNoteId(noteId: string): Promise<number>` to `ScanEventRepository` (interface + `ScanEventRepositoryDatabase`), deleting `scan_events` rows for that `noteId`.
- MUST add a new usecase `DeleteNote` (`backend/src/application/usecase/DeleteNote.ts`) that, inside a single `UnitOfWork.run(...)` transaction: loads the note via `findById`, throws `NotFoundError("Nota não encontrada")` if it doesn't exist, throws `ConflictError("Nota não está mais em conferência")` if `!note.isOpen()`, then calls `scanEvents.deleteByNoteId(noteId)` **before** `notes.delete(noteId)` (FK order: `scan_events` → `note_items` → `invoice_notes`).
- MUST register `DeleteNote` as a provider in `NoteModule` and inject it into `NoteController`.
- MUST add a `DELETE :id` route to `NoteController`, decorated `@Roles("operador")`, reusing the existing `noteIdParam()` (`ParseUUIDPipe` that throws `NotFoundError` for a malformed id), returning `204 No Content` on success and no request body.
- MUST NOT add `onDelete: "cascade"` to any schema FK and MUST NOT create a Drizzle migration for this task (ADR-004) — the cascade is entirely orchestrated in the usecase.
- MUST update `backend/test/support/InMemoryRepositories.ts`'s `InMemoryNoteRepository` and `InMemoryScanEventRepository` to implement the two new interface members, so the existing unit test suite keeps compiling.
- MUST NOT touch `resolveScan`, `ApplyScanEvent`, `FinalizeNote`, or any other existing usecase's behavior.
</requirements>

## Subtasks
- [x] 2.1 Add `delete(noteId)` to `NoteRepository`'s interface and `NoteRepositoryDatabase` implementation, deleting `note_items` then `invoice_notes` for that `noteId`.
- [x] 2.2 Add `deleteByNoteId(noteId)` to `ScanEventRepository`'s interface and `ScanEventRepositoryDatabase` implementation, deleting `scan_events` for that `noteId`.
- [x] 2.3 Update `InMemoryNoteRepository`/`InMemoryScanEventRepository` in `backend/test/support/InMemoryRepositories.ts` to implement both new methods against their in-memory record arrays.
- [x] 2.4 Implement `DeleteNote` usecase: load note, enforce `NotFoundError`/`ConflictError`, delete scan events then the note, inside one `UnitOfWork.run(...)` call.
- [x] 2.5 Register `DeleteNote` in `NoteModule`'s `providers` and inject it into `NoteController`.
- [x] 2.6 Add the `DELETE :id` route to `NoteController` with `@Roles("operador")` and `noteIdParam()`.
- [x] 2.7 Write `DeleteNote` unit tests against `FakeUnitOfWork` (UT-001–UT-005), mirroring `FinalizeNote.test.ts`'s structure.
- [x] 2.8 Write the `DELETE /notes/:id` integration tests against a real HTTP app and Postgres (IT-001–IT-009), mirroring `notes-lifecycle.test.ts`.
- [x] 2.9 Write the offline-queue-against-a-deleted-note integration tests (IT-010, IT-011), confirming `POST /scan-events/sync` and `POST /notes/:id/finalize` already surface the deletion correctly with zero new code in those usecases.
- [x] 2.10 Run the backend's full test suite and typecheck; confirm no regression in existing note/scan-event/finalize tests.

## Implementation Details

Reference `_techspec.md` — Core Interfaces, Data Models, API Endpoints, and ADR-004
(`adrs/adr-004.md`)/ADR-005 (`adrs/adr-005.md`) for the exact usecase shape, deletion
order, and route/verb decision. `DeleteNote` follows `FinalizeNote.ts`'s shape closely:
`@Injectable()`, constructor-injects `@Inject("UnitOfWork") unitOfWork: UnitOfWork`,
`execute` delegates to a private `deleteWithin(repositories, input)` that does the actual
work. `Input = { noteId: string }`, `Output = { noteId: string }`.

The route needs no DTO (no request body), matching the `POST :id/deactivate` pattern in
`UserController.ts` for a no-body action route — but uses `@Delete(":id")` from
`@nestjs/common` and `@HttpCode(204)` isn't needed since Nest returns 204 by default for
a route handler that returns `undefined`/`void`; confirm the exact status by checking
how other 200-vs-204 routes are set up (`FinalizeNote`'s route uses `@HttpCode(200)`
because it returns a body — this route returns nothing, so `204` should be Nest's
default, but verify against `_techspec.md`'s API Endpoints table and adjust with
`@HttpCode(204)` explicitly if Nest's default differs).

`ApplyScanEvent`'s `planManual` already throws `NotFoundError("Item não encontrado nas notas em conferência")`
when a `manualItemId` doesn't resolve against any open note (because the note was
deleted) — IT-010 exercises this existing path, it requires no new code in
`ApplyScanEvent.ts`. Likewise `FinalizeNote.ts` already throws
`NotFoundError("Nota não encontrada")` for an unknown `noteId` — IT-011 exercises this
existing path with no new code in `FinalizeNote.ts`.

### Relevant Files
- `backend/src/application/usecase/FinalizeNote.ts` — closest existing pattern for a usecase orchestrating multiple repositories inside one `UnitOfWork.run(...)` call; `DeleteNote` mirrors its shape.
- `backend/src/application/usecase/ApplyScanEvent.ts` — read-only reference for IT-010: confirms `manualItemId` resolution already throws `NotFoundError` when the target note is gone; do not modify.
- `backend/src/infra/repository/NoteRepository.ts` — interface + `NoteRepositoryDatabase`; add `delete(noteId)` here, following the existing `close()` method's shape (`this.exec.update/delete(...).where(eq(invoiceNotes.id, noteId))`).
- `backend/src/infra/repository/ScanEventRepository.ts` — interface + `ScanEventRepositoryDatabase`; add `deleteByNoteId(noteId)` here, following `claimUnidentified`'s shape for a `where`-scoped bulk operation.
- `backend/src/infra/database/schema/invoiceNotes.ts`, `noteItems.ts`, `scanEvents.ts` — read-only reference to confirm current FK shape (no `onDelete: "cascade"` anywhere) and column names for the `DELETE` statements; do not modify (ADR-004).
- `backend/src/infra/database/UnitOfWork.ts` — `Repositories`/`UnitOfWork` types the usecase depends on; not modified.
- `backend/src/infra/controller/NoteController.ts` — add the `DELETE :id` route here, reusing `noteIdParam()`.
- `backend/src/infra/module/NoteModule.ts` — register `DeleteNote` in `providers`.
- `backend/src/infra/guard/Roles.ts`, `RoleGuard.ts` — read-only reference confirming `@Roles("operador")` enforcement; not modified.
- `backend/src/domain/error/DomainErrors.ts` — `NotFoundError`/`ConflictError` used by the usecase; not modified.
- `backend/src/infra/filter/ErrorFilter.ts` — read-only reference confirming `NotFoundError` → 404, `ConflictError` → 409 mapping; not modified.
- `backend/test/support/InMemoryRepositories.ts` — add the two new methods to `InMemoryNoteRepository`/`InMemoryScanEventRepository`.
- `backend/test/unit/FinalizeNote.test.ts` — structural template for `DeleteNote`'s unit test file (`FakeUnitOfWork`, `openNote` helper, `PANETONE_CPROD`/`TRUFA_CPROD` fixtures from `backend/test/support/nfeFixtures.ts`).
- `backend/test/integration/notes-lifecycle.test.ts` — structural template for the integration test file (`startTestApp()`, `jsonRequest`, `OPERADOR`/`GERENTE` fixed users from `backend/test/support/TestApp.ts`).

### Dependent Files
- `frontend/src/api/client.ts` — task_04 adds `deleteNote`/`del<T>` here, calling this task's `DELETE /notes/:id` endpoint; the exact status codes and error messages this task returns (404/409/204) are the contract task_04 codes against.
- `frontend/src/features/notes/NoteQueueCard.tsx`, `DeleteNoteDialog.tsx` (task_04) — consume this endpoint's success/error shape for the delete confirmation flow.

### Related ADRs
- [ADR-004: Exclusão em cascata orquestrada no usecase, sem `ON DELETE CASCADE` no schema](adrs/adr-004.md) — mandates the explicit multi-repository orchestration and deletion order this task implements.
- [ADR-005: `DELETE /notes/:id` como primeiro endpoint DELETE do projeto](adrs/adr-005.md) — mandates the route/verb shape and no-body contract.
- [ADR-001: Exclusão definitiva de nota em conferência, com confirmação e sem exigência de progresso](adrs/adr-001.md) — the underlying product decision (hard delete, `operador` role, `open`-only) this task's business rules enforce.

## Deliverables
- `NoteRepository.delete` and `ScanEventRepository.deleteByNoteId`, interface + database implementation.
- `DeleteNote` usecase, registered in `NoteModule`, wired into `NoteController` as `DELETE /notes/:id`.
- `InMemoryRepositories.ts` updated to keep the backend unit test suite compiling.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001, UT-002, UT-003, UT-004, UT-005 — `DeleteNote` usecase: full cascade delete, unknown noteId → `NotFoundError`, `completed`/`closed_incomplete` note → `ConflictError`, note with zero scan events.
- [x] IT-001, IT-002, IT-003, IT-004, IT-005, IT-006, IT-007, IT-008, IT-009 — `DELETE /notes/:id` HTTP: success with/without prior scans, wrong role (403), unauthenticated (401), unknown id (404), malformed id (404), already-closed note (409) × 2 statuses, double-delete (204 then 404).
- [x] IT-010, IT-011 — offline queue against a deleted note: `POST /scan-events/sync` with a stale `manualItemId` and `POST /notes/:id/finalize` with a stale `noteId` both already surface the deletion correctly via existing `NotFoundError` paths.

## Success Criteria
- Every assigned test case implemented and passing
- `DELETE /notes/:id` enforces `operador`-only access, hard-deletes all three tables in the correct FK order, and returns 404/409 per the documented error mapping
- No existing backend test (`FinalizeNote.test.ts`, `notes-lifecycle.test.ts`, `ApplyScanEvent`-related suites, etc.) regresses
- Backend typecheck and full test suite are clean
