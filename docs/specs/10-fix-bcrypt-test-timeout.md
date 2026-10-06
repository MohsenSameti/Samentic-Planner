# Spec: Fix bcrypt test timeout and speed up auth tests

## Goal
Eliminate test timeouts and suite flakiness on slow hardware by reducing bcrypt salt rounds in test environments and bumping backend Vitest timeout.

## Current state
`backend/src/routes/auth.ts` hardcodes `BCRYPT_SALT_ROUNDS = 12`.
In `backend/src/routes/auth.test.ts`, tests execute multiple bcrypt hashes and comparisons in sequence (such as password change executing two hashes and three comparisons).
On slow hardware, individual tests can exceed Vitest's default 5000ms timeout limit. The auth test file alone takes ~12–20s to run.

## What needs to change
- In `backend/src/routes/auth.ts`:
  - Support configurable salt rounds: default to 4 when `process.env.NODE_ENV === 'test'`, and 12 otherwise.
  - Allow an optional `options?: { saltRounds?: number }` parameter in `createAuthRouter` for explicit control.
- In `backend/vitest.config.ts`:
  - Set `testTimeout: 10_000` in the Vitest configuration to give slow environments a 10-second ceiling against flakiness.
- In tests:
  - Add test verifying `createAuthRouter` honors custom and environment-based salt rounds.
  - Ensure all existing backend and auth tests pass quickly.

## Out of scope
- Modifying password validation rules or session logic.
- Changing production default bcrypt salt rounds (remains 12).
- Any frontend auth changes.

## Acceptance criteria
- Auth tests in `backend/src/routes/auth.test.ts` complete in under 2 seconds total.
- Backend Vitest `testTimeout` is set to 10,000ms in `backend/vitest.config.ts`.
- Default salt rounds remains 12 outside of test environments (`NODE_ENV !== 'test'`).
- `pnpm test` and `pnpm build` pass cleanly without errors.
