---
status: completed
title: "Frontend: fila de notas — excluir, ver produtos e bipagem rápida"
type: frontend
complexity: high
---

# Task 4: Frontend: fila de notas — excluir, ver produtos e bipagem rápida

## Overview

Restrutura a tela de fila de conferência (`/notas`) em torno de três capacidades novas:
excluir uma nota aberta (com diálogo de confirmação e aviso de progresso perdido), abrir
uma nota específica por um botão explícito ("ver produtos") no lugar do card inteiro
clicável, e um atalho único de "bipagem rápida" que navega direto para a nota aberta
mais próxima da conclusão. As três capacidades tocam os mesmos dois arquivos
(`NotesQueueScreen.tsx`, `NoteQueueCard.tsx`), por isso vivem numa única task — depende
do endpoint de exclusão (task_02) e do `pickQuickScanNote` (task_01).

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST add a `"danger"` variant to `PillButton`'s `PillButtonVariant` union, styled to match `Banner`'s `error` tone (`bg-choc-700 text-cream-1`, with a hover state consistent with the existing variants' pattern) — no off-palette red.
- MUST add a `del<T>` helper to `frontend/src/api/client.ts` (`method: "DELETE"`, no body) and export `deleteNote(noteId: string): Promise<void>` calling `DELETE /notes/${noteId}`, following the existing `post`/`patch` helper shape.
- MUST create `frontend/src/features/notes/DeleteNoteDialog.tsx`, reusing `Dialog`+`PillButton` exactly like `FinalizeDialog.tsx`'s shape: props include at least `invoiceNumber`, `confirmedTotal`, `expectedTotal`, `isSubmitting`, `error`, `onConfirm`, `onCancel`. MUST NOT mention progress loss when `confirmedTotal === 0`; MUST state the exact count ("X de Y caixas conferidas") when `confirmedTotal > 0`, including when `confirmedTotal === expectedTotal` (100% but still open — same warning, no special-cased message). MUST always state the exclusion is permanent.
- MUST restructure `NoteQueueCard.tsx` to stop passing `onClick` to `Card` (removing the whole-card-clickable behavior) and render two independent `<button>`-based controls inside: "Ver produtos" (calls `onOpen(note.noteId)`) and "Excluir" (opens `DeleteNoteDialog`, calls a new `onDelete(note.noteId): Promise<void>` prop on confirm). Clicking either control MUST NOT trigger the other.
- MUST disable `NoteQueueCard`'s "Excluir" control when a new `isOnline: boolean` prop is `false`, and MUST re-enable it when `isOnline` becomes `true` again — deletion is never queued offline (PRD, ADR-001; no change to `useOfflineQueue`/`queueStore`).
- MUST surface `onDelete`'s rejection inside the open `DeleteNoteDialog` (distinguishing at least an `ApiError` message from a `NetworkError` connectivity message) without closing the dialog or assuming the deletion succeeded.
- MUST add a single "Bipar" (quick-scan) `PillButton` to `NotesQueueScreen.tsx`, positioned outside the card list (not duplicated per card), disabled when `notes.length === 0`. On click, it MUST call `pickQuickScanNote` (imported from `"shared"`) against the currently loaded open `notes`, mapping each `NoteView` to `OpenNoteSummary` (`noteId`, `openedAt`, `confirmedTotal`, `expectedTotal`), and navigate via the existing `onOpenNote(noteId)` prop when a note is picked.
- MUST wire `NotesQueueScreen.tsx` to pass `isOnline` (already computed via `useOnlineStatus()`) and a `deleteNote`-backed `onDelete` callback (that calls the API then triggers `reload()`) down to each `NoteQueueCard`.
- MUST NOT change `ScanRoute.tsx`, `App.tsx`'s route definitions, or `resolveScan`/`ApplyScanEvent`'s per-scan allocation behavior — the quick-scan button only decides which note is initially shown, per ADR-002.
</requirements>

## Subtasks
- [x] 4.1 Add the `"danger"` variant to `PillButton.tsx`.
- [x] 4.2 Add `del<T>`/`deleteNote` to `frontend/src/api/client.ts`.
- [x] 4.3 Create `DeleteNoteDialog.tsx` with the conditional progress-loss warning and permanent-action messaging.
- [x] 4.4 Restructure `NoteQueueCard.tsx`: drop the whole-card `onClick`, add "Ver produtos"/"Excluir" controls, wire in `DeleteNoteDialog`, add `isOnline`-gated disabling and error surfacing for the delete flow.
- [x] 4.5 Add the quick-scan button to `NotesQueueScreen.tsx`, importing `pickQuickScanNote` from `"shared"` and mapping `NoteView[]` to `OpenNoteSummary[]`.
- [x] 4.6 Wire `NotesQueueScreen.tsx`'s `isOnline` and a `deleteNote`-backed `onDelete` (with `reload()` on success) down to each `NoteQueueCard`.
- [x] 4.7 Write `PillButton` danger-variant unit test (UT-024).
- [x] 4.8 Write `DeleteNoteDialog` unit tests (UT-025–UT-030).
- [x] 4.9 Write `NoteQueueCard` unit tests (UT-031–UT-038) — first dedicated test file for this component.
- [x] 4.10 Write `NotesQueueScreen` unit tests (UT-039–UT-044) — first dedicated test file for this component.
- [x] 4.11 Write `deleteNote`/`del<T>` client unit tests (UT-045, UT-046).
- [x] 4.12 Write the five E2E specs (E2E-001–E2E-005) under `e2e/specs/`.
- [x] 4.13 Run the frontend test suite and typecheck; confirm no regression in `NoteSearchForm.test.tsx` or `ScanScreen.test.tsx`.

## Implementation Details

Reference `_techspec.md` — Core Interfaces, Component Overview, API Endpoints, Key
Decisions, and ADR-001/ADR-002/ADR-003 for the full rationale. `NotesQueueScreen.tsx`
already fetches `listNotes("open")` into `notes` state and exposes `reload()` — both the
delete flow and the quick-scan button reuse that same state, no new fetch. `App.tsx`'s
`QueueRoute` already wires `onOpenNote={(noteId) => navigate(`/notas/${noteId}/bipagem`)}` —
reuse it unchanged for both "Ver produtos" and quick-scan; do not add a new route or a
new prop for navigation.

`DeleteNoteDialog` mirrors `FinalizeDialog.tsx` exactly in shape (`Dialog` wrapping two
`PillButton`s, one `variant="danger"` for the destructive confirm and one
`variant="ghost"` for cancel, `disabled={isSubmitting}` on both). The progress-loss
message text is a business rule from the PRD (User Experience, Business Rules) and
`_user_stories.md` US-002 — build it from `confirmedTotal`/`expectedTotal` already
available on `NoteView` without any new API call.

`NoteQueueCard`'s delete flow owns its own local state (`isDialogOpen`, `isSubmitting`,
`error`) — `onDelete` is a promise-returning prop the card awaits; on rejection it
displays the error inside the still-open dialog and does not call `onOpen`/navigate.
Distinguish `ApiError` (e.g. a 409 "Nota não está mais em conferência" from another
device closing/finalizing it first) from `NetworkError` (connectivity dropped mid-flow)
the same way `NoteSearchForm.tsx` already distinguishes them for its own error states.

### Relevant Files
- `frontend/src/features/notes/NotesQueueScreen.tsx` — add the quick-scan button and the `isOnline`/`onDelete` wiring down to `NoteQueueCard`; already has `notes`, `reload`, `useOnlineStatus()`.
- `frontend/src/features/notes/NoteQueueCard.tsx` — the component being restructured: read its current whole-card-`onClick` shape before removing it.
- `frontend/src/features/notes/NoteSearchForm.tsx` — sibling component in the same screen; read for its `isOnline`-prop convention and offline-messaging style ("é preciso estar conectado") to mirror in the delete flow's `NetworkError` case.
- `frontend/src/features/scan/FinalizeDialog.tsx` — structural template for `DeleteNoteDialog.tsx` (`Dialog` + two `PillButton`s, `isSubmitting` disabling both).
- `frontend/src/components/ui/Dialog.tsx` — the dialog shell (`title`, `description`, `children`) `DeleteNoteDialog` wraps; not modified.
- `frontend/src/components/ui/PillButton.tsx` — add the `"danger"` variant here.
- `frontend/src/components/ui/Card.tsx` — confirms `onClick` is optional and the whole-card-button behavior being removed from `NoteQueueCard`'s usage; the component itself is not modified (other callers may still use `onClick`).
- `frontend/src/api/client.ts` — add `del<T>`/`deleteNote` here, next to the existing `finalizeNote`/`getNote`/`listNotes` note-related exports; read `request()`'s 204-handling (`if (response.status === 204) return undefined as T;`) already in place.
- `frontend/src/api/types.ts` — `NoteView` (already has `noteId`, `openedAt`, `confirmedTotal`, `expectedTotal`) is the source for both the delete dialog's progress text and the `OpenNoteSummary` mapping for quick-scan; not modified.
- `frontend/src/hooks/useOnlineStatus.ts` — already used by `NotesQueueScreen.tsx`; read its return shape to pass `isOnline` down.
- `frontend/src/App.tsx` — read-only reference confirming `QueueRoute`'s `onOpenNote` wiring (`navigate(`/notas/${noteId}/bipagem`)`); not modified.
- `shared` package (`pickQuickScanNote`, `OpenNoteSummary` from task_01) — import from `"shared"` once task_01 is merged; do not reimplement the comparison logic locally.
- `frontend/src/test/fixtures.ts` — `buildNote` fixture builder; extend usage with `openedAt`/`confirmedTotal`/`expectedTotal` overrides for the quick-scan test cases (UT-039, UT-040, UT-044).
- `frontend/src/features/notes/NoteSearchForm.test.tsx` — structural template for the new `NoteQueueCard.test.tsx`/`NotesQueueScreen.test.tsx` files (`vi.mock("../../api/client", ...)`, `renderForm`-style helper, `userEvent.setup()`).
- `e2e/specs/e2e-001-bipagem-completa.spec.ts`, `e2e-002-multi-nota.spec.ts` — naming/structure convention and multi-note fixture setup relevant to E2E-004/E2E-005 (two open notes at different completion levels).
- `DESIGN.md` — the `"danger"` variant and the two-button card layout must follow its rounded/shadow/color tokens.

### Dependent Files
- `shared/src/index.ts` (task_01) — this task imports `pickQuickScanNote`/`OpenNoteSummary` from it; task_01 must be merged first.
- `backend/src/infra/controller/NoteController.ts` (task_02) — this task's `deleteNote` calls the `DELETE /notes/:id` route task_02 adds; task_02 must be merged first for the E2E specs (E2E-001, E2E-002) to run against a real backend.

### Related ADRs
- [ADR-001: Exclusão definitiva de nota em conferência, com confirmação e sem exigência de progresso](adrs/adr-001.md) — governs the dialog's messaging, the `operador`-only access (already enforced backend-side by task_02), and the offline-disabled rule.
- [ADR-002: Atalho único de bipagem por câmera na fila, sem revisar a ADR-005 da busca de nota](adrs/adr-002.md) — governs the quick-scan button's single-button-outside-cards placement and the closest-to-completion selection.
- [ADR-003: Card da fila ganha ações explícitas (ver produtos / excluir) no lugar do clique no card inteiro](adrs/adr-003.md) — governs the `NoteQueueCard` restructuring this task implements directly.

## Deliverables
- `PillButton`'s `"danger"` variant.
- `deleteNote`/`del<T>` in `frontend/src/api/client.ts`.
- `DeleteNoteDialog.tsx`.
- `NoteQueueCard.tsx` restructured with two explicit controls and the delete flow.
- `NotesQueueScreen.tsx` with the quick-scan button and delete wiring.
- Five new E2E specs under `e2e/specs/`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-024 — `PillButton`: `"danger"` variant renders the correct classes.
- [x] UT-025, UT-026, UT-027, UT-028, UT-029, UT-030 — `DeleteNoteDialog`: no-progress vs. progress-loss warning text, 100%-but-open still warns, confirm/cancel call the right handler, `isSubmitting` disables both buttons.
- [x] UT-031, UT-032, UT-033, UT-034, UT-035, UT-036, UT-037, UT-038 — `NoteQueueCard`: "Ver produtos" opens the note without opening the dialog, "Excluir" opens the dialog without opening the note, confirming calls `onDelete`, `ApiError`/`NetworkError` rejections surface in the dialog, offline disables/re-enables the delete control, works for a 1-item note.
- [x] UT-039, UT-040, UT-041, UT-042, UT-043, UT-044 — `NotesQueueScreen`: quick-scan picks the highest-ratio note, tie resolves to earliest-opened, disabled with zero open notes, deleting reloads and removes the card, deleting the only note leaves the empty state, a 100%-but-open single note is still a valid quick-scan target.
- [x] UT-045, UT-046 — `deleteNote`/`del<T>`: sends `DELETE` and resolves on 204, rejects with `ApiError` on non-2xx.
- [x] E2E-001 — exclude a note with no scans from the queue, full confirm flow.
- [x] E2E-002 — cancel exclusion of a note with scanned progress, note remains untouched.
- [x] E2E-003 — offline: delete button disabled on every card.
- [x] E2E-004 — quick-scan button opens bipagem on the note closest to completion.
- [x] E2E-005 — "ver produtos" opens the specific clicked note regardless of completion level.

## Success Criteria
- Every assigned test case implemented and passing
- `NoteQueueCard` has no whole-card click target left; "Ver produtos" and "Excluir" are independent, correctly-labeled controls
- The quick-scan button never appears per-card, only once on the queue screen, and is disabled with zero open notes
- Deleting a note requires connectivity, shows a permanent-action warning with an accurate progress count when applicable, and never leaves the UI claiming success when the API call failed
- No regression in `NoteSearchForm.test.tsx` or `ScanScreen.test.tsx`
- Frontend typecheck and test suite are clean
