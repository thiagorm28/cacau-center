---
provider: manual
pr:
round: 1
round_created_at: 2026-08-20T20:02:54Z
status: resolved
file: frontend/src/components/ui/NavDrawer.tsx
line: 88
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Drawer does not close on the browser/system back gesture

## Review Comment

`_user_stories.md` US-002.EC-1 states: "Usuário aciona o gesto/botão de voltar do sistema com a aba aberta → a aba fecha corretamente, sem deixar a tela em estado inconsistente" — the drawer must close when the user triggers the system back gesture while it's open. `NavDrawer.tsx` has no code path that reacts to browser back navigation: `location` (from `useLocation()`, line 88) is read only to compute `isActive`, and `isOpen` is never tied to `location` changing or to a `popstate` listener.

In production the app is wrapped in `BrowserRouter` (`frontend/src/main.tsx`), which does react to real `popstate` events. Today the drawer only ends up looking "closed" after a back gesture as an incidental side effect of React unmounting/remounting `Screen`/`NavDrawer` when the back navigation happens to land on a different route element (e.g., queue → bipagem → relatório, which are different `<Route>` elements). React Router does *not* remount the component when back-navigation lands on the same route pattern with a different param (e.g., two consecutive `/notas/:noteId/relatorio` history entries) — in that case the existing `NavDrawer` instance survives, `isOpen` stays `true`, and the drawer remains open over the newly-navigated screen with no way for the underlying content to be reached, because nothing ever explicitly closed it.

The integration test that's supposed to cover this edge case doesn't verify the specified behavior either: `NavDrawer.test.tsx`... actually `Screen.test.tsx`'s `IT-010` (`frontend/src/components/ui/Screen.test.tsx:109-122`) dispatches a raw `popstate` event and asserts the dialog panel `isConnected` is `true` (i.e., still open) — the opposite of what US-002.EC-1 specifies. The TechSpec's own IT-010 description narrows the requirement to "no inconsistent DOM state," silently dropping the "the drawer closes" part of the user story with no ADR documenting that trade-off.

Suggested fix: close the drawer whenever the route changes, not just on the three documented close paths. A `useEffect` keyed on `location.key` (or `location.pathname`) that calls `close()` when it changes covers both the explicit back-gesture requirement and the same-route-pattern edge case, e.g.:

```ts
const locationKey = location.key;
useEffect(() => {
  setIsOpen(false);
}, [locationKey]);
```

`IT-010` should then be updated to assert the dialog closes on `popstate`-driven navigation, not that it survives.

## Triage

- Decision: `VALID`
- Notes: Confirmed — `NavDrawer.tsx` has no handling tying `isOpen` to route changes at all, and `BrowserRouter` in `main.tsx` means real `popstate` events reach the app. Root cause: the drawer's close paths are limited to the three interaction handlers (backdrop, swipe, nav-item tap); nothing observes `location` changing for reasons outside those three. Fix: added a `useEffect` keyed on `location.key` that calls `close()` on every navigation, and rewrote `Screen.test.tsx`'s `IT-010` to actually exercise a `navigate(-1)`-driven back navigation and assert the dialog closes (previously it dispatched a `popstate` event `MemoryRouter` doesn't react to, and asserted the dialog stayed open — the opposite of the spec).
