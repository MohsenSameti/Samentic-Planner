import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  Project,
  Task,
  Property,
  PropertyValue,
  DayNote,
  WeekNote,
  State,
} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORE_PATH = join(__dirname, '..', 'data.json');
// Used for atomic writes: write to `tmp` first, then rename to the real
// path. `rename` is atomic on POSIX filesystems, so readers always see
// either the old or the new file, never a partial write.
const STORE_TMP_PATH = `${STORE_PATH}.tmp`;

// Reuse `State` from types.ts as the single source of truth for the store
// shape. Aliased as `Store` so call sites stay unchanged.
type Store = State;

// Debounce window for batched disk writes. Mutations inside this window
// share a single write to reduce I/O under rapid input (e.g. typing into
// a task title).
const SAVE_DELAY_MS = 1000;
// Hard cap: if more than this many mutations queue up between writes,
// flush synchronously instead of waiting for the debounce timer. This
// bounds worst-case data loss on crash.
const MAX_UNSAVED_CHANGES = 10;

// --- Type guards for runtime validation ---
// Parameter types (e.g. `(project: Project)`) only validate the *write*
// path. `loadFromDisk()` reads from data.json via `JSON.parse(...)`, which
// returns `unknown` and bypasses compile-time checks entirely. The guards
// below close that read-path gap: schema drift / corrupted files are
// detected instead of silently propagating into the rest of the app.

function isProject(obj: unknown): obj is Project {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Project;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.color === 'string' &&
    typeof p.createdAt === 'number' &&
    typeof p.updatedAt === 'number'
  );
}

function isTask(obj: unknown): obj is Task {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as Task;
  return (
    typeof t.id === 'string' &&
    typeof t.projectId === 'string' &&
    typeof t.title === 'string' &&
    typeof t.description === 'string' &&
    typeof t.date === 'string' &&
    (t.status === 'active' || t.status === 'completed' || t.status === 'cancelled') &&
    typeof t.notes === 'string' &&
    typeof t.createdAt === 'number' &&
    typeof t.updatedAt === 'number'
  );
}

function isProperty(obj: unknown): obj is Property {
  if (typeof obj !== 'object' || obj === null) return false;
  const p = obj as Property;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.unit === 'string' &&
    typeof p.createdAt === 'number' &&
    typeof p.updatedAt === 'number'
  );
}

function isPropertyValue(obj: unknown): obj is PropertyValue {
  if (typeof obj !== 'object' || obj === null) return false;
  const pv = obj as PropertyValue;
  return (
    typeof pv.id === 'string' &&
    typeof pv.propertyId === 'string' &&
    typeof pv.date === 'string' &&
    typeof pv.value === 'number'
  );
}

function isDayNote(obj: unknown): obj is DayNote {
  if (typeof obj !== 'object' || obj === null) return false;
  const n = obj as DayNote;
  return typeof n.date === 'string' && typeof n.note === 'string';
}

function isWeekNote(obj: unknown): obj is WeekNote {
  if (typeof obj !== 'object' || obj === null) return false;
  const n = obj as WeekNote;
  return typeof n.weekStart === 'string' && typeof n.note === 'string';
}

function isState(obj: unknown): obj is State {
  if (typeof obj !== 'object' || obj === null) return false;
  const s = obj as State;
  return (
    Array.isArray(s.projects) &&
    s.projects.every(isProject) &&
    Array.isArray(s.tasks) &&
    s.tasks.every(isTask) &&
    Array.isArray(s.properties) &&
    s.properties.every(isProperty) &&
    Array.isArray(s.propertyValues) &&
    s.propertyValues.every(isPropertyValue) &&
    Array.isArray(s.dayNotes) &&
    s.dayNotes.every(isDayNote) &&
    Array.isArray(s.weekNotes) &&
    s.weekNotes.every(isWeekNote)
  );
}

/**
 * In-memory JSON store with debounced, atomic disk persistence.
 *
 * Design notes (see plan `02-store-architecture-improvement.md`):
 *
 *  - **Single read on construction.** The file is parsed exactly once;
 *    subsequent reads are O(1) in-memory accesses.
 *
 *  - **Debounced writes.** Mutations call `scheduleSave()` which coalesces
 *    a burst of changes into one write after `SAVE_DELAY_MS` of quiet.
 *
 *  - **Bounded loss on crash.** If `MAX_UNSAVED_CHANGES` mutations queue
 *    up before the debounce fires, the store flushes synchronously. This
 *    caps worst-case data loss at the in-memory state right before the
 *    burst started (typically empty for a typing spike).
 *
 *  - **Atomic writes.** Each flush writes to `data.json.tmp` and then
 *    renames over `data.json`. POSIX rename is atomic, so a reader
 *    never observes a partially-written file.
 *
 *  - **Graceful shutdown.** `shutdown()` cancels any pending timer and
 *    flushes pending changes. The module also wires `SIGINT`/`SIGTERM`
 *    so an in-flight edit isn't lost when the process is stopped.
 */
export class JsonStore {
  private data: State;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private unsavedChanges = 0;

  constructor() {
    this.data = this.loadFromDisk();
  }

  // --- Lifecycle -------------------------------------------------------

  private loadFromDisk(): State {
    if (!existsSync(STORE_PATH)) {
      const fresh = createDefaultState();
      // Persist the default so subsequent reads see a real file rather
      // than re-creating it on every restart.
      this.writeAtomic(fresh);
      return fresh;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
    } catch (err) {
      console.error(
        `[store] Failed to parse ${STORE_PATH}; falling back to an empty ` +
          'in-memory state. The on-disk file is untouched and may be ' +
          'recoverable manually. Error:',
        err
      );
      return createDefaultState();
    }

    if (!isState(parsed)) {
      // Non-fatal: warn loudly so drift is visible, but keep the app running
      // by returning the parsed data. Once the data file is repaired (or the
      // schema migrates) this path becomes a hard error. See plan
      // `13-data-validation.md` for the strict-validation migration.
      console.warn(
        `[store] ${STORE_PATH} does not match the expected schema. ` +
          'Read-path validation failed; using data as-is.'
      );
    }
    return parsed as State;
  }

  /**
   * Flush any pending writes and cancel the debounce timer. Safe to call
   * multiple times; subsequent calls are no-ops.
   */
  public shutdown(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.unsavedChanges > 0) {
      this.flushNow();
    }
  }

  // --- Persistence -----------------------------------------------------

  private scheduleSave(): void {
    this.unsavedChanges++;

    if (this.unsavedChanges >= MAX_UNSAVED_CHANGES) {
      // Too many pending changes — don't risk losing them on a crash.
      // Flush immediately, bypassing the debounce.
      this.flushNow();
      return;
    }

    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.flushNow();
    }, SAVE_DELAY_MS);
  }

  private flushNow(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.writeAtomic(this.data);
    this.unsavedChanges = 0;
  }

  private writeAtomic(state: State): void {
    try {
      writeFileSync(STORE_TMP_PATH, JSON.stringify(state, null, 2));
      renameSync(STORE_TMP_PATH, STORE_PATH);
    } catch (err) {
      console.error('[store] Failed to persist data:', err);
      // Best-effort cleanup of an orphan temp file so it doesn't pile up
      // if rename never completed.
      try {
        if (existsSync(STORE_TMP_PATH)) unlinkSync(STORE_TMP_PATH);
      } catch {
        // Ignore secondary failure; the primary error is already logged.
      }
    }
  }

  // --- Read API --------------------------------------------------------
  // Read methods return references to the in-memory arrays. Mutations
  // through the returned arrays would bypass `scheduleSave`, so callers
  // must go through the mutator methods below. This mirrors the original
  // module's contract.

  public getProjects(): Project[] {
    return this.data.projects;
  }
  public getTasks(): Task[] {
    return this.data.tasks;
  }
  public getProperties(): Property[] {
    return this.data.properties;
  }
  public getPropertyValues(): PropertyValue[] {
    return this.data.propertyValues;
  }
  public getDayNotes(): DayNote[] {
    return this.data.dayNotes;
  }
  public getWeekNotes(): WeekNote[] {
    return this.data.weekNotes;
  }
  public getState(): State {
    return this.data;
  }

  // --- Projects --------------------------------------------------------

  public addProject(project: Project): Project {
    this.data.projects.push(project);
    this.scheduleSave();
    return project;
  }

  public updateProject(
    id: string,
    data: Partial<Project>
  ): Project | null {
    const idx = this.data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.projects[idx] = { ...this.data.projects[idx], ...data };
    this.scheduleSave();
    return this.data.projects[idx];
  }

  public deleteProject(id: string): boolean {
    const idx = this.data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.data.projects.splice(idx, 1);
    // Detach tasks from the deleted project rather than cascading-deleting
    // them — matches the pre-refactor behavior.
    for (const task of this.data.tasks) {
      if (task.projectId === id) task.projectId = '';
    }
    this.scheduleSave();
    return true;
  }

  // --- Tasks -----------------------------------------------------------

  public addTask(task: Task): Task {
    this.data.tasks.push(task);
    this.scheduleSave();
    return task;
  }

  public updateTask(id: string, data: Partial<Task>): Task | null {
    const idx = this.data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.data.tasks[idx] = { ...this.data.tasks[idx], ...data };
    this.scheduleSave();
    return this.data.tasks[idx];
  }

  public deleteTask(id: string): boolean {
    const idx = this.data.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.data.tasks.splice(idx, 1);
    this.scheduleSave();
    return true;
  }

  // --- Properties ------------------------------------------------------

  public addProperty(prop: Property): Property {
    this.data.properties.push(prop);
    this.scheduleSave();
    return prop;
  }

  public updateProperty(
    id: string,
    data: Partial<Property>
  ): Property | null {
    const idx = this.data.properties.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.properties[idx] = { ...this.data.properties[idx], ...data };
    this.scheduleSave();
    return this.data.properties[idx];
  }

  public deleteProperty(id: string): boolean {
    const idx = this.data.properties.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.data.properties.splice(idx, 1);
    // Cascade: drop values for the deleted property so the store doesn't
    // accumulate orphan `PropertyValue` rows.
    this.data.propertyValues = this.data.propertyValues.filter(
      (pv) => pv.propertyId !== id
    );
    this.scheduleSave();
    return true;
  }

  // --- Property Values -------------------------------------------------
  // Upsert semantics: a non-zero value replaces or inserts; a zero/empty
  // value (or omitted one) removes the existing row. Matches the
  // pre-refactor behavior so the frontend can clear a field by sending 0.

  public setPropertyValue(pv: PropertyValue): PropertyValue {
    const idx = this.data.propertyValues.findIndex(
      (p) => p.propertyId === pv.propertyId && p.date === pv.date
    );
    if (idx !== -1) {
      if (pv.value && pv.value !== 0) {
        this.data.propertyValues[idx].value = pv.value;
      } else {
        this.data.propertyValues.splice(idx, 1);
      }
    } else if (pv.value && pv.value !== 0) {
      this.data.propertyValues.push(pv);
    }
    this.scheduleSave();
    return pv;
  }

  // --- Day Notes -------------------------------------------------------

  public setDayNote(note: DayNote): DayNote {
    const idx = this.data.dayNotes.findIndex((n) => n.date === note.date);
    if (idx !== -1) {
      if (note.note && note.note.trim()) {
        this.data.dayNotes[idx].note = note.note;
      } else {
        this.data.dayNotes.splice(idx, 1);
      }
    } else if (note.note && note.note.trim()) {
      this.data.dayNotes.push(note);
    }
    this.scheduleSave();
    return note;
  }

  // --- Week Notes ------------------------------------------------------

  public setWeekNote(note: WeekNote): WeekNote {
    const idx = this.data.weekNotes.findIndex(
      (n) => n.weekStart === note.weekStart
    );
    if (idx !== -1) {
      if (note.note && note.note.trim()) {
        this.data.weekNotes[idx].note = note.note;
      } else {
        this.data.weekNotes.splice(idx, 1);
      }
    } else if (note.note && note.note.trim()) {
      this.data.weekNotes.push(note);
    }
    this.scheduleSave();
    return note;
  }
}

function createDefaultState(): State {
  const now = Date.now();
  return {
    projects: [
      {
        id: 'default',
        name: 'General',
        color: '#E74C3C',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [],
    properties: [],
    propertyValues: [],
    dayNotes: [],
    weekNotes: [],
  };
}

// Singleton — module caching guarantees one instance per process.
export const store = new JsonStore();

// Ensure pending writes hit disk on controlled shutdown. `process.on`
// stacks handlers additively, but the module is loaded only once per
// process (Node's module cache), so these fire exactly once per signal.
process.on('SIGINT', () => store.shutdown());
process.on('SIGTERM', () => store.shutdown());
