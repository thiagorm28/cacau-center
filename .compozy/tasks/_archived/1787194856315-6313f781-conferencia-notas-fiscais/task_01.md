---
status: completed
title: Motor de alocação compartilhado
type: backend
complexity: medium
---

# Task 1: Motor de alocação compartilhado

## Overview

Estabelece a fundação do monorepo (npm workspaces) e implementa `shared`, o pacote
TypeScript puro que hospeda o algoritmo de alocação de bipagens (`resolveScan`). Esse
algoritmo precisa produzir exatamente o mesmo resultado quando rodado no `backend`
(fonte de verdade) e no `frontend` (feedback offline imediato) — é a base de que todas
as outras tarefas dependem.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create the root `package.json` with npm workspaces (`["shared"]` for now — Tasks 2 and 3 extend this array with `"backend"`/`"frontend"`).
- MUST implement `shared/src/allocation/types.ts` with `ScanResolution`, `PendingNoteItem`, `PendingNote` exactly as defined in `_techspec.md` (Core Interfaces).
- MUST implement `shared/src/allocation/resolveScan.ts` as a pure function (no I/O, no wall-clock reads — timestamps come in as input data) implementing the three-step algorithm from ADR-001: (1) match pending items by `cProd`/`cEan`, selecting the candidate note that maximizes total completion percentage after the credit, tie-broken by the oldest `openedAt`; (2) if no pending candidate exists but the code matches an already-complete item somewhere, resolve `"exceeded"` (same tie-break rule); (3) otherwise resolve `"unidentified"`.
- MUST export the public API via `shared/src/index.ts`.
- MUST follow `nodejs-typescript-conventions`: ESM only, no `any`, `const` by default, functional collection helpers (`filter`/`map`/`reduce`/`find`) over manual loops.
- MUST scaffold `shared/package.json`, `shared/tsconfig.json`, `shared/vitest.config.js` with zero framework dependencies (TypeScript + Vitest only) so both `backend` (NestJS) and `frontend` (React) can depend on it without pulling in unrelated runtime dependencies.
- MUST NOT introduce any Postgres/database concept in this package — `resolveScan` operates purely on the `PendingNote[]` shape passed in by its caller.
</requirements>

## Subtasks
- [x] 1.1 Create root `package.json` with npm workspaces (`shared`) and a root `test` script that fans out to workspace packages.
- [x] 1.2 Scaffold `shared/package.json`, `shared/tsconfig.json` (`strict: true`), `shared/vitest.config.js`.
- [x] 1.3 Define `PendingNoteItem`, `PendingNote`, `ScanResolution` in `shared/src/allocation/types.ts`.
- [x] 1.4 Implement pending-candidate matching (by `cProd`, falling back to `cEan`) across all open notes.
- [x] 1.5 Implement max-completion-percentage selection among multiple pending candidates.
- [x] 1.6 Implement FIFO tie-break by `openedAt` when the resulting completion percentage ties exactly.
- [x] 1.7 Implement `"exceeded"` detection (code matches an item that exists but is already fully confirmed everywhere it appears).
- [x] 1.8 Implement `"unidentified"` fallback (no match, pending or complete, in any open note).
- [x] 1.9 Export `resolveScan` and the domain types via `shared/src/index.ts`.
- [x] 1.10 Write UT-001–UT-010, including the ADR-001 reference scenario (10 panetones + 1 trufa across two notes) as an explicit multi-step test.

## Implementation Details

Reference `_techspec.md` → Implementation Design → Core Interfaces for the exact type
signatures (`shared/src/allocation/types.ts` code block) and the three-step algorithm
description. Reference ADR-001 for the full business rule (including the trufa
reference scenario) and ADR-006 for why this logic lives in a package shared between
`backend` and `frontend` rather than duplicated.

### Relevant Files
- `.compozy/tasks/conferencia-notas-fiscais/_techspec.md` — Core Interfaces section has the exact `resolveScan` signature and algorithm description to implement.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-001.md` — full business rule and the trufa reference scenario used as the canonical test case.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-006.md` — rationale for the shared-package split; explains why this logic must stay framework-free.
- `.compozy/tasks/conferencia-notas-fiscais/adrs/adr-007.md` — context on how `resolveScan`'s output feeds the event log both callers persist.
- `.claude/skills/nodejs-typescript-conventions/SKILL.md` — TypeScript/ESM conventions to follow in this package.
- `.claude/skills/vitest-testing/SKILL.md` — Arrange-Act-Assert structure, `describe`/`it` conventions for the unit suite.

### Dependent Files
- Root `package.json` — Tasks 2 and 3 will extend `workspaces` with `"backend"` and `"frontend"` respectively, and add `"shared": "*"` as a dependency in their own `package.json`.

### Related ADRs
- [ADR-001: Alocação dinâmica de bipagens entre notas concorrentes por proximidade de conclusão](adrs/adr-001.md) — the exact algorithm this task implements.
- [ADR-006: Monorepo com pacote compartilhado para o motor de alocação](adrs/adr-006.md) — why this is its own package.
- [ADR-007: Log de eventos de bipagem append-only com contadores denormalizados](adrs/adr-007.md) — how the output of this function is later persisted by consumers.

## Deliverables
- Root npm workspace configured with `shared` as a member.
- `shared` package fully implementing and exporting `resolveScan` and its types.
- UT-001–UT-010 implemented and passing.

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-001 — single note, `cProd` match → `matched`.
- [x] UT-002 — `cEan` fallback match → `matched`.
- [x] UT-003 — ADR-001 reference scenario (10 panetones + 1 trufa across two notes) → all credited to note 2.
- [x] UT-004 — exact completion-percentage tie → FIFO tie-break by `openedAt`.
- [x] UT-005 — three or more candidate notes → correct max-completion selection.
- [x] UT-006 — item already fully confirmed → `exceeded`.
- [x] UT-007 — code matches nothing anywhere → `unidentified`.
- [x] UT-008 — empty `openNotes` → `unidentified`.
- [x] UT-009 — note with one complete and one pending item → pending item still a valid candidate.
- [x] UT-010 — scanning the same products in different orders converges to the same final allocation.

## Success Criteria
- Every assigned test case implemented and passing
- `npm run test -w shared` (or equivalent workspace script) runs clean with no type errors
- `resolveScan` reproduces the exact ADR-001 AC-3 reference outcome (nota 2 completa, nota 1 intacta) under test
