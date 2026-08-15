/**
 * SQLite connection + Drizzle wiring.
 *
 * Reads `DATABASE_URL` from `process.env`. Accepts:
 *
 *   - `:memory:`              — in-memory DB (used by tests).
 *   - `file:./path/to.db`     — Drizzle's conventional `file:`
 *                                prefix; stripped before opening.
 *   - `./path/to.db`          — relative path; resolved against
 *                                the process CWD (caller's
 *                                responsibility; tests use
 *                                absolute paths instead).
 *   - `/abs/path/to.db`       — absolute path.
 *
 * The default (when the env var is unset) is
 * `<backend-root>/data/planner.db`, where "backend-root" is
 * found by walking up from this module's directory until a
 * `package.json` with `"name": "planner-backend"` is found.
 * This means the DB always lands in `backend/data/` whether
 * the server is launched from the repo root via
 * `pnpm dev:backend` (which `cd`s into `backend/` first) or
 * directly via `cd backend && pnpm dev` — and whether the
 * code is running as `backend/src/db/client.ts` under tsx or
 * `backend/dist/db/client.js` after `tsc`.
 *
 * The parent directory is created on first open
 * (`ensureDataDir`) so the server "just works" out of the box.
 *
 * One `Database` instance per process — `better-sqlite3` is
 * synchronous and thread-safe within a single Node process, so
 * a singleton is the right granularity. Tests opt out via the
 * `dbPath` option on `DbStore` so each test gets its own
 * connection.
 */
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import Database, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Typed Drizzle DB for our schema. Captures the full return
 * type of `drizzle(...)` so `$client` (the underlying
 * `better-sqlite3` connection) stays accessible.
 */
export type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Walk upwards from `startDir` until a `package.json` whose
 * `"name"` field matches `expectedName` is found. Returns the
 * directory containing that `package.json`, or `null` if none
 * was found before the filesystem root.
 *
 * Used to locate the backend root regardless of whether the
 * code is running from `backend/src/db/...` (dev / tsx) or
 * `backend/dist/db/...` (built) — both walk up to the same
 * `package.json` and therefore resolve to the same
 * `backend/data/` location.
 */
function findNearestPackageDir(
  startDir: string,
  expectedName: string
): string | null {
  let dir = startDir;
  // Cap the walk so a misconfigured environment can't loop
  // forever. 16 levels is plenty for any sane repo layout.
  for (let i = 0; i < 16; i++) {
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
          name?: string;
        };
        if (pkg.name === expectedName) return dir;
      } catch {
        // Corrupt / unreadable package.json — keep walking.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * Resolve the database path from `process.env.DATABASE_URL`.
 *
 *  - `:memory:` → return as-is (no filesystem).
 *  - `file:...` → strip the `file:` prefix (Drizzle convention).
 *  - Anything else → return as a path string. Relative paths
 *    are returned as-is (callers — `openSqlite` /
 *    `better-sqlite3` — resolve them against the process CWD).
 *    Only the *default* (env var unset) is rewritten to point
 *    at `<backend-root>/data/planner.db`.
 */
export function resolveDbPath(rawUrl: string | undefined): string {
  if (!rawUrl) return defaultDbPath();

  let url = rawUrl.trim();

  // Drizzle convention: `file:` prefix. Strip it.
  if (url.startsWith('file:')) {
    url = url.slice('file:'.length);
  }

  // In-memory DB. Pass through untouched.
  if (url === ':memory:') return url;

  return url;
}

/**
 * Default DB path: `<backend-root>/data/planner.db`. Always
 * absolute so the DB lands in the same place regardless of
 * process CWD.
 *
 * Resolved by walking up from this module's directory until a
 * `package.json` with `"name": "planner-backend"` is found.
 * That guarantees the same path whether the code is running as
 * `backend/src/db/client.ts` (tsx dev) or
 * `backend/dist/db/client.js` (built).
 *
 * Falls back to `path.resolve('./data/planner.db')` (CWD-
 * relative) if the package.json walk fails — that path is
 * wrong but at least non-empty, so a misconfigured deploy
 * fails loudly at open time rather than silently writing to
 * an unexpected location.
 */
export function defaultDbPath(): string {
  const backendRoot = findNearestPackageDir(__dirname, 'planner-backend');
  if (backendRoot !== null) {
    return resolve(backendRoot, 'data', 'planner.db');
  }
  return resolve(process.cwd(), 'data', 'planner.db');
}

/**
 * Make sure the parent directory of a file-path DB exists.
 * No-op for `:memory:` and for paths whose parent already exists.
 */
export function ensureDataDir(dbPath: string): void {
  if (dbPath === ':memory:') return;
  const parent = dirname(resolve(dbPath));
  if (parent && parent !== '.') {
    mkdirSync(parent, { recursive: true });
  }
}

/**
 * Open a raw `better-sqlite3` connection at `dbPath`. Applies
 * the pragmas we want globally:
 *
 *   - `journal_mode = WAL`   — better read/write concurrency
 *                               (and crash resilience) for the
 *                               typical workload (many small
 *                               writes from the API).
 *   - `foreign_keys = ON`    — required for the `onDelete:
 *                               'cascade'` on `property_values`
 *                               to fire.
 *   - `synchronous = NORMAL`  — pairs with WAL; trades a tiny
 *                               crash-window for noticeably
 *                               faster commits.
 */
export function openSqlite(dbPath: string): BetterSqliteDatabase {
  ensureDataDir(dbPath);
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = NORMAL');
  return sqlite;
}

/**
 * Open a Drizzle-wrapped connection. Pass-through to
 * `openSqlite()` plus the `drizzle()` wrapper bound to the
 * schema so callers get typed queries (`db.select().from(schema.projects)`).
 */
export function openDb(dbPath: string): Db {
  const sqlite = openSqlite(dbPath);
  return drizzle(sqlite, { schema });
}

/**
 * Default module-level singleton used by `DbStore` when no
 * explicit `dbPath` is provided. Lazy so that `process.env`
 * is fully populated by the time we read it (important when
 * the caller loads `.env` after importing this module).
 */
let _defaultDb: Db | null = null;

/**
 * Get (or lazily create) the process-wide Drizzle singleton
 * using `process.env.DATABASE_URL`.
 */
export function getDb(): Db {
  if (_defaultDb !== null) return _defaultDb;
  const dbPath = resolveDbPath(process.env.DATABASE_URL);
  _defaultDb = openDb(dbPath);
  return _defaultDb;
}

/**
 * Reset the cached singleton. Tests use this between cases to
 * guarantee a fresh connection; production callers should never
 * need it.
 */
export function resetDefaultDb(): void {
  if (_defaultDb !== null) {
    try {
      _defaultDb.$client.close();
    } catch {
      // Best-effort; ignore close errors during teardown.
    }
    _defaultDb = null;
  }
}

/** Re-export the schema namespace so downstream imports stay
 *  short (`import { getDb } from './client.js'` and that's it). */
export { schema };

/**
 * Helper: resolve a relative DB path against an explicit
 * directory. Used by tests that want to point at a temp dir
 * regardless of process CWD.
 */
export function resolveAgainst(baseDir: string, dbPath: string): string {
  if (dbPath === ':memory:') return dbPath;
  if (isAbsolute(dbPath)) return dbPath;
  return resolve(baseDir, dbPath);
}