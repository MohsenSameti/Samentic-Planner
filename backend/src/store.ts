import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORE_PATH = join(__dirname, '..', 'data.json');

interface Store {
  projects: any[];
  tasks: any[];
  properties: any[];
  propertyValues: any[];
  dayNotes: any[];
  weekNotes: any[];
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
  return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
}

function saveStore(store: Store): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export const store = {
  get: getStore,
  save: saveStore,
  
  // Projects
  getProjects: () => getStore().projects,
  addProject: (project: any) => {
    const s = getStore();
    s.projects.push(project);
    saveStore(s);
    return project;
  },
  updateProject: (id: string, data: any) => {
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
  addTask: (task: any) => {
    const s = getStore();
    s.tasks.push(task);
    saveStore(s);
    return task;
  },
  updateTask: (id: string, data: any) => {
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
  addProperty: (prop: any) => {
    const s = getStore();
    s.properties.push(prop);
    saveStore(s);
    return prop;
  },
  updateProperty: (id: string, data: any) => {
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
  setPropertyValue: (pv: any) => {
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
  setDayNote: (note: any) => {
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
  setWeekNote: (note: any) => {
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
