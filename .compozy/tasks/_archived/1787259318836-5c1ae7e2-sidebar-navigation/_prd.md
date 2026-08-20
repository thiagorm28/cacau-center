# PRD: Retractable Side Navigation Drawer

## Overview

The app currently has no shared navigation surface: every screen is a standalone component with its own header, and there is no way for a user to move between the app's top-level features other than being redirected by role after login. Logging out is similarly inconsistent — a `LogoutButton` is manually placed in 7 different screen headers, one component import at a time, with no single source of truth.

This feature adds a retractable side navigation drawer, opened via a button present on every authenticated screen. The drawer lists the top-level features the current user's role can access, shows who is logged in, and hosts the single logout action. It replaces the scattered per-screen logout buttons with one consistent, predictable place to switch features or sign out — valuable both for Admin (who can reach every feature and benefits most from quick switching) and for single-feature roles (Operador, Gerente), who mainly gain a reliable, always-available way to log out.

## Goals

- Any authenticated user can open a side navigation drawer from wherever they are in the app (except during a mandatory password change) and see the top-level features their role allows them to reach.
- Tapping a feature in the drawer takes the user there directly, without hunting for a link or relying on browser back/forward.
- The user can always find the logout action in the same place — inside the drawer — instead of it being present or absent depending on which screen they happen to be on.
- The user can confirm at a glance which account (name and role) is currently logged in on the device, which matters because the app is used by different roles on shared devices.
- The drawer never becomes a way to bypass the mandatory password-change flow.

## User Stories

Full catalog: [User Stories](_user_stories.md)

- US-001 to US-002 — Abertura e fechamento: opening/closing the drawer (tap trigger, tap backdrop, swipe) from any permitted screen.
- US-003 — Navegação entre funcionalidades: role-scoped navigation list, active-item highlighting.
- US-004 — Identidade do usuário: name and role shown at the top of the drawer.
- US-005 — Logout consolidado: single logout action at the bottom of the drawer, replacing the 7 per-screen buttons.
- US-006 — Restrição durante fluxo obrigatório: drawer trigger hidden during mandatory password change.

## Core Features

### Drawer trigger

A button present in the header of every authenticated screen — fila de notas, bipagem, relatório, histórico, gestão de usuários — opens the drawer. It is absent on the (unauthenticated) login screen and on the mandatory password-change screen. Tapping it opens the drawer as a left-anchored overlay sliding in over a darkened backdrop, consistent with the app's existing bottom-sheet dialog pattern.

### Navigation list

The drawer shows the top-level features the current user's role can reach, using the same role rules the app already enforces (`operador` → fila de notas only; `gerente` → histórico only; `admin` → all three, including gestão de usuários). Drill-down screens reached from within a feature (bipagem, relatório of a specific note) are not listed as separate items — the parent feature ("Fila de notas") is shown as active while the user is inside one of those sub-flows. Tapping a different item navigates there and closes the drawer; tapping the already-active item just closes the drawer.

### User identity display

The top of the drawer shows the logged-in user's name and their role in readable form (e.g., "Administrador" rather than the raw role value). This lets a user confirm which account is active, particularly relevant since multiple roles may share a device.

### Consolidated logout

A single logout action sits at the bottom of the drawer, visually separated from the navigation list. It replaces the current per-screen `LogoutButton` placements on every screen except the mandatory password-change screen, which keeps its own standalone logout button since the drawer never appears there (see Business Rules). Tapping either logout control ends the session and returns the user to the login screen, exactly as logout behaves today.

### Interaction between features

The trigger, navigation list, identity display, and logout are all part of the same drawer component and open/close together as one unit. Navigating via the list or tapping logout both close the drawer as a side effect of leaving the current screen.

## Business Rules

- The drawer trigger is shown on every authenticated screen except the mandatory password-change screen; it is never shown to unauthenticated users.
- The navigation list's contents are derived from the same role-to-route mapping already enforced elsewhere in the app (`operador` → fila de notas; `gerente` → histórico; `admin` → fila de notas, histórico, gestão de usuários). The drawer must never show or link to a route the current role cannot access.
- The navigation list only ever contains top-level features, never sub-flow screens (bipagem, relatório) or account-action screens (troca de senha).
- Exactly one navigation item may be marked active at a time, corresponding to the current screen's parent feature.
- Logout exists in exactly one place in the UI: inside the drawer. No screen may have its own separate logout control — **except** the mandatory password-change screen, which keeps its own standalone logout button (unchanged from today) because the drawer never appears there; without this exception, a user on that screen would have no way to end their session.
- The drawer's open/closed state does not persist across page reloads; it always starts closed on a fresh load.
- While a mandatory password change is pending, no UI path (including the drawer) may let the user reach another feature without completing the change first — this is unchanged, existing behavior that the drawer must not weaken.

## User Experience

- **Personas**: Operador (single feature: fila de notas), Gerente (single feature: histórico), Admin (all features, including gestão de usuários).
- **Primary flow**: user is on any authenticated screen → taps the drawer trigger in the header → drawer slides in from the left over a darkened backdrop, showing their name/role at top, their role's feature list in the middle, and logout at the bottom → user taps a feature (navigates there, drawer closes) or taps the backdrop/swipes (drawer closes, stays on current screen) or taps logout (session ends, returns to login).
- **Discoverability**: because the trigger is present identically on every authenticated screen, the user only has to learn its location once.
- **Accessibility**: the drawer behaves as a modal overlay — opening it moves focus into the drawer, closing it (via any of the three close paths) returns focus to the trigger button that opened it, and the underlying screen is not interactable while the drawer is open.

## High-Level Technical Constraints

- Must reuse the app's existing role-checking logic as the source of truth for which navigation items appear — the drawer cannot introduce a second, divergent definition of who can see what.
- Must reuse the app's existing logout mechanism (session termination) unchanged — only its UI placement moves.
- Must work within a mobile-only, portrait-locked PWA with no existing responsive breakpoints; the drawer is not expected to support a desktop/wide-viewport layout.
- Must follow DESIGN.md's chocolate-and-cream visual language (colors, rounded-sheet aesthetic, typography) and be visually consistent with the existing `Dialog.tsx` overlay pattern.

## Non-Goals (Out of Scope)

- No voluntary "trocar senha" entry point is added to the drawer or anywhere else — the drawer's navigation list is limited to top-level business features (this preserves current behavior; there is no existing voluntary path to change password today either).
- No edge-swipe-to-open gesture (opening the drawer by swiping from the screen edge without touching the trigger button) — the drawer opens only via the trigger button; swipe is supported for closing only.
- No persistence of the drawer's open/closed state across reloads or sessions.
- No desktop/wide-viewport persistent sidebar variant — out of scope given the app's mobile-only nature.
- No changes to what routes each role can access — the drawer surfaces existing role rules, it does not change them.

## Architecture Decision Records

- [ADR-001: Global overlay navigation drawer, triggered from every authenticated screen](adrs/adr-001.md) — left-anchored overlay drawer, mirroring the existing `Dialog.tsx` scrim pattern, triggered from every authenticated screen except the mandatory password-change screen.
- [ADR-002: Consolidate logout into the navigation drawer, removed from per-screen headers](adrs/adr-002.md) — logout moves to a single bottom-anchored action inside the drawer, removed from the 7 screens that place it individually today.
- [ADR-003: Drawer navigation list is scoped to top-level features by role, excluding account-action routes](adrs/adr-003.md) — navigation list reuses existing role rules, lists only top-level features, excludes drill-down and account-action routes.

## Open Questions

None — every load-bearing branch (trigger placement, mandatory-password-change interaction, logout consolidation, drawer contents, closing behavior) was resolved during brainstorming.
