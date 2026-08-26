/**
 * End-to-end tests for the auth routes (`/api/auth/*`) and the
 * `requireAuth` middleware protecting `/api/*`.
 *
 * Each test creates a fresh in-memory SQLite DB + Express app
 * wired with session middleware (mirroring production wiring in
 * `index.ts`). `supertest` drives HTTP requests in-process.
 *
 * The `supertest` agent jar carries the session cookie across
 * requests so we can verify login/logout/state transitions.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import cors from 'cors';
import expressSession from 'express-session';
import request from 'supertest';
import { DbStore } from '../db/store.js';
import { SQLiteSessionStore } from '../db/session-store.js';
import { createAuthRouter } from './auth.js';
import { createRouter } from '../routes.js';
import { requireAuth, errorHandler, notFoundHandler } from '../middleware.js';

/**
 * Build a fresh Express app with session middleware, auth routes
 * (unprotected), and protected API routes — identical to the
 * production wiring in `index.ts` but against an in-memory DB.
 */
function buildApp(): { app: express.Express; store: DbStore } {
  const store = new DbStore({ dbPath: ':memory:' });
  const sessionStore = new SQLiteSessionStore(store.getUnderlyingClient());

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(
    expressSession({
      store: sessionStore,
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 60_000,
      },
    })
  );

  // Auth routes (unprotected) — same order as production.
  app.use('/api/auth', createAuthRouter(store));
  // Protected API routes.
  app.use('/api', requireAuth, createRouter(store));
  // Error pipeline.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, store };
}

/**
 * Build a fresh app with no password set. Used by tests that need
 * to verify behaviour against a clean (setup-required) state.
 *
 * `shutdown()` on the returned store is a documented no-op for
 * `DbStore`; the in-memory connection is GC'd when the test ends.
 */
function buildFreshApp(): { app: express.Express; store: DbStore } {
  return buildApp();
}

/**
 * Extract the raw `connect.sid` value from a `set-cookie` header.
 * Depending on the `supertest`/`superagent` version the header is
 * typed (and populated) either as a single string or an array of
 * strings — normalize both here so call sites need no casts.
 * Returns the part before the first `;` (the cookie value including
 * the signature).
 */
function extractSessionId(
  cookies: string | string[] | undefined
): string | undefined {
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  if (list.length === 0) return undefined;
  const sidCookie = list.find((c) => c.startsWith('connect.sid='));
  if (!sidCookie) return undefined;
  return sidCookie.split(';')[0];
}

describe('Auth routes', () => {
  let app: express.Express;
  let store: DbStore;

  beforeEach(() => {
    ({ app, store } = buildApp());
  });

  afterEach(() => {
    // `shutdown()` is a documented no-op for DbStore; the in-memory
    // connection is GC'd when the test ends.
    store.shutdown();
  });

  // -------------------------------------------------------------------
  // GET /api/auth/status
  // -------------------------------------------------------------------

  describe('GET /api/auth/status', () => {
    it('returns setupRequired: true on a fresh DB', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ setupRequired: true });
    });

    it('returns setupRequired: false after a password is set', async () => {
      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'password123' });
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ setupRequired: false });
    });
  });

  // -------------------------------------------------------------------
  // POST /api/auth/setup
  // -------------------------------------------------------------------

  describe('POST /api/auth/setup', () => {
    it('creates a password hash and returns 201', async () => {
      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true });

      // The hash should now exist in the store.
      expect(store.getPasswordHash()).toBeTruthy();
    });

    it('auto-logs in after setup (session is authenticated)', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/auth/setup')
        .send({ password: 'password123' });

      // A protected route should now succeed without re-login.
      const res = await agent.get('/api/settings');
      expect(res.status).toBe(200);
    });

    it('rejects weak passwords (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects re-setup when a password already exists (409)', async () => {
      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'password123' });
      const res = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'anotherpass' });
      expect(res.status).toBe(409);
    });

    it('regenerates the session to prevent fixation', async () => {
      // Get an initial session (unauthenticated, from the session middleware).
      const initialRes = await request(app).get('/api/auth/status');
      const initialSid = extractSessionId(initialRes.headers['set-cookie']);

      // Perform setup — this should regenerate the session.
      const setupRes = await request(app)
        .post('/api/auth/setup')
        .send({ password: 'password123' });
      const newSid = extractSessionId(setupRes.headers['set-cookie']);

      // The session ID must have changed after regeneration.
      expect(newSid).toBeDefined();
      expect(newSid).not.toBe(initialSid);
    });
  });

  // -------------------------------------------------------------------
  // POST /api/auth/login
  // -------------------------------------------------------------------

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Set up a password so login is possible.
      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'password123' });
    });

    it('succeeds with correct password and returns a session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      // Explicitly verify a session cookie was set.
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(String(cookies)).toMatch(/^connect\.sid=/);
    });

    it('allows access to protected routes after login', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/auth/login')
        .send({ password: 'password123' });

      const res = await agent.get('/api/settings');
      expect(res.status).toBe(200);
    });

    it('fails with wrong password and returns 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid password');
    });

    it('returns 401 when no password has been set (setup required)', async () => {
      const { app: freshApp, store: freshStore } = buildFreshApp();
      try {
        const res = await request(freshApp)
          .post('/api/auth/login')
          .send({ password: 'password123' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Setup required');
      } finally {
        // `shutdown()` is a documented no-op for DbStore; the in-memory
        // connection is GC'd when the test ends.
        freshStore.shutdown();
      }
    });

    it('regenerates the session to prevent fixation', async () => {
      // Get an initial session (from the setup in beforeEach).
      const initialRes = await request(app).get('/api/auth/status');
      const initialSid = extractSessionId(initialRes.headers['set-cookie']);

      // Login — this should regenerate the session.
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });
      const newSid = extractSessionId(loginRes.headers['set-cookie']);

      // The session ID must have changed after regeneration.
      expect(newSid).toBeDefined();
      expect(newSid).not.toBe(initialSid);
    });
  });

  // -------------------------------------------------------------------
  // POST /api/auth/logout
  // -------------------------------------------------------------------

  describe('POST /api/auth/logout', () => {
    it('destroys the session so protected routes return 401', async () => {
      const agent = request.agent(app);

      // Log in first.
      await agent
        .post('/api/auth/setup')
        .send({ password: 'password123' });

      // Confirm access works.
      const before = await agent.get('/api/settings');
      expect(before.status).toBe(200);

      // Logout.
      const logout = await agent.post('/api/auth/logout');
      expect(logout.status).toBe(200);
      expect(logout.body).toEqual({ success: true });

      // Protected route should now be 401.
      const after = await agent.get('/api/settings');
      expect(after.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Protected routes (requireAuth middleware)
  // -------------------------------------------------------------------

  describe('requireAuth middleware', () => {
    it('returns 401 for protected routes without a valid session', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 200 for protected routes with a valid session', async () => {
      const agent = request.agent(app);
      await agent
        .post('/api/auth/setup')
        .send({ password: 'password123' });

      const res = await agent.get('/api/settings');
      expect(res.status).toBe(200);
    });

    it('allows auth routes without a session', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------
  // Non-existent auth sub-routes
  // -------------------------------------------------------------------

  describe('unknown auth sub-routes', () => {
    it('returns 404 for POST /api/auth/foobar', async () => {
      const res = await request(app)
        .post('/api/auth/foobar')
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('returns 404 for GET /api/auth/unknown', async () => {
      const res = await request(app).get('/api/auth/unknown');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  // -------------------------------------------------------------------
  // POST /api/auth/change-password
  // -------------------------------------------------------------------

  describe('POST /api/auth/change-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/setup')
        .send({ password: 'oldpassword' });
    });

    it('works with the correct current password', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'oldpassword', newPassword: 'newpassword' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });

      // Old password should no longer work.
      const loginOld = await request(app)
        .post('/api/auth/login')
        .send({ password: 'oldpassword' });
      expect(loginOld.status).toBe(401);

      // New password should work.
      const loginNew = await request(app)
        .post('/api/auth/login')
        .send({ password: 'newpassword' });
      expect(loginNew.status).toBe(200);
    });

    it('rejects wrong current password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'wrong', newPassword: 'newpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Current password is incorrect');
    });

    it('rejects weak new passwords (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: 'oldpassword', newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns 400 when no password has been set', async () => {
      const { app: freshApp, store: freshStore } = buildFreshApp();
      try {
        const res = await request(freshApp)
          .post('/api/auth/change-password')
          .send({ currentPassword: 'x', newPassword: 'newpassword' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No password set');
      } finally {
        // `shutdown()` is a documented no-op for DbStore; the in-memory
        // connection is GC'd when the test ends.
        freshStore.shutdown();
      }
    });
  });
});
