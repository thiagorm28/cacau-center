---
status: completed
title: "Frontend: ver senha no login e na troca de senha"
type: frontend
complexity: low
---

# Task 3: Frontend: ver senha no login e na troca de senha

## Overview

Adiciona um botão de alternar visibilidade (ícone de olho) ao campo de senha do login e
aos dois campos independentes da tela de troca de senha, via um componente reutilizável
novo, `PasswordField`. É totalmente independente das outras três tasks — não compartilha
arquivo com nenhuma delas e pode rodar em paralelo com task_01 e task_02.

<critical>
- ALWAYS READ the PRD, the TechSpec, and their catalogs (`_user_stories.md`, `_tests.md`) before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — implement every test case assigned in ## Tests
</critical>

<requirements>
- MUST create `frontend/src/components/ui/PasswordField.tsx`, a reusable component wrapping the existing `FIELD`-styled password `<input>` plus a visibility-toggle `<button>`, with props `id`, `label`, `value`, `onChange: (value: string) => void`, `autoComplete: string`.
- MUST default the input to `type="password"` and toggle to `type="text"` and back on each click of the toggle button, via internal `useState` — no visibility state is lifted to the parent or persisted anywhere.
- MUST render the toggle as a real `<button type="button">` (not a `div`/`span`), with `aria-label="Mostrar senha"` while hidden and `aria-label="Ocultar senha"` while visible, and MUST NOT move focus away from the password `<input>` when the toggle is clicked.
- MUST use an inline SVG eye icon following `NavDrawer.tsx`'s icon convention exactly (`viewBox="0 0 24 24"`, `aria-hidden="true"` on the `<svg>`, `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`) — no external icon library.
- MUST replace `LoginScreen.tsx`'s raw password `<input>` with one `PasswordField` instance, without changing any other behavior of the login form (submission, error banner, expired-session banner).
- MUST replace both of `ChangePasswordScreen.tsx`'s raw password `<input>`s ("Nova senha", "Confirme a nova senha") with two independent `PasswordField` instances — toggling one MUST NOT affect the other's visibility state.
- MUST NOT change `ChangePasswordScreen.tsx`'s existing validation logic (`PASSWORDS_DO_NOT_MATCH`) or `LoginScreen.tsx`'s existing `signIn` call — only the input rendering changes.
- MUST reset to hidden on every fresh mount of a screen containing a `PasswordField` (no visibility persisted across navigation or reload).
</requirements>

## Subtasks
- [x] 3.1 Create `PasswordField.tsx` with the toggle state, the eye icon (open/closed variants or a single icon that visually communicates both states), and the `aria-label`/focus-preserving behavior.
- [x] 3.2 Replace `LoginScreen.tsx`'s password `<input>` with `PasswordField`, preserving `id="password"`, `autoComplete="current-password"`, and the existing `value`/`onChange` wiring to `password`/`setPassword`.
- [x] 3.3 Replace `ChangePasswordScreen.tsx`'s two password `<input>`s with two `PasswordField` instances (`id="new-password"`/`autoComplete="new-password"` and `id="confirm-password"`/`autoComplete="new-password"`), preserving the existing `value`/`onChange` wiring.
- [x] 3.4 Write `PasswordField` unit tests (UT-014–UT-018).
- [x] 3.5 Write `LoginScreen` unit tests for the new toggle behavior (UT-019–UT-021) — this is the first dedicated test file for `LoginScreen.tsx`.
- [x] 3.6 Extend `ChangePasswordScreen.test.tsx` with the two independent-toggle cases (UT-022–UT-023).
- [x] 3.7 Write the two E2E specs (E2E-006, E2E-007) under `e2e/specs/`, following the existing `e2e-NNN-<slug>.spec.ts` naming.
- [x] 3.8 Run the frontend test suite and typecheck; confirm no regression in existing `ChangePasswordScreen.test.tsx` cases.

## Implementation Details

Reference `_techspec.md` — Core Interfaces (`PasswordField`), Impact Analysis, and Key
Decisions (single shared component, three usages) for the rationale. `PasswordField`
reuses the existing `FIELD` Tailwind class string already defined in both
`LoginScreen.tsx` and `ChangePasswordScreen.tsx` (`"w-full rounded-pill bg-surface px-5 py-3 text-item text-text shadow-sm outline-none placeholder:text-cream-3 focus:ring-2 focus:ring-accent"`)
— move it into `PasswordField.tsx` as the single source of truth for that style, since
both screens currently duplicate the constant.

The toggle button sits inside the same visual field as the input (positioned via
`relative`/`absolute` in the wrapping `<div>`), sized per `DESIGN.md`'s touch-target
guidance, using `text-choc-600`/`text-choc-700`-family coloring for the icon (consistent
with `NavDrawer`'s icon color, which inherits `currentColor` from the button's text
color class) — do not introduce a new color outside the existing chocolate/terracota
palette.

### Relevant Files
- `frontend/src/features/auth/LoginScreen.tsx` — replace the password `<input>` (lines around the `id="password"` field) with `PasswordField`; keep `email`/`password`/`error`/`isSubmitting` state and `submit` handler untouched.
- `frontend/src/features/auth/ChangePasswordScreen.tsx` — replace both password `<input>`s (`id="new-password"`, `id="confirm-password"`) with `PasswordField`; keep `newPassword`/`confirmPassword`/validation/`submit` untouched.
- `frontend/src/features/auth/ChangePasswordScreen.test.tsx` — existing test file to extend with UT-022/UT-023; read it first to match its current mocking/rendering conventions before adding cases.
- `frontend/src/components/ui/NavDrawer.tsx` — source of the inline-SVG icon convention (`viewBox`, `aria-hidden`, `stroke="currentColor"`, etc.) to replicate exactly for the eye icon.
- `frontend/src/components/ui/PillButton.tsx`, `Banner.tsx` — read-only reference for how existing UI components in this codebase type their props and apply Tailwind classes; not modified by this task.
- `frontend/src/test/session.tsx` — `withSession`/`routed` test helpers required to render `LoginScreen`/`ChangePasswordScreen` in tests (both read the session/route context via `Screen`→`NavDrawer`).
- `frontend/src/features/scan/ScanScreen.test.tsx`, `frontend/src/features/notes/NoteSearchForm.test.tsx` — structural templates for component test conventions (`vi.mock("../../api/client", ...)`, `userEvent.setup()`, fixtures).
- `e2e/specs/` (existing specs, e.g. `e2e-001-bipagem-completa.spec.ts`) — naming/structure convention for the two new E2E specs; `e2e/support/` for shared Playwright fixtures/helpers.
- `DESIGN.md` — color/shape tokens (`rounded-pill`, chocolate/terracota palette) the new component must follow.

### Dependent Files
- None outside this task's own files — `PasswordField` has no other consumer in this PRD's scope, and no other task's files overlap with `LoginScreen.tsx`/`ChangePasswordScreen.tsx`.

## Deliverables
- `frontend/src/components/ui/PasswordField.tsx`, a reusable password input with visibility toggle.
- `LoginScreen.tsx` and `ChangePasswordScreen.tsx` updated to use it, with no other behavior change.
- Two new E2E specs under `e2e/specs/`.
- Every test case assigned in `## Tests` implemented and passing **(REQUIRED)**

## Tests

Cases assigned from `_tests.md`, the test contract — read each ID's full definition there before writing tests.

- [x] UT-014, UT-015, UT-016, UT-017, UT-018 — `PasswordField`: default hidden, toggle switches type back and forth, focus stays on the input, `aria-label` reflects state, works with an empty value.
- [x] UT-019, UT-020, UT-021 — `LoginScreen`: password field starts hidden, toggling doesn't break submission, remounting resets visibility to hidden.
- [x] UT-022, UT-023 — `ChangePasswordScreen`: the two password fields toggle independently, a validation error doesn't reset either field's visibility.
- [x] E2E-006 — login journey: toggle the password field visible and back, then sign in successfully.
- [x] E2E-007 — change-password journey: toggle both fields independently, confirm the values match, save successfully.

## Success Criteria
- Every assigned test case implemented and passing
- `PasswordField` is the only place the eye-icon/`aria-label`/focus-preserving logic exists — no duplicated toggle logic in either screen
- No regression in `ChangePasswordScreen.test.tsx`'s existing cases or `LoginScreen`'s existing submission/error behavior
- Frontend typecheck and test suite are clean
