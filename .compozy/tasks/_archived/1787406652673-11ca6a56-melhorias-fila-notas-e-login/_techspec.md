# TechSpec: Melhorias na fila de notas e no login

Companion to [`_prd.md`](_prd.md) and [`_user_stories.md`](_user_stories.md).

## Executive Summary

Three independent slices land in the same codebase without touching each other's
boundaries. Deleting a note is a new backend usecase (`DeleteNote`) orchestrating a
three-table hard delete inside the existing `UnitOfWork` transaction, exposed as
`DELETE /notes/:id`, plus a frontend confirmation dialog wired into a redesigned
`NoteQueueCard`. Quick scan is entirely client-side: a small comparator extracted from
`shared`'s existing allocation algorithm picks the open note closest to completion, and
the queue screen navigates into the scan route that already exists — no new backend
surface. Password visibility is a single reusable `PasswordField` component consumed by
both password screens.

The primary technical trade-offs, all resolved with the user: hard delete is
orchestrated explicitly in the usecase rather than via `ON DELETE CASCADE` (ADR-004);
the delete endpoint uses the project's first `DELETE` verb rather than the established
`POST /:id/<action>` convention (ADR-005); and the quick-scan tie-break logic is
extracted into `shared` and reused by `resolveScan` itself, rather than duplicated in
the frontend (ADR-006). Deleting a note requires connectivity and is never queued
offline — an existing, unmodified mechanism (404 responses treated as non-retryable by
`useOfflineQueue`) already covers the case of a device syncing a stale offline action
against a note deleted elsewhere.

## System Architecture

### Component Overview

- **`DeleteNote` (new usecase, backend)** — orchestrates the hard delete of an open
  note and its children inside one transaction. Boundary: only touches
  `NoteRepository`/`ScanEventRepository` via `UnitOfWork`, same as `FinalizeNote`.
- **`NoteController` (modified, backend)** — gains one `DELETE :id` route,
  `@Roles("operador")`, delegating to `DeleteNote`.
- **`NoteRepository` / `ScanEventRepository` (modified, backend)** — each gains one
  delete method (`delete`, `deleteByNoteId`).
- **`shared/src/allocation/completionOrder.ts` (new, shared)** — the cross-multiplication
  comparator and `openedAt` parser, extracted from `resolveScan.ts`.
- **`shared/src/allocation/pickQuickScanNote.ts` (new, shared)** — picks the open note
  closest to completion from a list of note summaries, reusing the comparator above.
- **`deleteNote` (new, frontend `api/client.ts`)** — thin wrapper over a new `del<T>`
  helper, mirroring the existing `post`/`patch` helpers.
- **`PasswordField` (new, frontend `components/ui`)** — labeled password input with a
  visibility toggle; used by `LoginScreen` (1×) and `ChangePasswordScreen` (2×).
- **`DeleteNoteDialog` (new, frontend `features/notes`)** — confirmation dialog, mirrors
  `FinalizeDialog`'s shape (`Dialog` + two `PillButton`s).
- **`NoteQueueCard` (modified, frontend)** — loses its whole-card `onClick`; gains two
  explicit controls ("ver produtos", "excluir") and the delete dialog.
- **`NotesQueueScreen` (modified, frontend)** — gains the single quick-scan button
  outside the cards, using `pickQuickScanNote` against its already-loaded `notes` state.
- **`PillButton` (modified, frontend `components/ui`)** — gains a `"danger"` variant.

Data flow: `NotesQueueScreen` already fetches `listNotes("open")` into `notes`. Delete
and quick-scan both operate on that same in-memory list — delete calls the API and
reloads; quick-scan never calls the API, it only computes a target `noteId` and
navigates to the existing `/notas/:noteId/bipagem` route (`onOpenNote`, already wired in
`App.tsx`'s `QueueRoute`). No new route, no new backend endpoint for quick-scan.

## Implementation Design

### Core Interfaces

```ts
// backend/src/application/usecase/DeleteNote.ts
export type Input = { noteId: string };
export type Output = { noteId: string };

export default class DeleteNote {
  constructor(private readonly unitOfWork: UnitOfWork) {}
  execute(input: Input): Promise<Output>;
  // - findById(noteId) → NotFoundError("Nota não encontrada") if null
  // - !note.isOpen() → ConflictError("Nota não está mais em conferência")
  // - scanEvents.deleteByNoteId(noteId) then notes.delete(noteId), same transaction
}
```

```ts
// backend/src/infra/repository/NoteRepository.ts (added to the interface)
interface NoteRepository {
  // ...existing members unchanged
  /** Deletes note_items then the invoice_notes row. Caller must delete scan_events first. */
  delete(noteId: string): Promise<void>;
}
```

```ts
// backend/src/infra/repository/ScanEventRepository.ts (added to the interface)
interface ScanEventRepository {
  // ...existing members unchanged
  deleteByNoteId(noteId: string): Promise<number>;
}
```

```ts
// shared/src/allocation/pickQuickScanNote.ts
export interface OpenNoteSummary {
  readonly noteId: string;
  readonly openedAt: string; // ISO 8601
  readonly confirmedTotal: number;
  readonly expectedTotal: number;
}

/** Highest confirmedTotal/expectedTotal ratio wins; ties resolve to the oldest openedAt. */
export function pickQuickScanNote(openNotes: readonly OpenNoteSummary[]): string | null;
```

```ts
// frontend/src/api/client.ts (added)
export const deleteNote = (noteId: string): Promise<void> => del<void>(`/notes/${noteId}`);
```

```tsx
// frontend/src/components/ui/PasswordField.tsx
interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}
// Renders the existing FIELD-styled <input>, toggling type="password"/"text" via
// internal useState, plus a <button type="button" aria-label="Mostrar senha"|"Ocultar senha">
// with the eye SVG, positioned inside the field without stealing focus.
```

### Data Models

No schema change (ADR-004: no new column, no new FK behavior). Existing tables reused
as-is:

- `invoice_notes` — deleted row removed entirely by `DeleteNote`.
- `note_items` — all rows where `note_id = :noteId` removed.
- `scan_events` — all rows where `note_id = :noteId` removed. Rows still `unidentified`
  with `note_id IS NULL` for a different note are untouched (they were never linked to
  the deleted note).

No new response type: the delete endpoint returns `204 No Content`, matching the
client's existing handling (`request()` already returns `undefined` on 204).

`shared`'s `OpenNoteSummary` (above) is populated directly from the frontend's existing
`NoteView` (`noteId`, `openedAt`, `confirmedTotal`, `expectedTotal` all already present —
no new field needed on `NoteView`).

### API Endpoints

| Method | Path | Description | Auth | Success | Failure |
|---|---|---|---|---|---|
| `DELETE` | `/notes/:id` | Hard-deletes an open note and its items/scan events | `@Roles("operador")` | `204 No Content` | `404` note not found (`ParseUUIDPipe`/`findById` miss); `409` note not `open` anymore (`ConflictError`) |

No other endpoint changes. Quick scan and the card restructuring are frontend-only;
password visibility is frontend-only.

## Integration Points

None outside the codebase. The only "integration" is with the project's own existing
offline-queue mechanism (`frontend/src/hooks/useOfflineQueue.ts`), and it needs **no
code change**: `ApplyScanEvent` never takes a `noteId` as input — it resolves the
scanned code against `repositories.notes.listOpen()` read fresh inside its own
transaction, so a scan queued offline for a note deleted in the meantime is simply
reallocated to another open note or resolved as `unidentified`, exactly as it already
would be for any code that no longer matches an open item. The one path that *can*
fail is a queued **manual-item** scan (`manualItemId` set): `ApplyScanEvent.planManual`
throws `NotFoundError("Item não encontrado nas notas em conferência")` when the item's
note is gone — already a non-retryable `ApiError(404, ...)`, already discarded and
surfaced by `useOfflineQueue`'s existing `isRetryable`/`DiscardedScan` handling
(rendered today in `ScanScreen.tsx`'s `discardedScans` banner). `FinalizeNote` behaves
the same way for a queued finalize against a deleted `noteId` (`NotFoundError` → 404 →
`DiscardedFinalize`). This closes both PRD Open Questions without new code.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `backend/src/application/usecase/DeleteNote.ts` | New | Orchestrates 2-repository hard delete in one transaction | Create, unit test |
| `backend/src/infra/repository/NoteRepository.ts` | Modified | Adds `delete(noteId)` to interface + `NoteRepositoryDatabase` | Implement, keep `InMemoryNoteRepository` in sync |
| `backend/src/infra/repository/ScanEventRepository.ts` | Modified | Adds `deleteByNoteId(noteId)` to interface + `ScanEventRepositoryDatabase` | Implement, keep `InMemoryScanEventRepository` in sync |
| `backend/test/support/InMemoryRepositories.ts` | Modified | Must implement the two new interface members or the test suite fails to typecheck | Update alongside the interfaces |
| `backend/src/infra/controller/NoteController.ts` | Modified | Adds `DELETE :id` route | Add route, no DTO needed (no body) |
| `backend/src/infra/module/NoteModule.ts` | Modified | Registers `DeleteNote` as a provider | Add to `providers` |
| `shared/src/allocation/resolveScan.ts` | Modified (refactor only) | Delegates comparison to `completionOrder.ts`; behavior must stay byte-identical | Refactor, run existing `resolveScan.test.ts` unchanged |
| `shared/src/allocation/completionOrder.ts` | New | Comparator + `parseOpenedAt`, internal to the package | Create, unit test directly |
| `shared/src/allocation/pickQuickScanNote.ts` | New | Picks the note closest to completion | Create, unit test |
| `shared/src/index.ts` | Modified | Exports `pickQuickScanNote` and `OpenNoteSummary` | Add exports |
| `frontend/src/api/client.ts` | Modified | Adds `del<T>` helper and `deleteNote` | Add, no change to existing exports |
| `frontend/src/components/ui/PillButton.tsx` | Modified | Adds `"danger"` variant (`bg-choc-700 text-cream-1`, matching `Banner`'s error tone) | Add to `PillButtonVariant`/`VARIANTS` |
| `frontend/src/components/ui/PasswordField.tsx` | New | Reusable password input + visibility toggle | Create, unit test |
| `frontend/src/features/auth/LoginScreen.tsx` | Modified | Replaces the raw password `<input>` with `PasswordField` | Modify, unit test |
| `frontend/src/features/auth/ChangePasswordScreen.tsx` | Modified | Replaces both password `<input>`s with independent `PasswordField`s | Modify, extend existing test |
| `frontend/src/features/notes/DeleteNoteDialog.tsx` | New | Confirmation dialog, mirrors `FinalizeDialog` | Create, unit test |
| `frontend/src/features/notes/NoteQueueCard.tsx` | Modified | Drops whole-card `onClick`; adds "ver produtos"/"excluir" buttons + dialog state | Modify, unit test (first test file for this component) |
| `frontend/src/features/notes/NotesQueueScreen.tsx` | Modified | Adds the quick-scan button, `pickQuickScanNote` call, passes `isOnline`/delete callback down | Modify, unit test (first test file for this component) |

## Testing Approach

- **Backend unit**: Vitest, `FakeUnitOfWork` + `InMemoryNoteRepository`/`InMemoryScanEventRepository`
  (`backend/test/support/InMemoryRepositories.ts`), same shape as `FinalizeNote.test.ts`.
  Fakes sit only at the repository boundary — `DeleteNote` itself runs unmodified.
- **Backend integration**: `startTestApp()` + `jsonRequest` (`backend/test/support/TestApp.ts`),
  same shape as `notes-lifecycle.test.ts`. Uses the fixed `OPERADOR`/`GERENTE` test users
  already provisioned; `app.reset()` truncates tables between cases.
- **Shared unit**: Vitest inside `shared/`, alongside the existing `resolveScan.test.ts`.
  `resolveScan.test.ts` must pass with zero assertion changes — any diff there during
  implementation signals a behavior regression, not a stale test (ADR-006, Risks).
- **Frontend component**: Vitest + Testing Library, `render(withSession(routed(<Component />)))`
  (`frontend/src/test/session.tsx`), `vi.mock("../../api/client", ...)` keeping the real
  module and swapping only the functions under test, fixtures from `frontend/src/test/fixtures.ts`
  (`buildNote`, extended as needed), same shape as `ScanScreen.test.tsx`/`NoteSearchForm.test.tsx`.
  `NoteQueueCard.tsx`, `NotesQueueScreen.tsx`, and `LoginScreen.tsx` get their first
  dedicated test files as part of this work.
- **E2E**: Playwright, one spec per user journey, `e2e/specs/`, following the existing
  `e2e-NNN-<slug>.spec.ts` naming (`e2e-001-bipagem-completa.spec.ts` etc.), run against
  the dedicated E2E Postgres (`docker-compose.e2e.yaml`, per `CLAUDE.md`).

No new environment or data dependency: delete/quick-scan/password-toggle all reuse the
existing test app, fixed users, and E2E Postgres.

## Development Sequencing

### Build Order

1. `shared/src/allocation/completionOrder.ts` + refactor `resolveScan.ts` to use it —
   no dependency, must land first since both the shared unit tests and the frontend
   quick-scan function depend on it.
2. `shared/src/allocation/pickQuickScanNote.ts` + exports — depends on step 1.
3. Backend: `NoteRepository.delete`, `ScanEventRepository.deleteByNoteId`, both database
   implementations and `InMemoryRepositories.ts` — no dependency on steps 1-2.
4. Backend: `DeleteNote` usecase — depends on step 3.
5. Backend: `NoteController` route + `NoteModule` registration — depends on step 4.
6. Frontend: `PillButton` `"danger"` variant, `del<T>`/`deleteNote` in `api/client.ts` —
   no dependency on steps 1-5 (can run in parallel with backend work once the API
   contract from step 5's design is known).
7. Frontend: `DeleteNoteDialog`, `NoteQueueCard` restructuring — depends on step 6 and
   the real `DELETE /notes/:id` endpoint (step 5) for integration testing.
8. Frontend: `NotesQueueScreen` quick-scan button — depends on step 2.
9. Frontend: `PasswordField`, `LoginScreen`/`ChangePasswordScreen` updates — no
   dependency on any other step; can run at any point.
10. E2E specs — depend on every step above being merged.

### Technical Dependencies

None external. All work lands inside the existing monorepo (`backend`, `frontend`,
`shared`) with no new package, no new infrastructure, no new environment variable.

## Monitoring and Observability

- `DeleteNote` logs at the same level `FinalizeNote`/`ApplyScanEvent` already use
  (`Logger` from `@nestjs/common`) on successful deletion, including `noteId` and the
  acting `operatorId` — the only durable trace of a note's existence once deleted, since
  no audit record is kept (PRD, ADR-001).
- No new metric or alert: deletion volume is low-frequency and operator-facing; existing
  request logging on the `DELETE /notes/:id` route (already emitted by whatever
  middleware logs the other note routes today) is sufficient.

## Technical Considerations

### Key Decisions

- **Cascade orchestrated in the usecase, not via `ON DELETE CASCADE`** — see ADR-004.
- **`DELETE /notes/:id`, the project's first `DELETE` verb** — see ADR-005.
- **Completion comparator extracted to `shared`, reused by `resolveScan` itself** — see
  ADR-006.
- **`PillButton` gets a `"danger"` variant styled like `Banner`'s `error` tone**
  (`bg-choc-700 text-cream-1`) rather than introducing an off-palette red — `DESIGN.md`
  has no red in its token set, and reusing the existing dark-chocolate "error" treatment
  keeps the destructive action on-brand without a new color decision.
- **`Card`'s whole-card `onClick` is dropped for `NoteQueueCard`** — the component keeps
  supporting `onClick` for any other caller, but `NoteQueueCard` stops passing it and
  renders two independent `<button>`s inside instead (PRD, ADR-003).
- **One shared `PasswordField` component**, not per-screen inline toggle logic — three
  usages across two screens (login, new password, confirm password) is enough
  repetition to justify extraction, and keeps the `aria-label`/`aria-pressed` pattern
  correct in exactly one place.

### Known Risks

- **Risk**: the `resolveScan.ts` refactor (ADR-006) subtly changes its comparison and
  silently breaks allocation in production. **Mitigation**: `resolveScan.test.ts` runs
  unmodified as a regression gate; the extraction is reviewed as a pure delegation, not
  a rewrite.
- **Risk**: forgetting delete ordering (`scan_events` before `note_items` before
  `invoice_notes`) breaks the FK and fails the transaction. **Mitigation**: this is a
  transaction failure, not silent corruption — nothing partial is left behind; `DeleteNote`'s
  unit test asserts all three record sets are empty after a successful call.
- **Risk**: a manager or admin expects to delete a note from `/notas/history` and finds
  no button there. **Mitigation**: this is the PRD's explicit scope (`open` notes only,
  from the queue) — not a defect, but worth flagging to the user during review if it
  surprises anyone in practice.

## Architecture Decision Records

- [ADR-001: Exclusão definitiva de nota em conferência, com confirmação e sem exigência de progresso](adrs/adr-001.md)
- [ADR-002: Atalho único de bipagem por câmera na fila, sem revisar a ADR-005 da busca de nota](adrs/adr-002.md)
- [ADR-003: Card da fila ganha ações explícitas (ver produtos / excluir) no lugar do clique no card inteiro](adrs/adr-003.md)
- [ADR-004: Exclusão em cascata orquestrada no usecase, sem `ON DELETE CASCADE` no schema](adrs/adr-004.md)
- [ADR-005: `DELETE /notes/:id` como primeiro endpoint DELETE do projeto](adrs/adr-005.md)
- [ADR-006: Comparador de conclusão extraído de `resolveScan` para `shared`, reaproveitado pelo atalho de bipagem rápida](adrs/adr-006.md)
