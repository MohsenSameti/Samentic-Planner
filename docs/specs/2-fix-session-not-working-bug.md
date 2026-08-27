# Spec: Fix session not restoring on tab reopen

## Goal
Make the planner recognize an already-valid session on page load so the user is not asked to re-enter their password every time they close and reopen the tab. The 7-day session window advertised by the cookie config should actually take effect.

## Current state
- Server stores sessions in SQLite with a 7-day expiry; the session cookie is `httpOnly`, `sameSite: 'lax'`, `secure` in production, and `maxAge: 7 days` by default.
- `GET /api/auth/status` returns only `{ setupRequired: boolean }` — it does **not** look at `req.session.authenticated`. Anonymous and already-authenticated clients get the same response.
- The frontend's `useAuth` initializes `isAuthenticated = ref(false)` and only ever sets it to `true` from inside the `login()` and `setup()` methods. The status fetch only updates `setupRequired` and `loading`.
- `App.vue` gates the main UI behind `!auth.isAuthenticated`, so on every reload the user lands on `LoginPage` until they type the password again, even when their session cookie is still valid.

## What needs to change
- **`backend/src/routes/auth.ts`** — `GET /auth/status` returns `{ setupRequired: boolean, authenticated: boolean }`. `authenticated` is derived from `req.session.authenticated === true`. The server guarantees `authenticated === true` implies `setupRequired === false` (you cannot have a session without a password having been set).
- **`frontend/src/types/index.ts`** — `AuthStatus` interface gains `authenticated: boolean`.
- **`frontend/src/composables/useAuth.ts`** — `fetchStatus()` (and `retryStatus()`) set `isAuthenticated.value = status.authenticated` from the response, in addition to the existing `setupRequired` / `loading` / `error` updates. The watcher in `App.vue` and the `dataLoaded` guard already handle the resulting `false → true` flip correctly (it triggers `loadData()` once).
- **Test updates** — `backend/src/routes/auth.test.ts`, `frontend/src/composables/useAuth.test.ts`, `frontend/src/components/LoginPage.spec.ts`, `frontend/src/components/SetupWizard.spec.ts`, `frontend/src/modals/ChangePasswordModal.spec.ts`, and `frontend/src/api.test.ts` must add `authenticated` to their `authStatus` mocks / assertions. The new behaviour (status reports `authenticated: true` ⇒ `isAuthenticated` flips true without a manual login) is covered by at least one new test in `useAuth.test.ts` and one new test in `auth.test.ts`.

## Out of scope
- Changing cookie attributes, session lifetime, or session-store mechanics. The session layer is already correct; only the client/server handshake on boot is broken.
- Adding a "Welcome back" toast or any other UX flourish for restored sessions. The fix is purely behavioural: `isAuthenticated` should reflect server truth on load.
- Touching the `dataLoaded` re-run behaviour for expired-then-relogged sessions. The existing `onUnauthorized` callback path (401 from any API call ⇒ `isAuthenticated = false` ⇒ route guard swaps to `LoginPage`) is the correct mechanism for mid-session expiry and is unchanged.
- Reviewing or refactoring the `onUnauthorized` callback flow. It is correct as-is.

## Acceptance criteria
- After successful login, closing the tab and reopening it (with the cookie still within its 7-day window) lands directly on the main planner UI, **not** on `LoginPage`. No password prompt.
- After successful login, manually deleting the session cookie (or waiting past 7 days) and reopening the tab lands on `LoginPage` as before.
- A fresh install with no password still lands on `SetupWizard` regardless of cookie state (the only "session" a new client could have is the empty pre-setup one, and `authenticated` will be `false`).
- `GET /api/auth/status` returns `{ setupRequired, authenticated }` for both anonymous and authenticated requests, with `authenticated` reflecting the actual session state.
- All existing tests are updated to mock/assert the new field, and the new behaviour has at least one positive test on each side (backend: `authenticated: true` returned for a logged-in session; frontend: `isAuthenticated` flips true after `fetchStatus` resolves with `authenticated: true`).
- `pnpm` build passes for both backend and frontend (per `AGENTS.md`).
