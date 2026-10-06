/**
 * Authentication routes for single-user password auth.
 *
 * These routes are mounted at `/api/auth` and are intentionally
 * excluded from `requireAuth` — they must be reachable without
 * a valid session so the client can check setup status, log in,
 * or create the initial password.
 */
import { Router, type Router as ExpressRouter } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DbStore } from '../db/store.js';
import {
  LoginSchema,
  SetupSchema,
  ChangePasswordSchema,
} from '../validation.js';

/**
 * Bcrypt cost factor used in tests. Kept low so the suite stays fast —
 * a 4-round hash is ~256x cheaper than the production default.
 * Test-only: this is not a security posture for real passwords.
 */
export const TEST_BCRYPT_SALT_ROUNDS = 4;

/** Bcrypt cost factor used everywhere except tests. */
export const PROD_BCRYPT_SALT_ROUNDS = 12;

/**
 * Bounds accepted for an explicit `saltRounds`. bcryptjs clamps values below 4
 * silently (so a `3` would quietly weaken a hash), and happily accepts values
 * above 31 — `32` means 2^32 iterations, which hangs the process instead of
 * erroring. Validating here turns both mistakes into an immediate throw.
 */
export const BCRYPT_SALT_ROUNDS_MIN = 4;
export const BCRYPT_SALT_ROUNDS_MAX = 31;

export const AuthRouterOptionsSchema = z
  .object({
    saltRounds: z
      .number()
      .int()
      .min(BCRYPT_SALT_ROUNDS_MIN)
      .max(BCRYPT_SALT_ROUNDS_MAX)
      .optional(),
  })
  // Strict so a misspelled key (`saltRound`) is an error rather than a
  // silently dropped option that falls back to the default cost factor.
  .strict();

export type AuthRouterOptions = z.infer<typeof AuthRouterOptionsSchema>;

/**
 * Resolve the bcrypt cost factor for the given environment.
 *
 * Takes the environment as an argument rather than reading `process.env` at
 * module load: import order (e.g. whether `dotenv/config` has run yet) would
 * otherwise silently decide the value, and tests could not exercise the
 * production branch.
 */
export function defaultSaltRounds(
  env: NodeJS.ProcessEnv = process.env
): number {
  return env.NODE_ENV === 'test'
    ? TEST_BCRYPT_SALT_ROUNDS
    : PROD_BCRYPT_SALT_ROUNDS;
}

/**
 * Build an Express router for auth endpoints backed by the given store.
 * Same factory pattern as `routes.ts` so tests can use an in-memory DB.
 *
 * Throws (at construction, before any request is served) if `options` carries
 * an invalid `saltRounds` — see `AuthRouterOptionsSchema`.
 */
export function createAuthRouter(
  store: DbStore,
  options?: AuthRouterOptions
): ExpressRouter {
  const { saltRounds = defaultSaltRounds() } = AuthRouterOptionsSchema.parse(
    options ?? {}
  );
  const router: ExpressRouter = Router();

  // --- GET /auth/status --------------------------------------------------
  // Returns both whether the app is in first-run setup mode and whether
  // the calling session is already authenticated. The client uses these
  // together on boot to decide:
  //   - setupRequired: true  → show SetupWizard (no password yet)
  //   - setupRequired: false, authenticated: false → show LoginPage
  //   - authenticated: true                       → enter the app
  //
  // We read `req.session.authenticated` here so a returning user whose
  // session cookie is still within the 7-day window is recognised without
  // being asked for the password again.

  router.get('/status', (req, res) => {
    const hash = store.getPasswordHash();
    res.json({
      setupRequired: hash === null,
      authenticated: req.session.authenticated === true,
    });
  });

  // --- POST /auth/setup --------------------------------------------------
  // First-run password creation. Hashes the password with bcrypt and
  // stores it. Fails with 409 if a password already exists.
  //
  // After storing the hash, we regenerate the session to obtain a fresh
  // session ID — this prevents session fixation attacks where an
  // attacker pre-sets a known session cookie before the user completes
  // the initial setup.

  router.post('/setup', (req, res, next) => {
    try {
      const { password } = SetupSchema.parse(req.body);

      // Guard against re-setup when a password already exists.
      const existing = store.getPasswordHash();
      if (existing) {
        res.status(409).json({ error: 'Password already set' });
        return;
      }

      const hash = bcrypt.hashSync(password, saltRounds);
      store.setPasswordHash(hash);

      // Regenerate the session to prevent session fixation, then
      // mark the new session as authenticated.
      req.session.regenerate((err) => {
        if (err) {
          next(err);
          return;
        }
        req.session.authenticated = true;
        res.status(201).json({ success: true });
      });
    } catch (err) {
      next(err);
    }
  });

  // --- POST /auth/login --------------------------------------------------
  // Validates the password against the stored hash. On success, regenerates
  // the session (preventing session fixation) and marks it as authenticated.
  // On failure, returns 401.

  router.post('/login', (req, res, next) => {
    try {
      const { password } = LoginSchema.parse(req.body);

      const hash = store.getPasswordHash();
      if (!hash) {
        // No password set yet — client should be in setup mode, but
        // handle gracefully by rejecting the login attempt.
        res.status(401).json({ error: 'Setup required' });
        return;
      }

      const valid = bcrypt.compareSync(password, hash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid password' });
        return;
      }

      // Regenerate the session to prevent session fixation, then
      // mark the new session as authenticated.
      req.session.regenerate((err) => {
        if (err) {
          next(err);
          return;
        }
        req.session.authenticated = true;
        res.json({ success: true });
      });
    } catch (err) {
      next(err);
    }
  });

  // --- POST /auth/logout -------------------------------------------------
  // Destroys the session so subsequent requests are unauthenticated.

  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.json({ success: true });
    });
  });

  // --- POST /auth/change-password -----------------------------------------
  // Verifies the current password, then replaces the stored hash with
  // one derived from the new password.

  router.post('/change-password', (req, res, next) => {
    try {
      const { currentPassword, newPassword } = ChangePasswordSchema.parse(
        req.body
      );

      const hash = store.getPasswordHash();
      if (!hash) {
        res.status(400).json({ error: 'No password set' });
        return;
      }

      const valid = bcrypt.compareSync(currentPassword, hash);
      if (!valid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      const newHash = bcrypt.hashSync(newPassword, saltRounds);
      store.setPasswordHash(newHash);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Catch-all for non-existent sub-routes ----------------------------
  // Without this, unknown paths (e.g. POST /api/auth/foobar) fall
  // through the auth router and hit the /api requireAuth middleware,
  // returning 401 instead of 404. The catch-all returns a clean 404
  // so the response is consistent with the rest of the API.

  router.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  return router;
}
