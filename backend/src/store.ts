import { readFileSync, writeFileSync, existsSync } from 'fs';
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

// Reuse `State` from types.ts as the single source of truth for the store
// shape. Aliased as `Store` so call sites stay unchanged.
type Store = State;

// --- Type guards for runtime validation ---
// Parameter types (e.g. `(project: Project)`) only validate the *write*
// path. `getStore()` reads from data.json via `JSON.parse(...)`, which
// returns `any` and bypasses compile-time checks entirely. The guards
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

function getStore(): Store {
  if (!existsSync(STORE_PATH)) {
    const defaultStore: Store = {
      projects: [{
        id: 'default',
        name: 'General',
        color: '#E74C3C',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }],
      tasks: [],
      properties: [],
      propertyValues: [],
      dayNotes: [],
      weekNotes: []
    };
    saveStore(defaultStore);
    return defaultStore;
  }
  const parsed: unknown = JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  if (!isState(parsed)) {
    // Non-fatal: warn loudly so drift is visible, but keep the app running
    // by returning the parsed data. Once the data file is repaired (or the
    // schema migrates) this path becomes a hard error. See plan
    // `13-data-validation.md` for the strict-validation migration.
    console.warn(
      `[store] ${STORE_PATH} does not match the expected schema. ` +
      `Read-path validation failed; using data as-is.`
    );
  }
  return parsed as Store;
}

function saveStore(store: Store): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export const store = {
  get: getStore,
  save: saveStore,

  // Projects
  getProjects: () => getStore().projects,
  addProject: (project: Project) => {
    const s = getStore();
    s.projects.push(project);
    saveStore(s);
    return project;
  },
  updateProject: (id: string, data: Partial<Project>) => {
    const s = getStore();
    const idx = s.projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      s.projects[idx] = { ...s.projects[idx], ...data };
      saveStore(s);
      return s.projects[idx];
    }
    return null;
  },
  deleteProject: (id: string) => {
    const s = getStore();
    s.projects = s.projects.filter(p => p.id !== id);
    // Update tasks to have no project
    s.tasks.forEach(t => {
      if (t.projectId === id) t.projectId = '';
    });
    saveStore(s);
    return true;
  },

  // Tasks
  getTasks: () => getStore().tasks,
  addTask: (task: Task) => {
    const s = getStore();
    s.tasks.push(task);
    saveStore(s);
    return task;
  },
  updateTask: (id: string, data: Partial<Task>) => {
    const s = getStore();
    const idx = s.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      s.tasks[idx] = { ...s.tasks[idx], ...data };
      saveStore(s);
      return s.tasks[idx];
    }
    return null;
  },
  deleteTask: (id: string) => {
    const s = getStore();
    s.tasks = s.tasks.filter(t => t.id !== id);
    saveStore(s);
    return true;
  },

  // Properties
  getProperties: () => getStore().properties,
  addProperty: (prop: Property) => {
    const s = getStore();
    s.properties.push(prop);
    saveStore(s);
    return prop;
  },
  updateProperty: (id: string, data: Partial<Property>) => {
    const s = getStore();
    const idx = s.properties.findIndex(p => p.id === id);
    if (idx !== -1) {
      s.properties[idx] = { ...s.properties[idx], ...data };
      saveStore(s);
      return s.properties[idx];
    }
    return null;
  },
  deleteProperty: (id: string) => {
    const s = getStore();
    s.properties = s.properties.filter(p => p.id !== id);
    s.propertyValues = s.propertyValues.filter(pv => pv.propertyId !== id);
    saveStore(s);
    return true;
  },

  // Property Values
  getPropertyValues: () => getStore().propertyValues,
  setPropertyValue: (pv: PropertyValue) => {
    const s = getStore();
    const idx = s.propertyValues.findIndex(
      p => p.propertyId === pv.propertyId && p.date === pv.date
    );
    if (idx !== -1) {
      if (pv.value && pv.value !== 0) {
        s.propertyValues[idx].value = pv.value;
      } else {
        s.propertyValues.splice(idx, 1);
      }
    } else if (pv.value && pv.value !== 0) {
      s.propertyValues.push(pv);
    }
    saveStore(s);
    return pv;
  },

  // Day Notes
  getDayNotes: () => getStore().dayNotes,
  setDayNote: (note: DayNote) => {
    const s = getStore();
    const idx = s.dayNotes.findIndex(n => n.date === note.date);
    if (idx !== -1) {
      if (note.note && note.note.trim()) {
        s.dayNotes[idx].note = note.note;
      } else {
        s.dayNotes.splice(idx, 1);
      }
    } else if (note.note && note.note.trim()) {
      s.dayNotes.push(note);
    }
    saveStore(s);
    return note;
  },

  // Week Notes
  getWeekNotes: () => getStore().weekNotes,
  setWeekNote: (note: WeekNote) => {
    const s = getStore();
    const idx = s.weekNotes.findIndex(n => n.weekStart === note.weekStart);
    if (idx !== -1) {
      if (note.note && note.note.trim()) {
        s.weekNotes[idx].note = note.note;
      } else {
        s.weekNotes.splice(idx, 1);
      }
    } else if (note.note && note.note.trim()) {
      s.weekNotes.push(note);
    }
    saveStore(s);
    return note;
  },

  // Full state
  getState: () => getStore()
};
