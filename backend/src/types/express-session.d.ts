/**
 * Type augmentation for express-session — adds `authenticated` to
 * `SessionData`.
 *
 * This makes `req.session.authenticated` type-safe everywhere the
 * express-session middleware has run (auth routes, `requireAuth`)
 * without any casts. The field is assigned only after login/setup
 * and read by the auth middleware; it is `undefined` on fresh
 * sessions, so reads must treat it as possibly falsy.
 */

export {};

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}
