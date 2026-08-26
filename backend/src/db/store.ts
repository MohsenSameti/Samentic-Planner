/**
 * SQLite-backed store. Same public API as the previous
 * `JsonStore` so `routes.ts` and tests can swap over with
 * minimal churn.
 *
 * Each instance owns one `Db` (Drizzle connection). By default
 * the connection is the process-wide singleton created from
 * `DATABASE_URL`; tests pass `{ dbPath: ':memory:' }` (or a
 * temp file) to get a fresh, isolated DB per test.
 *
 * No debouncing here — SQLite commits each write synchronously
 * via `better-sqlite3`, so the in-memory state and the on-disk
 * state stay in lockstep without any batching. `shutdown()` is
 * kept as a no-op for API symmetry with the old `JsonStore`
 * (callers still call it on SIGINT/SIGTERM; it just doesn't
 * need to do anything).
 */
import { and, eq } from 'drizzle-orm';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import {
  getDb,
  openDb,
  resolveDbPath,
  type Db,
} from './client.js';
import { runMigrations } from './migrate.js';
import {
  dayNotes,
  properties,
  projects,
  propertyValues,
  settings,
  tasks,
  weekNotes,
} from './schema.js';
import type {
  DayNote,
  Project,
  Property,
  PropertyValue,
  Settings,
  State,
  Task,
  WeekNote,
} from '../types.js';

/** Options accepted by the `DbStore` constructor. */
export interface DbStoreOptions {
  /**
   * Override the DB path. Useful for tests (`:memory:`) or for
   * pointing at a non-default file. If omitted, falls back to
   * `process.env.DATABASE_URL` (resolved by `resolveDbPath`).
   */
  dbPath?: string;
}

/**
 * Construct a fresh Drizzle connection for a given path. Kept
 * internal so callers always go through `DbStore` and don't
 * need to know about the client module.
 */
function buildDb(dbPath: string): Db {
  return openDb(resolveDbPath(dbPath));
}

/**
 * Map a Drizzle row from `settings` to the wire-format
 * `Settings` object the API returns. Centralised so the type
 * narrowing (Zod's `weekStart` is a plain `number` but we
 * promised callers a `WeekStartDay`) lives in one place.
 *
 * `passwordHash` is intentionally excluded — it is internal
 * state used only by the auth layer.
 */
function mapSettingsRow(row: {
  weekStart: number;
  calendar: string;
}): Settings {
  // Runtime narrowing — `Settings.weekStart` is `0 | 1 | 2 | 3
  // | 4 | 5 | 6`, the schema already enforces this via the
  // `min(0).max(6).int()` constraints on the API write path.
  return {
    weekStart: row.weekStart as Settings['weekStart'],
    calendar: row.calendar as Settings['calendar'],
  };
}

/**
 * SQLite-backed store. See the module-level docblock for
 * design notes; the public method list below mirrors
 * `JsonStore` so call sites stay the same.
 */
export class DbStore {
  private readonly db: Db;
  /** Holds the `dbPath` this instance was opened with, mainly
   *  for diagnostics / test introspection. */
  private readonly dbPath: string;

  constructor(options: DbStoreOptions = {}) {
    if (options.dbPath !== undefined) {
      this.db = buildDb(options.dbPath);
      this.dbPath = resolveDbPath(options.dbPath);
    } else {
      // Reuse the process-wide singleton.
      this.db = getDb();
      this.dbPath = resolveDbPath(process.env.DATABASE_URL);
    }
    // Make sure the schema exists. Idempotent — `migrate()`
    // records applied migrations and skips them on subsequent
    // runs. Doing this here means tests don't have to call
    // `runMigrations` separately.
    runMigrations(this.db);
    this.seedIfEmpty();
  }

  /**
   * Seed the default "General" project + default settings row
   * if the DB is empty. Idempotent: a no-op once the seed has
   * run.
   *
   * The two writes are wrapped in a transaction so the seed is
   * all-or-nothing — callers never observe a half-seeded DB.
   */
  private seedIfEmpty(): void {
    const projectCount = this.db.select({ c: projects.id }).from(projects).all().length;
    const settingsRow = this.db.select().from(settings).limit(1).all()[0];

    if (projectCount === 0 && settingsRow === undefined) {
      const now = Date.now();
      this.db.transaction((tx) => {
        tx.insert(projects).values({
          id: 'default',
          name: 'General',
          color: '#E74C3C',
          createdAt: now,
          updatedAt: now,
        }).run();
        tx.insert(settings).values({
          id: 1,
          weekStart: 6,
          calendar: 'gregorian',
          passwordHash: null,
          updatedAt: now,
        }).run();
      });
    } else if (projectCount === 0) {
      // Settings row exists but no projects — partial seed.
      const now = Date.now();
      this.db.insert(projects).values({
        id: 'default',
        name: 'General',
        color: '#E74C3C',
        createdAt: now,
        updatedAt: now,
      }).run();
    } else if (settingsRow === undefined) {
      // Projects exist but no settings — fill it in.
      this.db.insert(settings).values({
        id: 1,
        weekStart: 6,
        calendar: 'gregorian',
        passwordHash: null,
        updatedAt: Date.now(),
      }).run();
    }
  }

  // --- Lifecycle -------------------------------------------------------

  /**
   * No-op for SQLite — writes are already durable on return.
   * Kept for API symmetry with `JsonStore` so existing signal
   * handlers don't need to know which store they're dealing
   * with.
   */
  public shutdown(): void {
    // intentionally empty
  }

  // --- Read API --------------------------------------------------------

  public getProjects(): Project[] {
    return this.db.select().from(projects).all() as Project[];
  }

  public getTasks(): Task[] {
    return this.db.select().from(tasks).all() as Task[];
  }

  public getProperties(): Property[] {
    return this.db.select().from(properties).all() as Property[];
  }

  public getPropertyValues(): PropertyValue[] {
    return this.db.select().from(propertyValues).all() as PropertyValue[];
  }

  public getDayNotes(): DayNote[] {
    return this.db.select().from(dayNotes).all() as DayNote[];
  }

  public getWeekNotes(): WeekNote[] {
    return this.db.select().from(weekNotes).all() as WeekNote[];
  }

  public getSettings(): Settings {
    const row = this.db.select().from(settings).limit(1).all()[0];
    if (!row) {
      // Shouldn't happen post-seed, but keep the API total.
      return { weekStart: 6, calendar: 'gregorian' };
    }
    return mapSettingsRow(row);
  }

  public getState(): State {
    return {
      projects: this.getProjects(),
      tasks: this.getTasks(),
      properties: this.getProperties(),
      propertyValues: this.getPropertyValues(),
      dayNotes: this.getDayNotes(),
      weekNotes: this.getWeekNotes(),
      settings: this.getSettings(),
    };
  }

  // --- Underlying client ----------------------------------------------

  /**
   * Return the raw `better-sqlite3` connection backing this store.
   * Used by the session store constructor, which needs the raw
   * SQLite handle (Drizzle is not involved in session management).
   */
  public getUnderlyingClient(): BetterSqliteDatabase {
    return this.db.$client;
  }

  // --- Password Hash (internal, not exposed via API) -------------------

  /** Get the stored password hash. Returns `null` when no password
   *  has been set yet (first-run / setup mode). */
  public getPasswordHash(): string | null {
    const row = this.db.select().from(settings).limit(1).all()[0];
    return row?.passwordHash ?? null;
  }

  /** Store a bcrypt password hash in the settings row. */
  public setPasswordHash(hash: string): void {
    this.db
      .update(settings)
      .set({ passwordHash: hash, updatedAt: Date.now() })
      .run();
  }

  // --- Settings --------------------------------------------------------

  public updateSettings(next: Settings): Settings {
    // The settings row is a singleton addressed by `id = 1`,
    // so the `.update(settings)` call intentionally omits a
    // `.where(...)` clause — there's exactly one row and
    // updating it is the entire operation. The seed in
    // `seedIfEmpty()` guarantees the row exists by the time
    // any caller reaches this method.
    this.db
      .update(settings)
      .set({
        weekStart: next.weekStart,
        calendar: next.calendar,
        updatedAt: Date.now(),
      })
      .run();
    return this.getSettings();
  }

  // --- Projects --------------------------------------------------------

  public addProject(project: Project): Project {
    this.db.insert(projects).values(project).run();
    return project;
  }

  public updateProject(id: string, data: Partial<Project>): Project | null {
    const existing = this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)
      .all()[0];
    if (!existing) return null;
    const merged = { ...existing, ...data, id: existing.id };
    this.db.update(projects).set(merged).where(eq(projects.id, id)).run();
    return merged;
  }

  public deleteProject(id: string): boolean {
    // Detach tasks first (set `project_id = ''`), matching the
    // pre-refactor `JsonStore` behavior. Tasks pointing at
    // non-existent projects are not touched by the cascade.
    this.db
      .update(tasks)
      .set({ projectId: '' })
      .where(eq(tasks.projectId, id))
      .run();
    const result = this.db.delete(projects).where(eq(projects.id, id)).run();
    return result.changes > 0;
  }

  // --- Tasks -----------------------------------------------------------

  public addTask(task: Task): Task {
    this.db.insert(tasks).values(task).run();
    return task;
  }

  public updateTask(id: string, data: Partial<Task>): Task | null {
    const existing = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1)
      .all()[0];
    if (!existing) return null;
    const merged = { ...existing, ...data, id: existing.id };
    this.db.update(tasks).set(merged).where(eq(tasks.id, id)).run();
    return merged;
  }

  public deleteTask(id: string): boolean {
    const result = this.db.delete(tasks).where(eq(tasks.id, id)).run();
    return result.changes > 0;
  }

  // --- Properties ------------------------------------------------------

  public addProperty(prop: Property): Property {
    this.db.insert(properties).values(prop).run();
    return prop;
  }

  public updateProperty(id: string, data: Partial<Property>): Property | null {
    const existing = this.db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1)
      .all()[0];
    if (!existing) return null;
    const merged = { ...existing, ...data, id: existing.id };
    this.db.update(properties).set(merged).where(eq(properties.id, id)).run();
    return merged;
  }

  public deleteProperty(id: string): boolean {
    // Cascade is handled by the FK on `property_values`
    // (`onDelete: 'cascade'`); the related rows are deleted
    // automatically as part of the same statement.
    const result = this.db.delete(properties).where(eq(properties.id, id)).run();
    return result.changes > 0;
  }

  // --- Property Values -------------------------------------------------
  // Upsert semantics: a non-zero value replaces or inserts; a
  // zero value (or omitted one) removes the existing row. Same
  // contract the JSON store exposed, so the frontend's
  // "send 0 to clear" behavior stays intact.

  public setPropertyValue(pv: PropertyValue): PropertyValue {
    const existing = this.db
      .select()
      .from(propertyValues)
      .where(
        and(
          eq(propertyValues.propertyId, pv.propertyId),
          eq(propertyValues.date, pv.date)
        )
      )
      .limit(1)
      .all()[0];

    if (existing) {
      if (pv.value && pv.value !== 0) {
        this.db
          .update(propertyValues)
          .set({ value: pv.value })
          .where(eq(propertyValues.id, existing.id))
          .run();
      } else {
        this.db
          .delete(propertyValues)
          .where(eq(propertyValues.id, existing.id))
          .run();
      }
    } else if (pv.value && pv.value !== 0) {
      this.db.insert(propertyValues).values(pv).run();
    }
    return pv;
  }

  // --- Day Notes -------------------------------------------------------

  public setDayNote(note: DayNote): DayNote {
    const existing = this.db
      .select()
      .from(dayNotes)
      .where(eq(dayNotes.date, note.date))
      .limit(1)
      .all()[0];

    if (existing) {
      if (note.note && note.note.trim()) {
        this.db
          .update(dayNotes)
          .set({ note: note.note })
          .where(eq(dayNotes.date, note.date))
          .run();
      } else {
        this.db.delete(dayNotes).where(eq(dayNotes.date, note.date)).run();
      }
    } else if (note.note && note.note.trim()) {
      this.db.insert(dayNotes).values(note).run();
    }
    return note;
  }

  // --- Week Notes ------------------------------------------------------

  public setWeekNote(note: WeekNote): WeekNote {
    const existing = this.db
      .select()
      .from(weekNotes)
      .where(eq(weekNotes.weekStart, note.weekStart))
      .limit(1)
      .all()[0];

    if (existing) {
      if (note.note && note.note.trim()) {
        this.db
          .update(weekNotes)
          .set({ note: note.note })
          .where(eq(weekNotes.weekStart, note.weekStart))
          .run();
      } else {
        this.db.delete(weekNotes).where(eq(weekNotes.weekStart, note.weekStart)).run();
      }
    } else if (note.note && note.note.trim()) {
      this.db.insert(weekNotes).values(note).run();
    }
    return note;
  }
}

/**
 * Default singleton — module caching guarantees one instance
 * per process. Production code (`index.ts`) and any code that
 * doesn't need test isolation uses this directly.
 */
export const store = new DbStore();

/**
 * Wire up signal handlers so `process.exit` flushes the
 * underlying SQLite handle. Mirrors the `JsonStore` era; the
 * `shutdown()` call is a no-op on the store itself but we still
 * want to close the underlying `better-sqlite3` connection so
 * WAL checkpoints land.
 *
 * `process.on` stacks handlers additively, but this module is
 * loaded only once per process (Node's module cache), so these
 * fire exactly once per signal.
 */
process.on('SIGINT', () => store.shutdown());
process.on('SIGTERM', () => store.shutdown());