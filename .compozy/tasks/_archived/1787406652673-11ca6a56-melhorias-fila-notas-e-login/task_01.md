---
status: completed
title: "Shared: extrair comparador de conclusão e adicionar pickQuickScanNote"
type: backend
complexity: medium
---

# Task 1: Shared: extrair comparador de conclusão e adicionar pickQuickScanNote

## Overview

Extrai a técnica de comparação cruzada e desempate por `openedAt` que `resolveScan`
já usa internamente para um módulo próprio de `shared/`, e adiciona uma nova função,
`pickQuickScanNote`, que a reaproveita para escolher a nota aberta mais próxima da
conclusão. Essa função é a base do atalho de bipagem rápida (task_04) — nenhuma outra
task depende deste pacote, mas o task_04 não pode ser implementado sem ele.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST NOT change `resolveScan`'s observable behavior — `shared/src/allocation/resolveScan.test.ts` MUST pass with zero assertion changes; a diff there signals a regression, not a stale test (ADR-006, Risks).
- MUST extract the cross-multiplication comparator and `openedAt` parser into a new internal module, `shared/src/allocation/completionOrder.ts`, exporting `isCloserToCompletion` and `parseOpenedAt` with the exact arithmetic currently inline in `resolveScan.ts`'s `isBetterCandidate`/`parseOpenedAt`.
- MUST refactor `resolveScan.ts`'s internal `isBetterCandidate` to delegate to `isCloserToCompletion` from the new module (adapting `ScanCandidate` fields into the shared shape), removing the local `parseOpenedAt` duplicate.
- MUST add `shared/src/allocation/pickQuickScanNote.ts` exporting `pickQuickScanNote(openNotes: readonly OpenNoteSummary[]): string | null` and the `OpenNoteSummary` interface (`noteId`, `openedAt`, `confirmedTotal`, `expectedTotal`), using `isCloserToCompletion`/`parseOpenedAt` from `completionOrder.ts`.
- MUST return `null` from `pickQuickScanNote` when given an empty array, and MUST NOT divide by zero or throw when a note has `expectedTotal: 0`.
- MUST export `pickQuickScanNote` and `OpenNoteSummary` from `shared/src/index.ts` (package root). `completionOrder.ts` stays internal — do not export it from the root.
- MUST keep `resolveScan` and its existing exported type contract (`PendingNote`, `PendingNoteItem`, `ScanResolution`) unchanged.
</requirements>

## Subtasks
- [x] 1.1 Create `shared/src/allocation/completionOrder.ts` with `CompletionCandidate`, `parseOpenedAt`, and `isCloserToCompletion`, matching the exact arithmetic already in `resolveScan.ts`.
- [x] 1.2 Refactor `resolveScan.ts`'s `isBetterCandidate` and remove its local `parseOpenedAt`, delegating both to the new module without changing any other function in the file.
- [x] 1.3 Run `shared`'s existing test suite and confirm `resolveScan.test.ts` passes with no assertion changes.
- [x] 1.4 Create `shared/src/allocation/pickQuickScanNote.ts` with the `OpenNoteSummary` interface and the `pickQuickScanNote` function.
- [x] 1.5 Update `shared/src/index.ts` to export `pickQuickScanNote` and `OpenNoteSummary`.
- [x] 1.6 Write unit tests for `completionOrder.ts` (UT-006–UT-009).
- [x] 1.7 Write unit tests for `pickQuickScanNote` (UT-010–UT-013).
- [x] 1.8 Write the package-export integration test (IT-012), verifying both `resolveScan` and `pickQuickScanNote` resolve when imported from the package root.
- [x] 1.9 Run `npm run typecheck` and `npm test` inside `shared/` and confirm both are clean.

## Implementation Details

Reference `_techspec.md` — Core Interfaces, ADR-006 (`adrs/adr-006.md`) for the exact
signatures and the rationale for extracting rather than duplicating. The extraction must
be mechanical: `resolveScan.ts`'s `isBetterCandidate(candidate, incumbent)` becomes a
thin adapter that builds two `CompletionCandidate` objects
(`{ confirmedQty: candidate.confirmedAfterScan, totalExpected: candidate.totalExpected, openedAtMs: candidate.openedAtMs }`)
and calls `isCloserToCompletion`. Do not touch `collectCandidates`, `selectBestCandidate`,
`matchesScannedCode`, `isPending`, `isFullyConfirmed`, or `resolveScan` itself.

`pickQuickScanNote` reduces over `openNotes`, keeping the note that `isCloserToCompletion`
judges best relative to the current winner — same reduction shape as `resolveScan`'s own
`selectBestCandidate`, but over a flat list of note summaries instead of per-item
candidates built from `PendingNote[]`.

### Relevant Files
- `shared/src/allocation/resolveScan.ts` — contains the comparator/tie-break logic to extract; refactor its `isBetterCandidate`/`parseOpenedAt` without changing `resolveScan`'s exported behavior.
- `shared/src/allocation/resolveScan.test.ts` — existing regression suite; must pass unmodified after the refactor.
- `shared/src/allocation/types.ts` — existing `PendingNote`/`PendingNoteItem`/`ScanResolution` types; not modified, but shows the sibling-file convention for `OpenNoteSummary`'s new file.
- `shared/src/index.ts` — package root export barrel; add `pickQuickScanNote`/`OpenNoteSummary` here.
- `shared/package.json` — confirms `test`/`typecheck` scripts (`vitest run`, `tsc -p tsconfig.json --noEmit`) to run before declaring the task done.
- `shared/tsconfig.build.json` — build config; not modified, but new files must compile under it since `npm run build` (the package's `prepare` script) runs `tsc -p tsconfig.build.json`.

### Dependent Files
- `backend/src/application/usecase/ApplyScanEvent.ts` — imports `resolveScan` from `"shared"`; must keep working identically since this task changes `resolveScan`'s internals but not its behavior. Do not modify this file.
- `frontend/src/features/notes/NotesQueueScreen.tsx` — the consumer of `pickQuickScanNote`, implemented in task_04, which depends on this task's exports existing first.

### Related ADRs
- [ADR-006: Comparador de conclusão extraído de `resolveScan` para `shared`, reaproveitado pelo atalho de bipagem rápida](adrs/adr-006.md) — the decision this task implements directly, including the rejected alternative (frontend-only duplicate) and the regression-risk mitigation.

## Deliverables
- `shared/src/allocation/completionOrder.ts` with `isCloserToCompletion`/`parseOpenedAt`, consumed by both `resolveScan.ts` and `pickQuickScanNote.ts`.
- `shared/src/allocation/resolveScan.ts` refactored to delegate to `completionOrder.ts`, with zero behavior change.
- `shared/src/allocation/pickQuickScanNote.ts` with `pickQuickScanNote`/`OpenNoteSummary`.
- `shared/src/index.ts` exporting `pickQuickScanNote`/`OpenNoteSummary` alongside the existing exports.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-006, UT-007, UT-008, UT-009 — `completionOrder.ts` (`isCloserToCompletion`, `parseOpenedAt`): higher-ratio wins, exact-tie resolves by `openedAtMs`, 0/0 vs. nonzero doesn't divide by zero, invalid date parses to `+Infinity`.
- [x] UT-010, UT-011, UT-012, UT-013 — `pickQuickScanNote`: picks highest ratio among 3, tie resolves to earliest `openedAt`, empty array returns `null`, a 0/0 note never outranks a nonzero-ratio note.
- [x] IT-012 — `shared` package root exports: `resolveScan` and `pickQuickScanNote` both resolve as callable functions when imported from `"shared"`, and `resolveScan.test.ts`'s existing behavior is unaffected by the `completionOrder.ts` extraction.

## Success Criteria
- Every assigned test case implemented and passing
- `resolveScan.test.ts` passes with no assertion changes (verified by running the existing suite, not by inspection alone)
- `npm run typecheck` and `npm test` are clean inside `shared/`
- `pickQuickScanNote` and `OpenNoteSummary` are importable from `"shared"` at the package root
