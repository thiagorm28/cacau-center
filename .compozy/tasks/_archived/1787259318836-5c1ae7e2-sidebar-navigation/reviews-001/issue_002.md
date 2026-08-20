---
provider: manual
pr:
round: 1
round_created_at: 2026-08-20T20:02:54Z
status: resolved
file: frontend/src/components/ui/NavDrawer.tsx
line: 164
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Open drawer doesn't trap keyboard focus inside the panel

## Review Comment

`_prd.md`'s Accessibility section states: "the drawer behaves as a modal overlay — opening it moves focus into the drawer, closing it ... returns focus to the trigger button that opened it, and **the underlying screen is not interactable while the drawer is open**."

`NavDrawer.tsx` implements focus-in-on-open and focus-return-on-close (the `useEffect` at lines 102-110, covered by UT-015/UT-016), but nothing constrains `Tab`/`Shift+Tab` to stay inside the panel (`role="dialog"` at line 166) while it's open. In `Screen.tsx`, `<NavDrawer />` is rendered before the screen's `<h1>` and `<main>` content in the same DOM subtree (`frontend/src/components/ui/Screen.tsx:18-27`). When the drawer is open, its last focusable element is the "Sair" button; from there, `Tab` moves focus into `<main>`, into the current screen's real interactive controls (forms, buttons), which are only visually hidden behind the `bg-choc-800/60` backdrop (a `position: fixed` overlay affects pointer/click targeting, not keyboard focus order or accessibility-tree visibility). A keyboard or switch-device user can therefore operate the screen underneath while the drawer is visually covering it, which is exactly what the PRD says must not happen.

This isn't tested by the `_tests.md` contract (no UT/IT case asserts focus stays inside the panel), so it wasn't caught by the test suite; it also predates this feature in `Dialog.tsx` (which has no focus management at all), but `NavDrawer` explicitly claims `aria-modal="true"` and adds partial focus handling, so the gap is more visible here.

Suggested fix: add a `keydown` handler on the panel that, on `Tab`, cycles focus between the first and last elements matched by `FOCUSABLE_SELECTOR` inside `panelRef.current` (the standard modal focus-trap pattern), and/or mark the rest of the page `inert` (or `aria-hidden="true"`) while `isOpen` is `true`. A minimal trap only needs to run on `Tab`/`Shift+Tab` at the panel's boundary elements — no new dependency is needed, consistent with ADR-006.

## Triage

- Decision: `VALID`
- Notes: Confirmed — no `keydown` handling exists anywhere in `NavDrawer.tsx`, so `Tab` follows plain DOM order past the panel into `<main>`. Marking the rest of the page `inert` was considered but rejected: it would require `Screen.tsx` to know the drawer's open state, breaking the "NavDrawer is fully self-contained, zero props" design (ADR-004). Fix: kept the trap self-contained in `NavDrawer.tsx` — added an `overlayRef` on the outer overlay `<div>` (parent of both the backdrop button and the panel) and an `onKeyDown` handler on it that cycles `Tab`/`Shift+Tab` between the first (backdrop) and last (Sair) focusable elements within that container, so the backdrop's "Fechar menu de navegação" also becomes keyboard-reachable as the loop boundary.
