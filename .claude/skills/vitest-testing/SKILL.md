---
name: vitest-testing
description: Guides Vitest-based unit and integration tests with vi mocks, Arrange-Act-Assert, fake timers for Date, HTTP endpoint integration tests without supertest, use-case and domain coverage. Do not use for Jest-centric projects or Sinon as primary mocking.
---

# Vitest testing

## Procedures

**When authoring or refactoring tests**

1. Use Vitest for scenarios and expectations (`describe`, `it`, `expect`). Use Vitest **`vi`** for mocks, spies, and stubs (`vi.fn`, `vi.spyOn`, `vi.mock`, `vi.useFakeTimers`, and related APIs).
2. Do not use Jest or Sinon as the primary mocking stack for those roles.
3. Run tests via `npm run test` (script invokes Vitest) or `npx vitest`, matching the repository setup.
4. Place tests under the folder pattern appropriate to the stack; keep file extensions aligned with tooling (for example `.test.ts` / `.spec.ts`).
5. Avoid dependencies between tests so each example runs independently.
6. Structure each test using Arrange–Act–Assert or Given–When–Then for clarity.
7. When behavior depends on `Date` relative to assertions, configure Vitest fake timers and fixed system time; restore real timers in `afterEach`.
8. When tests touch HTTP, databases, messaging, filesystems, or other externals, name or organize them explicitly as integration tests.
9. Add HTTP endpoint tests only as integration tests; omit Supertest-style libraries per project policy.
10. Keep HTTP endpoint tests scoped to principal and alternate flows (status codes and error messages); push business-rule permutations down to use-case tests.
11. Cover all use cases: primary paths plus at least one alternate path that throws; mock externals via `vi.fn` or `vi.mock`.
12. Cover domain logic thoroughly at unit level without external dependencies.
13. Aim for one observable behavior per test; keep descriptions concise and intent-revealing.
14. Maintain coverage proportionate to new or changed logic; align expectations with behavior that materially matters.
15. Close DB or messaging handles after suites or cases when the stack requires teardown.
16. Use `beforeEach` from Vitest when setup is repeatable; use `afterEach` when releasing connections or mocks.

## Error Handling

1. When timer-related flakes appear around `Date` or timeouts, revisit fake timer lifecycle (`beforeEach` / `afterEach`) and deterministic clock setup.
2. When integration suites pollute shared state, isolate fixtures and ensure teardown resets global mocks and connections.
