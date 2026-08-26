/**
 * Custom `express-session` Store backed by `better-sqlite3`.
 *
 * Extends the abstract `Store` class from express-session so the
 * type system is satisfied and consumers don't need double casts.
 *
 * Design choices:
 *   - Uses raw `better-sqlite3` (not Drizzle) because this is a
 *     low-level infrastructure concern, not app domain logic.
 *   - The `sessions` table is created on first use (idempotent).
 *   - Expired rows are cleaned up on each `set()` call. For a
 *     single-user app this is fast and keeps the DB tidy.
 *   - `touch()` updates the expiry without rewriting session data,
 *     enabling `resave: false` in the session config.
 */
import { Store } from 'express-session';
import type { SessionData } from 'express-session';
import type Database from 'better-sqlite3';

/**
 * Row shape stored in the `sessions` table.
 */
interface SessionRow {
  sid: string;
  sess: string;
  expired: number;
}

/**
 * Get the `maxAge` from a session's cookie, falling back to 7 days.
 */
function maxAgeFromSession(session: SessionData): number {
  const maxAge = session.cookie.maxAge;
  return typeof maxAge === 'number' ? maxAge : 7 * 24 * 60 * 60 * 1000;
}

/**
 * SQLite-backed session store for `express-session`.
 *
 * Extends the abstract `Store` class (which itself extends
 * `EventEmitter`), so all required abstract methods are enforced
 * by the type system at compile time.
 */
export class SQLiteSessionStore extends Store {
  private readonly db: Database.Database;
  private readonly stmtGet: Database.Statement;
  private readonly stmtSet: Database.Statement;
  private readonly stmtDestroy: Database.Statement;
  private readonly stmtTouch: Database.Statement;
  private readonly stmtCleanup: Database.Statement;

  constructor(db: Database.Database) {
    super();
    this.db = db;

    // Create the sessions table if it doesn't exist. Idempotent.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid    TEXT PRIMARY KEY,
        sess   TEXT NOT NULL,
        expired INTEGER NOT NULL
      )
    `);

    // Index on expiry for fast cleanup queries.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS sessions_expired_idx
        ON sessions (expired)
    `);

    // Prepare statements once, reuse per call.
    this.stmtGet = this.db.prepare(
      'SELECT sid, sess, expired FROM sessions WHERE sid = ?'
    );
    this.stmtSet = this.db.prepare(
      'INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)'
    );
    this.stmtDestroy = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.stmtTouch = this.db.prepare(
      'UPDATE sessions SET expired = ? WHERE sid = ?'
    );
    this.stmtCleanup = this.db.prepare(
      'DELETE FROM sessions WHERE expired < ?'
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Release resources. Since the store shares the underlying
   * SQLite connection with the rest of the app, the connection
   * itself is closed by the caller; this method is a no-op
   * placeholder that exists so the shutdown handler can call it
   * symmetrically with other teardown.
   */
  close(): void {
    // No-op: the underlying db connection is managed externally.
  }

  // ── Required abstract methods ───────────────────────────────────

  /**
   * Retrieve a session by its ID. Calls `callback(err, session)`.
   * Returns `null` for the session when the row is not found.
   */
  override get(
    sid: string,
    callback: (err: Error | null, session?: SessionData | null) => void
  ): void {
    try {
      const row = this.stmtGet.get(sid) as SessionRow | undefined;
      if (!row) {
        callback(null, null);
        return;
      }

      // Check expiry.
      if (row.expired <= Date.now()) {
        // Session expired — delete it and return null.
        this.stmtDestroy.run(sid);
        callback(null, null);
        return;
      }

      const session = JSON.parse(row.sess) as SessionData;
      callback(null, session);
    } catch (err) {
      callback(err as Error);
    }
  }

  /**
   * Upsert a session. Serialises `SessionData` to JSON and stores
   * it with an expiry derived from `cookie.maxAge`.
   */
  override set(
    sid: string,
    session: SessionData,
    callback?: (err?: Error) => void
  ): void {
    try {
      const expired = Date.now() + maxAgeFromSession(session);

      this.stmtSet.run(sid, JSON.stringify(session), expired);

      // Cleanup expired sessions on each write. Cheap for single-user.
      this.stmtCleanup.run(Date.now());

      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  /**
   * Destroy a session by ID.
   */
  override destroy(sid: string, callback?: (err?: Error) => void): void {
    try {
      this.stmtDestroy.run(sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  // ── Optional methods (recommended for resave: false) ────────────

  /**
   * Touch a session — update its expiry without rewriting the
   * session data. Enables `resave: false` in session config.
   */
  override touch(
    sid: string,
    session: SessionData,
    callback?: () => void
  ): void {
    try {
      const expired = Date.now() + maxAgeFromSession(session);

      this.stmtTouch.run(expired, sid);
      callback?.();
    } catch {
      // Touch is best-effort; swallow errors.
      callback?.();
    }
  }
}
