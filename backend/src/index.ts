// Side-effect import: loads `.env` from the backend's CWD into
// `process.env` BEFORE any other module reads `DATABASE_URL`.
// Must be the first import in this file.
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import expressSession from 'express-session';
import { getDb } from './db/client.js';
import { SQLiteSessionStore } from './db/session-store.js';
import routes from './routes.js';
import { createAuthRouter } from './routes/auth.js';
import { store as defaultStore } from './db/store.js';
import { requireAuth, errorHandler, notFoundHandler } from './middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Migrations are applied by the `DbStore` singleton's
// constructor (see `./db/store.ts`), which `routes.js`
// imports transitively via `./db/store.js`. No explicit
// `runMigrations(...)` call needed here — the singleton is
// constructed when Express first resolves the router, which
// happens before any route handler touches the DB.

app.use(cors());
app.use(express.json());

// ── Session middleware ──────────────────────────────────────────────
// Uses the custom SQLite-backed session store. The session cookie is
// signed with the `SESSION_SECRET` env var (throws in production
// when the secret is not set).
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

const db = getDb();
const sessionStore = new SQLiteSessionStore(db.$client);
const rawMaxAge = Number(process.env.SESSION_MAX_AGE);
const sessionMaxAge =
  Number.isFinite(rawMaxAge) && rawMaxAge > 0
    ? rawMaxAge
    : 7 * 24 * 60 * 60 * 1000; // 7 days

app.use(
  expressSession({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionMaxAge,
    },
  })
);

// ── Auth routes (unprotected) ──────────────────────────────────────
// Mounted BEFORE requireAuth so login, setup, and status are
// reachable without a valid session.
app.use('/api/auth', createAuthRouter(defaultStore));

// ── Protected API routes ───────────────────────────────────────────
// requireAuth gates all /api/* routes that aren't auth endpoints.
app.use('/api', requireAuth, routes);

// Serve static files in production
app.use(express.static('../frontend/dist'));

// 404 handler for unmatched routes (anything that fell through above).
// Must be registered before the error handler so the error handler
// doesn't intercept the 404 response.
app.use(notFoundHandler);

// Final error-handling middleware. Express recognizes this by the
// 4-argument signature and routes any error from earlier middleware /
// handlers here.
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown: close the HTTP server, then tear down the
// session store and database connections so prepared statements
// and SQLite file handles are released cleanly.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[server] Received ${signal}, shutting down...`);
    server.close(() => {
      sessionStore.close();
      try {
        db.$client.close();
      } catch (err) {
        console.warn('[shutdown] failed to close DB:', err);
      }
      process.exit(0);
    });
  });
}
