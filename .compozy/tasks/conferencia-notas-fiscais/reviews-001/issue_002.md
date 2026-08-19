---
provider: manual
pr:
round: 1
round_created_at: 2026-08-18T04:40:33Z
status: resolved
file: frontend/src/hooks/useBarcodeScanner.ts
line: 76
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Debounce keyed on value+time silently drops distinct boxes with the same code

## Review Comment

`acceptCode` suppresses a decoded code whenever the *same value* was accepted less than
`debounceMs` (1200ms) ago, regardless of whether it's actually the same physical box
still in frame or a different box that happens to share the same `cProd`/EAN:

```ts
const acceptCode = useCallback((code: string) => {
  const now = Date.now();
  const last = lastScanRef.current;
  if (last !== null && last.code === code && now - last.at < debounceMs) return;
  lastScanRef.current = { code, at: now };
  onScanRef.current(code);
}, [debounceMs]);
```

US-004.EC-1 frames the requirement as detecting "o mesmo frame duas vezes" (the same
physical presentation read across consecutive camera frames) — i.e. de-duplicating
redundant reads of *one* box. But every box of the same product shares the same
barcode, and this is the single most common case in this product's own domain: a
delivery with several identical panetone/trufa boxes stacked together. An operator
scanning two *different* physical boxes of the same product within 1.2s of each other
(a very plausible pace for the "fluxo rápido, uma mão" the PRD asks for) has the second,
legitimate scan silently discarded — no error, no warning, the counter just doesn't
move. There is no motion/frame-identity signal (e.g. requiring the code to disappear
from view before re-arming), so the mechanism cannot actually distinguish "same box,
multiple frames" from "different box, same code."

This directly undermines the PRD Goal "o sistema sempre indica com certeza se ela está
completa" — a fast operator can under-scan without any indication that a box was
skipped, and would only notice via a final count mismatch requiring a recount.
`UT-046` only covers the identical-frame case; there's no test for two distinct scans
of the same code within the debounce window.

Suggested fix: reset `lastScanRef` once the code is no longer detected in-frame for at
least one decode cycle (i.e., debounce only consecutive *frames*, not a fixed wall-clock
window across arbitrary future scans), or surface a distinct "leitura repetida
ignorada" banner so a suppressed scan is at least visible to the operator instead of
silent.

## Triage

- Decision: `VALID`
- Notes:

**Root cause.** `acceptCode` suppressed a code purely on `(value, wall-clock)`:
`last.code === code && now - last.at < debounceMs`. The predicate has no signal about
whether the barcode is *still in the camera frame*, so it cannot distinguish "same box
read across consecutive frames" (what US-004.EC-1 asks to de-duplicate) from "second
physical box of the same product" (the dominant case in this domain — identical
panetone/trufa boxes in one delivery). Any second box scanned within 1200ms of the
first was dropped silently: no error, no counter movement, no banner.

The e2e harness is independent evidence that the wall-clock window was the wrong
contract: `e2e/support/fakeCamera.ts` had to define `REPEAT_GUARD_MS = 1400` and sleep
before re-showing the same code, i.e. the test suite works *around* the drop instead of
exercising the real operator pace.

**Fix approach.** Adopted the reviewer's first suggestion (frame identity), which is
strictly better than a banner because it makes the count correct rather than merely
reporting that it is wrong. Suppression is now tied to *presence*, not to the clock:

- `inFrameRef` holds `{ code, emptyFrames }` for the code currently understood to be in
  view. A decoded value equal to `inFrameRef.current.code` is the same physical box and
  is suppressed for as long as it stays in view — now with no upper time bound, which is
  also a fix for the inverse defect (a box held steady for longer than `debounceMs` used
  to be double-counted).
- The scanner re-arms only after `rearmAfterEmptyFrames` (default 2) consecutive decode
  cycles in which ZXing found *no symbol at all* (`results.length === 0`). Once re-armed,
  the same code counts as a new box. Two cycles ≈ 500ms at the default 250ms interval:
  long enough to ride out one dropped frame while a box is held steady, short enough that
  a real box swap re-arms well within the operator's pace.
- A decode cycle that produced a symbol but rejected it as partial/invalid (US-004.EC-2)
  deliberately does *not* count as an empty frame: a blurred read means the box is still
  in view, so treating it as absence would risk double-counting.
- Cycles that never reached the decoder (video not ready, decoder throw, overlapping
  cycle skipped by `decodingRef`) also do not count — absence must be observed, not
  assumed.
- `inFrameRef` is cleared on effect teardown, so re-enabling the camera (e.g. after the
  manual-item or finalize dialog closes) never carries stale suppression into the new
  session.

The `debounceMs` option was replaced by `rearmAfterEmptyFrames`; leaving `debounceMs` in
place would have been a no-op option advertising a guarantee the hook no longer makes.
`ScanScreen` never passed it, so no caller changed.

**Tests.** `UT-046` is kept (it is still the correct frame-duplicate contract) and three
regression tests were added to `frontend/src/hooks/useBarcodeScanner.test.tsx`: two
distinct boxes sharing a code, separated by empty frames, now fire `onScan` twice; a
single dropped frame does *not* re-arm; and a partial/invalid read does not re-arm
either. The scope note: no file outside `<batch_scope>` was modified —
`e2e/support/fakeCamera.ts` keeps its 1400ms guard, which is now merely conservative
(it clears the frame after every scan, so the new presence-based re-arm covers it) and
its removal is a separate cleanup, not part of this fix.


**Verification.** `npm run typecheck` (shared + backend + frontend + e2e) passes, `npm run build`
passes, and the frontend suite is green at 28/28 including the four `useBarcodeScanner`
scenarios. The new re-arm test was checked for non-vacuousness: raising
`rearmAfterEmptyFrames` to 999 (the old always-suppress behaviour) makes it fail, and it
passes at the default of 2.

Pre-existing environmental failure, unrelated to this fix: the four backend *integration*
suites (`auth`, `notes-lifecycle`, `sync`, `history-report`, 28 tests) abort at
`startTestApp` with `connect ECONNREFUSED 127.0.0.1:5432` — no PostgreSQL is running and
`docker` is unavailable in this WSL distro, so `docker-compose.yaml` cannot bring it up.
All 35 backend *unit* tests pass. The E2E suite is blocked by the same missing database.
This diff touches only `frontend/src/hooks/useBarcodeScanner.ts` and its test file.

**Spec follow-up (not applied here, outside batch scope).** Two artifacts now describe the
old mechanism rather than the contract:
- `_tests.md` phrases UT-046 as "dois frames idênticos dentro da *janela de debounce*". The
  behavioural assertion it specifies is unchanged and still passes; only the mechanism
  wording is stale. The canonical acceptance criterion in `_user_stories.md` US-004.EC-1 —
  "conta apenas uma bipagem **por caixa física apresentada**" — is what the new code
  satisfies and what the old wall-clock window violated.
- `e2e/support/fakeCamera.ts` keeps `SCANNER_DEBOUNCE_MS`/`REPEAT_GUARD_MS` (1400ms waits
  between repeats of the same code). Now merely conservative rather than required, since
  `BoxScanner.scan` already clears the frame after every scan, which is exactly the
  absence signal the hook now uses to re-arm.
