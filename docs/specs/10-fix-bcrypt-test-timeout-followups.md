# Spec: bcrypt salt-round follow-ups

(references Spec: `docs/specs/10-fix-bcrypt-test-timeout.md`)

## Goal
Close the review gaps left by the bcrypt timeout fix: give the "production
default is 12" rule real test coverage, stop a bad `saltRounds` value from
hanging a request, and remove the dependency on module-import order when
reading `NODE_ENV`.

## Current state
`backend/src/routes/auth.ts` exports `DEFAULT_BCRYPT_SALT_ROUNDS`, a module-level
constant computed at import time. Because the value is frozen at import, no test
can flip `NODE_ENV` and observe the result, so the production default of 12 is
only guaranteed by code inspection. The test suite asserts the constant equals 4
in the current environment, which restates the ambient environment rather than
testing behaviour.

`createAuthRouter` accepts `options.saltRounds` with no validation. bcryptjs
clamps only the low end of the range (0 becomes 10, 1–3 become 4) and silently
accepts anything above 31 — a value of 32 makes the process compute 2^32
iterations instead of raising, so a typo would hang the server rather than fail.

The plan for the original task also records test counts and timings that no
longer match the repo, and `docs/TESTING.md` was already stale.

## What needs to change
- In `backend/src/routes/auth.ts`:
  - Replace the import-time constant with a `defaultSaltRounds(env)` function
    that takes the environment as an argument (defaulting to `process.env`), so
    the rule is callable and testable at any point.
  - Validate `AuthRouterOptions` with a zod schema bounded to bcrypt's real
    range (4..31), parsing inside `createAuthRouter` so an invalid value fails
    fast at router construction rather than hanging on a request.
  - Keep 4 for `NODE_ENV === 'test'` and 12 otherwise.
- In `backend/src/routes/auth.test.ts`:
  - Replace the ambient-environment assertion with tests of `defaultSaltRounds`
    covering the test branch and the production/development branch.
  - Add tests that an out-of-range or non-integer `saltRounds` throws.
- In `backend/src/index.ts`:
  - Refuse to boot when `NODE_ENV === 'test'`, matching the existing
    `SESSION_SECRET` guard, so a misconfigured deployment cannot silently run
    with test-strength hashes.
- In `docs/`:
  - Correct the recorded test counts and timings in
    `docs/plans/10-fix-bcrypt-test-timeout.md`.
  - Refresh the suite counts in `docs/TESTING.md`.

## Out of scope
- Changing the production salt rounds away from 12.
- Changing the 4-round test default, the `testTimeout`, or any test assertion
  from the original task.
- Async hashing (replacing `hashSync`).
- Any frontend change.

## Acceptance criteria
- `defaultSaltRounds` is a pure function of its environment argument; no module
  in `auth.ts` reads `process.env` at import time.
- Tests prove the rule yields 4 for `NODE_ENV=test` and 12 for both
  `NODE_ENV=production` and `NODE_ENV=development`.
- `createAuthRouter` throws for `saltRounds` of 3, 32, and 4.5, and never
  reaches `hashSync` in those cases.
- `backend/src/index.ts` throws at startup when `NODE_ENV === 'test'`.
- `pnpm test` and `pnpm build` pass; auth tests stay under 2 seconds.