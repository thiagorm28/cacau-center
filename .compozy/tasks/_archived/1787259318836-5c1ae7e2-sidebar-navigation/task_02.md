---
status: completed
title: "Layout: NavDrawer component + Screen wiring"
type: frontend
complexity: high
---

# Task 2: Layout: NavDrawer component + Screen wiring

## Overview

Build the `NavDrawer` component — the core of this feature: a left-anchored overlay drawer with a trigger button, backdrop/swipe close, focus management, a role-scoped navigation list with active-item highlighting, user identity display, and a consolidated logout control — then wire it into the shared `Screen` component so it appears automatically on every authenticated screen. Remove the now-duplicated `LogoutButton` from six screens' headers, preserving the one screen (mandatory password change) that keeps its own standalone logout button.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `frontend/src/components/ui/NavDrawer.tsx`, exporting `NavDrawer(): JSX.Element | null` with no props — it derives everything from `useSession()`, `useLocation()`, and `useNavigate()`.
- MUST render `null` when `useSession().status !== "authenticated"`, `user === null`, or `user.mustChangePassword === true` (PRD Business Rules; ADR-001, ADR-004).
- MUST render a trigger button with an accessible name when visible; tapping it opens the panel.
- MUST render the panel as a left-anchored overlay with a darkened backdrop over the current screen (mirroring `Dialog.tsx`'s scrim pattern, anchored left instead of bottom — see TechSpec `Core Interfaces`).
- MUST close the panel when: the backdrop is tapped, the panel is swiped left past a distance threshold, or a nav item is selected — and MUST NOT close on a swipe that stops short of the threshold.
- MUST NOT introduce any new npm dependency — trigger icon is inline SVG, the open/close transition is CSS `transform`/`transition`, and swipe-to-close is hand-rolled from native `onTouchStart`/`onTouchMove`/`onTouchEnd` (ADR-006).
- MUST move DOM focus to the first focusable element inside the panel on open, and return focus to the trigger button on close (any close path).
- MUST render only the top-level nav items `getNavItemsForRole(user.role)` returns (from `navigation.ts`, built in task_01) — never a route the user's role cannot access.
- MUST visually mark the nav item matching the current top-level feature as active, including when the current route is a sub-flow of that feature (e.g. `/notas/:noteId/bipagem` → "Fila de notas" active).
- MUST navigate to a tapped item's path and close the drawer when the tapped item is not already active; MUST only close the drawer (no navigation call) when the tapped item is already active.
- MUST display the logged-in user's name and a human-readable role label at the top of the panel, with a non-blank fallback when `name` is empty and truncation styling for very long names.
- MUST render a single logout control at the bottom of the panel, visually separated from the nav list, that calls `useSession().signOut()`; a second rapid tap MUST NOT trigger a second effective invocation.
- MUST NOT persist open/closed state across reloads — always starts closed (PRD Non-Goals).
- MUST render `<NavDrawer />` inside `Screen.tsx` unconditionally (no new `ScreenProps`), so every current and future screen using `Screen` gets it automatically (ADR-004).
- MUST remove `header={<LogoutButton />}` from `NotesQueueScreen.tsx`, `ReportScreen.tsx`, `HistoryScreen.tsx`, `UsersScreen.tsx`, and `RequireRole.tsx`'s own "Acesso restrito" `Screen`.
- MUST remove only the `<LogoutButton />` element from `ScanScreen.tsx`'s two `Screen` usages, preserving the rest of each `header` (the "nota não encontrada" fallback's header becomes empty/removed entirely; the main return's header keeps its `<BigCounter />` block, just without `<LogoutButton />`).
- MUST NOT change `ChangePasswordScreen.tsx` — it keeps its own `header={<LogoutButton />}` unchanged, the sole exception to consolidation (ADR-002 amendment; without it, a user on that screen would have no way to end their session, since the drawer never appears there).
- MUST NOT edit `LogoutButton.tsx` itself — it keeps its one remaining consumer, `ChangePasswordScreen`; `NavDrawer` renders its own logout control rather than reusing `LogoutButton` (its wrapper styling is header-specific).
</requirements>

## Subtasks
- [x] 2.1 Build the trigger button (inline SVG icon, accessible name) and the visibility gate (`status`/`mustChangePassword` check).
- [x] 2.2 Build the overlay panel structure: backdrop, left-anchored sheet, open/close state, backdrop-tap-to-close.
- [x] 2.3 Implement the hand-rolled swipe-to-close gesture (touch handlers, distance threshold, live drag transform).
- [x] 2.4 Implement focus management: focus into the panel on open, focus back to the trigger on close.
- [x] 2.5 Build the role-scoped nav list using `getNavItemsForRole`, with active-item detection against `useLocation().pathname` (prefix match against each item's path, covering sub-flow routes).
- [x] 2.6 Wire nav item selection: navigate + close for non-active items, close-only for the active item.
- [x] 2.7 Build the identity display (name + human-readable role label, empty-name fallback, long-name truncation).
- [x] 2.8 Build the logout control (bottom of panel, calls `signOut()`, guards against a second effective tap while in flight).
- [x] 2.9 Wire `<NavDrawer />` into `Screen.tsx`.
- [x] 2.10 Remove `header={<LogoutButton />}` from the five straightforward screens and `RequireRole.tsx`'s restricted-access `Screen`.
- [x] 2.11 Remove only `<LogoutButton />` from `ScanScreen.tsx`'s two `Screen` usages, preserving `<BigCounter />` in the main return's header.
- [x] 2.12 Write all unit tests for `NavDrawer` (UT-005–UT-027) and the integration tests for `Screen` wiring and the six-screen cleanup (IT-001–IT-005, IT-009, IT-010).

## Implementation Details

See TechSpec `## Implementation Design — Core Interfaces` for `NavDrawer`'s signature and the `useSwipeToClose` internal hook shape, `## System Architecture — Component Overview` for the full component/data-flow picture, and `## Technical Considerations — Known Risks` for the touch-gesture and focus-management pitfalls this task must guard against (drag starting on an interactive nav item vs. empty panel space; focus lost to `<body>` on close).

`Screen.tsx`'s current body:
```tsx
<header className="px-6 pt-10 pb-12">
  <h1 className="font-heading text-title text-cream-1">{title}</h1>
  {subtitle === undefined ? null : <p className="mt-1 text-meta text-cream-3">{subtitle}</p>}
  {header}
</header>
```
`<NavDrawer />` is added here (no new `ScreenProps` field); the existing `header` slot keeps working for its one remaining consumer, `ChangePasswordScreen`.

`ScanScreen.tsx` has two `Screen` usages: the "nota não encontrada" early return (`header={<LogoutButton />}` only — full removal), and the main return (`header={<><LogoutButton /><div className="mt-6"><BigCounter .../></div></>}` — remove only the `<LogoutButton />` element, keep the `BigCounter` block).

### Relevant Files
- `frontend/src/components/ui/Screen.tsx` — gains `<NavDrawer />`; no `ScreenProps` change.
- `frontend/src/components/ui/Dialog.tsx` — closest existing overlay precedent (scrim `bg-choc-800/60`, sheet `role="dialog"`, `rounded-t-sheet`); `NavDrawer`'s panel mirrors this pattern anchored left, adapting the radius to the sheet's right edge. Note: `Dialog` itself has no backdrop-click-to-close, no focus trap, and no animation today — `NavDrawer` does not inherit these gaps, it implements them fresh per the requirements above.
- `frontend/src/components/ui/PillButton.tsx` — reusable for the drawer's logout control (`variant="secondary"`, matches `LogoutButton`'s existing styling choice).
- `frontend/src/session/SessionContext.tsx` — `useSession()` shape: `{ status, user, signOut, ... }`; `SessionUser` has `mustChangePassword: boolean`.
- `frontend/src/routes/navigation.ts` (from task_01) — `getNavItemsForRole(role)` feeds the nav list.
- `frontend/src/features/notes/NotesQueueScreen.tsx` — `header={<LogoutButton />}`, simple removal.
- `frontend/src/features/scan/ScanScreen.tsx` — two `Screen` usages; see the special-case removal above.
- `frontend/src/features/report/ReportScreen.tsx` — `header={<LogoutButton />}`, simple removal.
- `frontend/src/features/history/HistoryScreen.tsx` — `header={<LogoutButton />}`, simple removal.
- `frontend/src/features/users/UsersScreen.tsx` — `header={<LogoutButton />}`, simple removal.
- `frontend/src/routes/RequireRole.tsx` — its own "Acesso restrito" `<Screen title="Acesso restrito" header={<LogoutButton />}>`, simple removal; this screen is shown to an authenticated user with the wrong role, so it still gets the drawer trigger automatically via `Screen`, giving them a way out.
- `frontend/src/features/auth/ChangePasswordScreen.tsx` — unchanged; keeps `header={<LogoutButton />}`.
- `frontend/src/features/auth/LogoutButton.tsx` — unchanged; still used by `ChangePasswordScreen` only.
- `frontend/src/test/session.tsx` — `withSession()` helper and `OPERADOR` fixture for component/integration tests; use inline overrides for gerente/admin/mustChangePassword cases, following `RequireRole.test.tsx`'s existing pattern.

### Dependent Files
- All 6 screens listed above under Relevant Files — each loses its `header={<LogoutButton />}` prop (or, for `ScanScreen`, just the `<LogoutButton />` element).
- No existing test file references `LogoutButton` or a `"Sair"` button by name in Vitest specs (confirmed via repo-wide search) — no Vitest regressions expected from the removal itself, only the new coverage this task adds.

### Related ADRs
- [ADR-001: Global overlay navigation drawer, triggered from every authenticated screen](adrs/adr-001.md) — trigger placement, overlay pattern, closing behavior.
- [ADR-002: Consolidate logout into the navigation drawer, removed from per-screen headers](adrs/adr-002.md) — including its amendment: `ChangePasswordScreen` keeps its own logout button.
- [ADR-003: Drawer navigation list is scoped to top-level features by role, excluding account-action routes](adrs/adr-003.md) — nav list contents and active-item behavior on sub-flow routes.
- [ADR-004: Navigation drawer is embedded in the shared Screen component, self-deriving visibility from session state](adrs/adr-004.md) — this task's `Screen` wiring is ADR-004's entire implementation.
- [ADR-006: No new frontend dependencies — icon, animation, and swipe gesture are hand-rolled](adrs/adr-006.md) — governs the icon/animation/gesture implementation choices.

## Deliverables
- `frontend/src/components/ui/NavDrawer.tsx`, fully implemented per the requirements above.
- `Screen.tsx` rendering `<NavDrawer />` automatically.
- Six screens (`NotesQueueScreen`, `ScanScreen` ×2 usages, `ReportScreen`, `HistoryScreen`, `UsersScreen`, `RequireRole`'s restricted screen) with `LogoutButton` removed from their `Screen` header.
- `ChangePasswordScreen.tsx` verified unchanged.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-005, UT-006, UT-007, UT-008 — `NavDrawer` visibility by session state
- [x] UT-009, UT-010, UT-011, UT-012, UT-013, UT-014 — open/close via trigger, backdrop, and swipe
- [x] UT-015, UT-016 — focus management (focus in on open, focus back on close)
- [x] UT-017, UT-018, UT-019, UT-020, UT-021, UT-022 — role-scoped nav list, active item, navigation on tap
- [x] UT-023, UT-024, UT-025 — identity display (name, role label, empty-name fallback, truncation)
- [x] UT-026, UT-027 — logout control invocation and double-tap idempotency
- [x] IT-001, IT-002, IT-003 — `Screen` + `NavDrawer` visibility wiring (authenticated, mustChangePassword, anonymous/`LoginScreen`)
- [x] IT-004 — `ChangePasswordScreen` exception: its own logout button present, no drawer trigger
- [x] IT-005 — `NotesQueueScreen` (representative refactored screen): no standalone `LogoutButton` remains
- [x] IT-009 — drawer and trigger disappear when the session-expired listener fires while open
- [x] IT-010 — no inconsistent DOM state when a `popstate` event fires while the drawer is open

## Success Criteria
- Every assigned test case implemented and passing
- The drawer trigger appears automatically on every screen using `Screen`, except `LoginScreen` and `ChangePasswordScreen`
- `ChangePasswordScreen` remains the only screen with a standalone logout button; every other screen's only logout affordance is the drawer
- No new npm dependency appears in `frontend/package.json`
