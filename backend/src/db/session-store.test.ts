/**
 * Unit tests for the `SQLiteSessionStore`.
 *
 * Each test creates a fresh in-memory SQLite DB via
 * `better-sqlite3`. Tests are fully isolated — no temp files,
 * no shared state.
 *
 * Tests exercise the callback-based API that `express-session`
 * expects, verifying get/set/destroy/touch semantics and
 * expiry behaviour.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { CookieOptions, SessionData } from 'express-session';
import { SQLiteSessionStore } from './session-store.js';

/**
 * Overrides for `makeSession`. `CookieOptions` (not `Cookie`) is
 * used so callers can pass a partial cookie like `{ maxAge: 0 }`
 * without constructing a full `Cookie` object.
 */
type SessionOverrides = Omit<Partial<SessionData>, 'cookie'> & {
  cookie?: CookieOptions;
};

/**
 * Build a minimal session object matching what express-session
 * serialises.
 */
function makeSession(overrides?: SessionOverrides): SessionData {
  // `as const` keeps the defaults narrow so they survive the merge
  // with `CookieOptions` without widening (e.g. sameSite: 'lax').
  const defaults = {
    originalMaxAge: 60_000,
    maxAge: 60_000, // 1 minute
    httpOnly: true,
    path: '/',
    secure: false,
    sameSite: 'lax',
  } as const;
  const cookie = {
    ...defaults,
    ...(overrides?.cookie ?? {}),
  };
  return {
    cookie,
    authenticated: overrides?.authenticated ?? false,
  };
}

/**
 * Promise wrapper around the callback-based `get`.
 */
function getAsync(store: SQLiteSessionStore, sid: string): Promise<SessionData | null> {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, session) => {
      if (err) reject(err);
      else resolve(session ?? null);
    });
  });
}

/**
 * Promise wrapper around the callback-based `set`.
 */
function setAsync(store: SQLiteSessionStore, sid: string, session: SessionData): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, session, (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promise wrapper around the callback-based `destroy`.
 */
function destroyAsync(store: SQLiteSessionStore, sid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Promise wrapper around the callback-based `touch`.
 */
function touchAsync(
  store: SQLiteSessionStore,
  sid: string,
  session: SessionData
): Promise<void> {
  return new Promise((resolve) => {
    store.touch(sid, session, () => resolve());
  });
}

describe('SQLiteSessionStore', () => {
  let db: BetterSqliteDatabase;
  let store: SQLiteSessionStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new SQLiteSessionStore(db);
  });

  afterEach(() => {
    db.close();
  });

  // -----------------------------------------------------------------
  // get
  // -----------------------------------------------------------------

  describe('get', () => {
    it('returns null for a non-existent session', async () => {
      const session = await getAsync(store, 'missing');
      expect(session).toBeNull();
    });

    it('returns the stored session data', async () => {
      const data = makeSession();
      await setAsync(store, 's1', data);

      const retrieved = await getAsync(store, 's1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.cookie.maxAge).toBe(60_000);
    });

    it('returns null for an expired session', async () => {
      // Store a session with maxAge = 0 (expires immediately).
      const data = makeSession({ cookie: { maxAge: 0 } });
      await setAsync(store, 's1', data);

      const retrieved = await getAsync(store, 's1');
      expect(retrieved).toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // set
  // -----------------------------------------------------------------

  describe('set', () => {
    it('stores and retrieves a session', async () => {
      const data = makeSession({ authenticated: true });
      await setAsync(store, 's1', data);

      const retrieved = await getAsync(store, 's1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.authenticated).toBe(true);
    });

    it('overwrites an existing session with the same sid', async () => {
      await setAsync(store, 's1', makeSession({ authenticated: false }));
      await setAsync(store, 's1', makeSession({ authenticated: true }));

      const retrieved = await getAsync(store, 's1');
      expect(retrieved?.authenticated).toBe(true);
    });

    it('cleans up expired sessions on write', async () => {
      // Insert an expired session.
      await setAsync(store, 'expired', makeSession({ cookie: { maxAge: 0 } }));

      // Insert a valid session — this triggers cleanup.
      await setAsync(store, 'valid', makeSession());

      // The expired session should be gone.
      const result = await getAsync(store, 'expired');
      expect(result).toBeNull();

      // The valid session should still be there.
      const valid = await getAsync(store, 'valid');
      expect(valid).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------
  // destroy
  // -----------------------------------------------------------------

  describe('destroy', () => {
    it('removes a session', async () => {
      await setAsync(store, 's1', makeSession());
      expect(await getAsync(store, 's1')).not.toBeNull();

      await destroyAsync(store, 's1');
      expect(await getAsync(store, 's1')).toBeNull();
    });

    it('is a no-op for a non-existent session', async () => {
      // Should not throw.
      await destroyAsync(store, 'missing');
    });
  });

  // -----------------------------------------------------------------
  // touch
  // -----------------------------------------------------------------

  describe('touch', () => {
    it('extends session expiry without changing data', async () => {
      // Store a session that will expire very soon.
      await setAsync(store, 's1', makeSession({ cookie: { maxAge: 1 } }));

      // Touch it with a longer maxAge.
      await touchAsync(store, 's1', makeSession({ cookie: { maxAge: 60_000 } }));

      // The session should still be retrievable.
      const retrieved = await getAsync(store, 's1');
      expect(retrieved).not.toBeNull();
    });

    it('does not modify the stored session data', async () => {
      await setAsync(store, 's1', makeSession({ authenticated: true }));

      // Touch with a different session object — should not affect stored data.
      await touchAsync(store, 's1', makeSession({ authenticated: false }));

      const retrieved = await getAsync(store, 's1');
      expect(retrieved?.authenticated).toBe(true);
    });
  });

  // -----------------------------------------------------------------
  // Table creation
  // -----------------------------------------------------------------

  describe('table creation', () => {
    it('creates the sessions table on construction', () => {
      // Verify the table exists by querying sqlite_master.
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'")
        .get() as { name: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.name).toBe('sessions');
    });

    it('is idempotent — constructing twice does not error', async () => {
      const store2 = new SQLiteSessionStore(db);
      // Both stores should work against the same DB.
      await setAsync(store, 's1', makeSession());
      const session = await getAsync(store2, 's1');
      expect(session).not.toBeNull();
    });
  });
});
