# TechSpec: Retractable Side Navigation Drawer

## Executive Summary

The drawer is implemented as one new self-contained component, `NavDrawer`, embedded once inside the existing shared `Screen` component (ADR-004) so it appears automatically on every screen without touching each screen's own logic — screens only lose the `header={<LogoutButton />}` prop they currently pass. `NavDrawer` derives its own visibility from `useSession()` (hidden unless authenticated and not mid-mandatory-password-change), reads its role-scoped item list from a new single-source-of-truth module (`navigation.ts`, ADR-005) that also replaces the role literals scattered across `App.tsx`, and hosts the consolidated logout action directly (reusing `signOut()`, not a new endpoint).

No new npm dependency is introduced (ADR-006): the trigger icon is inline SVG, the slide transition is a CSS `transform`/`transition`, and swipe-to-close is hand-rolled from native touch events. The one discovered gap — the mandatory password-change screen loses its only logout path if treated like the other six — is resolved by keeping that screen's existing standalone `LogoutButton`, unchanged, as the sole exception to consolidation.

## System Architecture

### Component Overview

| Component | Purpose | Boundary |
|---|---|---|
| `frontend/src/routes/navigation.ts` (new) | Single source of truth for the three top-level features: path, label, required role. Exposes `NAV_ROUTES`, `getNavItemsForRole`, `getHomePathForRole`. | Pure data/functions, no React, no I/O. |
| `frontend/src/components/ui/NavDrawer.tsx` (new) | Trigger button + overlay panel: visibility, open/close state, swipe gesture, focus management, role-scoped nav list, identity display, consolidated logout. | Reads `useSession()` and `useLocation()`; navigates via `useNavigate()`/`Link`. No props — fully self-contained. |
| `frontend/src/components/ui/Screen.tsx` (modified) | Renders `<NavDrawer />` unconditionally inside its header, alongside the existing title/subtitle/`header` slot. | No new props; `header` slot keeps working for the one remaining consumer (`ChangePasswordScreen`). |
| `frontend/src/App.tsx` (modified) | Routes and the post-login home redirect read role/path from `navigation.ts` instead of inline literals. | No routing behavior changes, only where the role/path values come from. |
| 6 screen files (modified) | Remove `header={<LogoutButton />}` now that `Screen` renders the drawer automatically. | `NotesQueueScreen.tsx`, `ScanScreen.tsx`, `ReportScreen.tsx`, `HistoryScreen.tsx`, `UsersScreen.tsx`, `RequireRole.tsx` (its own "Acesso restrito" `Screen`). |
| `ChangePasswordScreen.tsx` (unchanged) | Keeps its existing `header={<LogoutButton />}` — the sole exception (ADR-002 amendment). | No change. |

Data flow: `SessionContext` is the only source of "who is logged in / what role / must change password" — `NavDrawer` reads it directly, the same way `RequireRole` and `App.tsx` already do. `navigation.ts` is the only source of "which top-level features exist at which path for which role" — `NavDrawer`, `App.tsx`'s `<Route>` declarations, and the home-redirect calculation all read it. No new external system interactions; logout still goes through the existing `POST /auth/logout` via `signOut()`.

## Implementation Design

### Core Interfaces

```ts
// frontend/src/routes/navigation.ts
export interface NavRouteItem {
  path: string;
  label: string;
  role: UserRole; // required role; admin bypasses via getNavItemsForRole
}

export const NAV_ROUTES: readonly NavRouteItem[]; // [notas, historico, usuarios], fixed order
export function getNavItemsForRole(role: UserRole): readonly NavRouteItem[];
export function getHomePathForRole(role: UserRole): string;
```

```ts
// frontend/src/components/ui/NavDrawer.tsx
export function NavDrawer(): JSX.Element | null;
// Renders null unless useSession() gives status === "authenticated"
// && user !== null && !user.mustChangePassword.
```

```ts
// internal to NavDrawer.tsx — swipe-to-close (ADR-006, no gesture library)
function useSwipeToClose(active: boolean, onClose: () => void): {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  dragOffsetPx: number; // live drag distance, for the panel's transform
};
```

`Screen.tsx` gains one line in its existing header — `<NavDrawer />` rendered before the title — with no change to `ScreenProps`.

### Data Models

No new domain entities or storage. This is a client-side, session-derived UI feature: `NAV_ROUTES` is a static, compile-time constant (not fetched or persisted), and the drawer's open/closed state is local `useState`, intentionally not persisted across reloads (PRD Non-Goals).

### API Endpoints

None new. The drawer's logout control calls `useSession().signOut()`, the same function `LogoutButton` already calls today, which in turn calls the existing `POST /auth/logout`.

## Integration Points

None — this feature has no external service integration; it composes existing frontend session/routing state.

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|---|---|---|---|
| `frontend/src/routes/navigation.ts` | New | Single source of truth for top-level route/role mapping. Low risk (pure data). | Create file. |
| `frontend/src/components/ui/NavDrawer.tsx` | New | Core feature component: trigger, panel, gestures, focus, nav list, identity, logout. Medium risk (touch-gesture correctness, focus management). | Create file; cover with UT-001–UT-027. |
| `frontend/src/components/ui/Screen.tsx` | Modified | Renders `NavDrawer` automatically. Low risk, but every screen using `Screen` is affected. | Add one line; verify via IT-001–IT-003. |
| `frontend/src/App.tsx` | Modified | Route role literals and home-redirect ternary replaced by `navigation.ts` reads. Medium risk — touches working routing code. | Refactor; verify via IT-006, IT-007 (existing `RequireRole.test.tsx` must keep passing unchanged). |
| `NotesQueueScreen.tsx`, `ScanScreen.tsx`, `ReportScreen.tsx`, `HistoryScreen.tsx`, `UsersScreen.tsx`, `RequireRole.tsx` | Modified | Remove `header={<LogoutButton />}`. Low risk, mechanical. | Remove prop; verify via IT-005. |
| `ChangePasswordScreen.tsx` | Unchanged | Exception: keeps its own `LogoutButton` (ADR-002 amendment). | Verify via IT-004 that this stays true. |
| `LogoutButton.tsx` | Unchanged | Still used, but only by `ChangePasswordScreen` going forward. `NavDrawer` renders its own logout control directly (styling for a drawer footer differs from `LogoutButton`'s header-specific `mt-6 flex justify-end` wrapper). | None — no edits needed. |
| `RequireRole.tsx` (component logic) | Unchanged | Still receives a `role` prop and still special-cases admin bypass; only call sites change what they pass. | None beyond the header prop removal above. |
| `e2e/specs/gestao-usuarios-e2e-001-cadastro.spec.ts`, `-002-desativacao.spec.ts`, `-003-reset-senha.spec.ts`, `-004-logout.spec.ts` | Modified | All four assert `page.getByRole("button", { name: "Sair" })` directly, expecting logout visible on-screen without opening any menu — this breaks once logout moves into the drawer. `-004-logout` is the dedicated logout journey and needs the deepest rework (asserts the button is visible pre-click); the other three use it only as an incidental account-switch step mid-journey. High risk: silently broken E2E coverage if missed. | Add a shared `logout(page)` helper to `e2e/support/fixtures.ts` that opens the drawer and clicks its logout control; update all four specs to use it instead of the direct button query. |

## Testing Approach

Full case-by-case contract lives in `_tests.md`. Summary:

- **Frameworks**: Vitest + `@testing-library/react` + `@testing-library/user-event` (existing stack), `jsdom`. Session fixtures via the existing `withSession()` helper (`src/test/session.tsx`) and its role fixtures. Routing-dependent tests wrap components in `MemoryRouter` with an initial `pathname`/`initialEntries` to control `useLocation()`.
- **Unit**: `navigation.ts`'s pure functions, and `NavDrawer` in isolation (visibility by session state, open/close, swipe threshold, focus management, nav-list contents and active-item logic, identity display, logout invocation) — I/O boundaries (`signOut`, `useNavigate`) are the only fakes; nothing else is mocked.
- **Integration**: `Screen` + `NavDrawer` wired together with a real `SessionContext.Provider` (via `withSession`), verifying the drawer appears/disappears exactly where `Screen` is used across the real screen set, including the `ChangePasswordScreen` exception; a slice of the real `App.tsx` routes rendered in a `MemoryRouter` to verify actual navigation through the drawer and that the `navigation.ts` refactor didn't change role-gating or home-redirect behavior.
- **E2E**: one Playwright case (`playwright.config.ts`, existing `e2e` suite) covering the full critical path — login, open drawer, navigate via a nav item, reopen, logout — against the real backend on the dedicated E2E Postgres per `CLAUDE.md`.
- No new environment or data dependencies beyond what the existing Vitest and Playwright suites already require.

## Development Sequencing

### Build Order

1. `navigation.ts` — no dependencies; pure data module.
2. `App.tsx` refactor to read from `navigation.ts` — depends on step 1; verify existing routing tests still pass before moving on.
3. `NavDrawer.tsx` — depends on step 1 (`getNavItemsForRole`) and existing `useSession()`/`PillButton`.
4. `Screen.tsx` — depends on step 3 (renders `<NavDrawer />`).
5. Remove `header={<LogoutButton />}` from the 6 screens — depends on step 4 being in place (otherwise those screens would temporarily lose all logout access).
6. Test suites (`_tests.md`) — written alongside steps 1–5 per component, with the E2E case last once the full flow is wired end to end.

### Technical Dependencies

None external. No infrastructure, no third-party service, no other team's deliverable is required.

## Monitoring and Observability

No new monitoring. The feature adds no new network calls (logout reuses the existing `POST /auth/logout`, unchanged), no new backend surface, and no new failure mode beyond what `signOut()` already handles (failures are swallowed client-side today, per `SessionContext.tsx`'s existing `.catch(() => undefined)` — unchanged by this feature).

## Technical Considerations

### Key Decisions

- **Drawer embedded in `Screen`, self-deriving visibility** (ADR-004): zero new props across 7 call sites, versus a new layout wrapper (would require introducing `<Outlet>`/nested routes) or per-screen manual wiring (replicates the exact duplication this feature removes for logout).
- **Single shared route/role registry** (ADR-005): eliminates the 3-way duplication risk between `App.tsx`'s route guards, its home-redirect ternary, and the drawer's nav list, at the cost of refactoring working routing code.
- **No new dependencies** (ADR-006): inline SVG icon, CSS-transition animation, hand-rolled touch-event swipe — trades some gesture robustness for zero bundle growth in a mobile PWA.
- **Mandatory password-change screen keeps its own logout button** (ADR-002 amendment, discovered during this TechSpec): full consolidation would strand a user on that screen with no way to end the session, since the drawer intentionally never appears there.
- **`NavDrawer` renders its own logout control rather than reusing `LogoutButton`**: `LogoutButton`'s wrapper styling (`mt-6 flex justify-end`) is specific to sitting in a `Screen` header; a drawer footer wants different layout. `LogoutButton` itself is untouched and keeps its one remaining consumer, `ChangePasswordScreen`.

### Known Risks

- **Touch-gesture correctness** (ADR-006): a hand-rolled swipe-to-close has more edge cases than a library would absorb for free (drag starting on an interactive nav item vs. empty panel space, drag-cancel mid-gesture). Mitigated by dedicated boundary/happy-path unit cases (UT-013, UT-014) and by starting the swipe handler on the panel's non-interactive background area only.
- **`App.tsx` refactor regression risk** (ADR-005): replacing working literals with `navigation.ts` reads touches routing code with existing test coverage. Mitigated by requiring `RequireRole.test.tsx` and equivalent routing tests to pass unchanged, since only the source of the values changes, not the values themselves (IT-006, IT-007).
- **Focus management correctness**: hand-rolled focus-trap/return-focus (no library) is easy to get subtly wrong (e.g., focus lost to `<body>` on close). Mitigated by explicit unit coverage (UT-015, UT-016).
- **Existing E2E specs silently broken by logout consolidation**: four already-shipped specs (`gestao-usuarios-e2e-001` through `-004`) query the logout button directly on-screen; discovered during task planning, not in the original TechSpec pass. Mitigated by a shared `logout(page)` Playwright helper and updating all four call sites in the same task that builds the new drawer E2E coverage.

## Architecture Decision Records

- [ADR-001: Global overlay navigation drawer, triggered from every authenticated screen](adrs/adr-001.md)
- [ADR-002: Consolidate logout into the navigation drawer, removed from per-screen headers](adrs/adr-002.md) — amended to keep the mandatory password-change screen's own logout button.
- [ADR-003: Drawer navigation list is scoped to top-level features by role, excluding account-action routes](adrs/adr-003.md)
- [ADR-004: Navigation drawer is embedded in the shared `Screen` component, self-deriving visibility from session state](adrs/adr-004.md)
- [ADR-005: Extract a single shared route/role registry consumed by routing and the navigation drawer](adrs/adr-005.md)
- [ADR-006: No new frontend dependencies — icon, animation, and swipe gesture are hand-rolled](adrs/adr-006.md)
