# Test Specification: Retractable Side Navigation Drawer

Canonical test contract for the retractable side navigation drawer. Companion to `_techspec.md`.
Derived from `_user_stories.md` (behavior) and `_techspec.md` (components).

## Strategy

- **Frameworks and harnesses**: Vitest, `@testing-library/react`, `@testing-library/user-event`, `jsdom` (existing stack). Session state is faked via the existing `withSession()` helper (`frontend/src/test/session.tsx`) and its role fixtures, wrapping components in `<SessionContext.Provider>` directly — no network. Routing-dependent cases wrap the component under test in `MemoryRouter` (react-router-dom v7) with a controlled `initialEntries`/pathname. `signOut()` and `useNavigate()` are the only faked I/O boundaries; nothing else is mocked.
- **Execution**: unit and integration cases run via the existing `vitest` frontend suite (colocated `*.test.tsx`). The end-to-end case runs via the existing root Playwright suite (`npm run test:e2e`, per `CLAUDE.md`), against the dedicated E2E Postgres (`npm run e2e:db:up`).
- **Conventions**: colocate new test files next to their component (`NavDrawer.test.tsx` next to `NavDrawer.tsx`, `navigation.test.ts` next to `navigation.ts`); table-driven cases for the three roles where the same assertion repeats per role (e.g. `getNavItemsForRole`, `getHomePathForRole`); test IDs referenced in `it.each`/`describe` titles per the project's existing `UT-045`-style convention (see `UserFormDialog.test.tsx`).

## Coverage Matrix

| Source | Behavior | Unit | Integration | E2E |
|---|---|---|---|---|
| US-001 | Open drawer from any permitted screen | UT-008, UT-009, UT-010 | IT-001, IT-003 | E2E-001 |
| US-001.EC-1 | Unauthenticated → no trigger | — | IT-003 | — |
| US-001.EC-2 | Mandatory password-change → no trigger | UT-007 | IT-002, IT-004 | — |
| US-001.EC-3 | Double-tap open is idempotent | UT-010 | — | — |
| US-001.EC-4 | Offline while open | n/a — `NavDrawer` has no network I/O; unaffected by connectivity by construction (UT-009–UT-014 don't mock a network layer, confirming none exists) | — | — |
| US-001.EC-5 | Session expires while open | — | IT-009 | — |
| US-002 | Close without navigating | UT-009, UT-011, UT-013 | — | E2E-001 |
| US-002.EC-1 | System back gesture while open | — | IT-010 | — |
| US-002.EC-2 | App loses OS focus while open | n/a — drawer open state is plain `useState`; no blur/visibility listener exists to reset it, so it holds by construction | — | — |
| US-002.EC-3 | Repeated close, no side effects | UT-012 | — | — |
| US-003 | Navigate to another feature, role-scoped | UT-017, UT-018, UT-019, UT-020 | IT-006, IT-008 | E2E-001 |
| US-003.EC-1 | Sub-flow screen highlights parent feature | UT-019 | — | — |
| US-003.EC-2 | Tapping the active item just closes | UT-021 | — | — |
| US-003.EC-3 | Direct URL to a disallowed route still blocked | — | IT-006 | — |
| US-003.EC-4 | Role with zero mapped items | UT-022 | — | — |
| US-004 | See name and role at top of drawer | UT-023 | — | E2E-001 |
| US-004.EC-1 | Empty user name → fallback identifier | UT-024 | — | — |
| US-004.EC-2 | Very long user name → truncated | UT-025 | — | — |
| US-005 | Logout from the drawer | UT-026 | — | E2E-001 |
| US-005.EC-1 | Rapid double-tap logout | UT-027 | — | — |
| US-005.EC-2 | Connection lost at logout tap | n/a — `signOut()`'s local state reset is synchronous and independent of the `POST /auth/logout` request outcome (existing `.catch(() => undefined)`); no new behavior introduced by this feature | — | — |
| US-005.EC-3 | Logout mid sub-flow, unsaved state lost | n/a — existing `signOut()` behavior, unchanged by this feature | — | — |
| US-005.EC-4 | Password-change screen keeps its own logout | — | IT-004 | — |
| US-006 | Drawer hidden during mandatory password change | UT-007 | IT-002 | — |
| US-006.EC-1 | Direct URL bypass attempt during forced change | n/a — pre-existing `RequirePasswordChange` redirect coverage, unaffected by this feature | — | — |
| `navigation.ts` | Role→items, role→home mapping | UT-001–UT-004 | — | — |
| `NavDrawer` — visibility | Show/hide by session state | UT-005–UT-008 | IT-001, IT-002, IT-003 | — |
| `NavDrawer` — open/close/gestures | Trigger, backdrop, swipe | UT-009–UT-014 | IT-010 | E2E-001 |
| `NavDrawer` — focus management | Focus in on open, focus back on close | UT-015, UT-016 | — | — |
| `NavDrawer` — nav list | Role-scoped items, active item, navigate | UT-017–UT-022 | IT-006, IT-008 | E2E-001 |
| `NavDrawer` — identity | Name/role display | UT-023–UT-025 | — | E2E-001 |
| `NavDrawer` — logout | Consolidated logout | UT-026, UT-027 | IT-004 | E2E-001 |
| `Screen` integration | Auto-renders `NavDrawer` everywhere | — | IT-001–IT-003, IT-009 | — |
| `App.tsx` routing refactor | Role/home sourced from `navigation.ts` | — | IT-006, IT-007 | — |

## Unit Tests

### `navigation.ts` (TechSpec: Implementation Design — Core Interfaces)

- **UT-001** (happy): `getNavItemsForRole("operador")` — given role `"operador"`, returns exactly one item whose `path` is `"/notas"`.
- **UT-002** (happy): `getNavItemsForRole("gerente")` — given role `"gerente"`, returns exactly one item whose `path` is `"/historico"`.
- **UT-003** (happy): `getNavItemsForRole("admin")` — given role `"admin"`, returns all three `NAV_ROUTES` items, in `NAV_ROUTES` order.
- **UT-004** (boundary): `getHomePathForRole` — for each of `"operador"`, `"gerente"`, `"admin"`, returns `"/notas"`, `"/historico"`, `"/usuarios"` respectively.

### `NavDrawer` — visibility (TechSpec: System Architecture — NavDrawer)

- **UT-005** (state): `useSession()` returns `status: "loading"` — `NavDrawer` renders `null` (no trigger button in the DOM).
- **UT-006** (state): `useSession()` returns `status: "anonymous"`, `user: null` — `NavDrawer` renders `null`.
- **UT-007** (state): `useSession()` returns an authenticated user with `mustChangePassword: true` — `NavDrawer` renders `null`.
- **UT-008** (happy): `useSession()` returns an authenticated user with `mustChangePassword: false` — the trigger button renders with an accessible name (e.g. "Abrir menu de navegação").

### `NavDrawer` — open/close and gestures

- **UT-009** (happy): user taps the trigger button — a panel with `role="dialog"` appears in the DOM.
- **UT-010** (idempotency): trigger tapped a second time while the panel is already open — exactly one `role="dialog"` node exists, no duplication.
- **UT-011** (happy): user taps the darkened backdrop element while open — the `role="dialog"` node is removed/hidden.
- **UT-012** (state): open → close via backdrop → open → close via backdrop again — each cycle ends with zero `role="dialog"` nodes and no accumulated DOM nodes or listeners.
- **UT-013** (happy): simulated `touchstart`/`touchmove`/`touchend` dragging the panel left past the close threshold — the panel closes.
- **UT-014** (boundary): simulated drag left that stops short of the close threshold — the panel remains open and its transform returns to the fully-open position.

### `NavDrawer` — focus management

- **UT-015** (happy): opening the drawer moves DOM focus (`document.activeElement`) to the first focusable element inside the panel.
- **UT-016** (happy): closing the drawer via the backdrop returns DOM focus to the trigger button that opened it.

### `NavDrawer` — navigation list and active item

- **UT-017** (happy): role `"operador"` — the rendered nav list contains exactly one item, "Fila de notas".
- **UT-018** (happy): role `"admin"` — the rendered nav list contains "Fila de notas", "Histórico", "Gestão de usuários", in that order.
- **UT-019** (state): current location `pathname` is `"/notas/n1/bipagem"` (a sub-flow route) — the "Fila de notas" item is rendered with active styling/state, and no separate item exists for the sub-flow route itself.
- **UT-020** (happy): user taps a nav item whose path differs from the current location — the navigate function is called with that item's path, and the drawer closes.
- **UT-021** (idempotency): user taps the nav item that is already active (matches current location) — the drawer closes and the navigate function is not called.
- **UT-022** (boundary): `getNavItemsForRole` returns an empty array for the current user (simulated boundary condition) — the nav list section renders empty while the identity display and logout control still render.

### `NavDrawer` — identity display

- **UT-023** (happy): `user.name = "Ana Souza"`, `user.role = "admin"` — the panel renders "Ana Souza" and a human-readable role label (e.g. "Administrador"), not the raw `"admin"` value.
- **UT-024** (boundary): `user.name = ""` — the panel renders a non-blank fallback identifier instead of an empty name area.
- **UT-025** (boundary): `user.name` is a very long string (e.g. 80 characters) — the name renders with truncation styling (`truncate`/`text-overflow` class present) rather than breaking the panel layout.

### `NavDrawer` — logout

- **UT-026** (happy): user taps the drawer's logout control — the faked `signOut()` from `useSession()` is called exactly once.
- **UT-027** (idempotency): user taps the drawer's logout control twice in rapid succession before the first call resolves — `signOut()`'s user-visible effect happens exactly once (second tap is a no-op, e.g. because the control is disabled once activated).

## Integration Tests

### `Screen` + `NavDrawer` wiring (TechSpec: Impact Analysis — Screen.tsx)

- **IT-001**: render a `Screen` inside `withSession()` with an authenticated, `mustChangePassword: false` user — the drawer trigger is present in the rendered output, with no prop on `Screen` requesting it.
- **IT-002**: render a `Screen` inside `withSession()` with an authenticated user where `mustChangePassword: true` — no drawer trigger is present.
- **IT-003**: render `LoginScreen` (real `SessionProvider` flow resolving to `status: "anonymous"`) — no drawer trigger is present.
- **IT-004**: render `ChangePasswordScreen` — its own standalone `LogoutButton` is present, and no drawer trigger is present (US-005.EC-4 exception).
- **IT-005**: render `NotesQueueScreen` (representative of the six refactored screens) with an authenticated session — no standalone `LogoutButton` remains in its header; the drawer trigger is the only logout affordance.

### `App.tsx` routing regression (TechSpec: Impact Analysis — App.tsx)

- **IT-006**: with roles sourced from `navigation.ts`, an `operador` session is still blocked from `/usuarios` and an `admin` session still bypasses every role check (mirrors existing `RequireRole.test.tsx` assertions, now exercised against the refactored call sites).
- **IT-007**: the `"/"` redirect resolves to `/notas`, `/historico`, `/usuarios` for `operador`, `gerente`, `admin` respectively, now computed via `getHomePathForRole`.

### Drawer-driven navigation (TechSpec: System Architecture)

- **IT-008**: render a representative slice of the real app routes in a `MemoryRouter` as an `admin` session; open the drawer and tap "Histórico" — the rendered route content changes to the Histórico screen and the drawer closes.
- **IT-009**: with the drawer open, trigger the session-expired path (fire the `api` session-expired listener used by `SessionContext`) — the drawer and its trigger disappear along with the rest of the authenticated UI, with no thrown error.
- **IT-010**: with the drawer open inside a `MemoryRouter`, dispatch a `popstate` event (simulating the system back gesture) — no inconsistent DOM state results (no orphaned `role="dialog"` node detached from a valid route).

## End-to-End Tests

### Open, navigate, and log out via the drawer (US-001, US-003, US-004, US-005)

- **E2E-001**: log in as an admin user through the real login form → tap the drawer trigger → observe the user's name, role label, and all three nav items ("Fila de notas", "Histórico", "Gestão de usuários") → tap "Histórico" → land on the Histórico screen with the drawer closed → reopen the drawer → tap the logout control → land on the login screen and confirm navigating back does not restore access to `/usuarios`.
