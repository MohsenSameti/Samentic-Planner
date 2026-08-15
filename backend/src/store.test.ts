/**
 * Unit tests for the `DbStore` class.
 *
 * Each test creates a fresh `DbStore` backed by an in-memory
 * SQLite DB (`:memory:`). Tests are fully isolated — no temp
 * files, no shared state, no cleanup beyond `store.shutdown()`.
 *
 * Tests focus on the observable behaviour of the store: read
 * APIs return the expected rows after writes; mutations are
 * visible to subsequent reads without debouncing; upsert and
 * cascade semantics match the pre-refactor JSON contract.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DbStore } from './db/store.js'
import type {
  Project,
  Task,
  Property,
  PropertyValue,
  DayNote,
  WeekNote,
} from './types.js'

/**
 * Build a fully-typed `Project` literal with the required timestamps.
 * Tests don't care about exact values, so a single helper avoids
 * having to repeat `createdAt`/`updatedAt` everywhere.
 */
function makeProject(overrides: Partial<Project> & { id: string; name: string }): Project {
  const now = Date.now()
  return {
    id: overrides.id,
    name: overrides.name,
    color: overrides.color ?? '#000000',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function makeTask(overrides: Partial<Task> & { id: string; projectId: string; title: string; date: string }): Task {
  const now = Date.now()
  return {
    id: overrides.id,
    projectId: overrides.projectId,
    title: overrides.title,
    description: overrides.description ?? '',
    date: overrides.date,
    status: overrides.status ?? 'active',
    notes: overrides.notes ?? '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function makeProperty(overrides: Partial<Property> & { id: string; name: string }): Property {
  const now = Date.now()
  return {
    id: overrides.id,
    name: overrides.name,
    unit: overrides.unit ?? '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe('DbStore', () => {
  let store: DbStore

  beforeEach(() => {
    // `:memory:` gives a fresh DB per test. `DbStore` runs
    // migrations on construction so the schema is in place
    // before the seed runs.
    store = new DbStore({ dbPath: ':memory:' })
  })

  afterEach(() => {
    store.shutdown()
  })

  // -----------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------

  describe('initial state', () => {
    it('seeds a default "General" project when the DB is empty', () => {
      const projects = store.getProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0]?.name).toBe('General')
    })

    it('starts every other collection empty', () => {
      expect(store.getTasks()).toEqual([])
      expect(store.getProperties()).toEqual([])
      expect(store.getPropertyValues()).toEqual([])
      expect(store.getDayNotes()).toEqual([])
      expect(store.getWeekNotes()).toEqual([])
    })

    it('exposes the full state via getState()', () => {
      const state = store.getState()
      expect(state).toBeDefined()
      expect(state.projects).toBeDefined()
      expect(state.tasks).toBeDefined()
      expect(state.properties).toBeDefined()
      expect(state.propertyValues).toBeDefined()
      expect(state.dayNotes).toBeDefined()
      expect(state.weekNotes).toBeDefined()
      expect(state.settings).toBeDefined()
    })

    it('seeds default settings (Saturday as week start)', () => {
      const settings = store.getSettings()
      expect(settings.weekStart).toBe(6)
    })

    it('seeds default calendar (gregorian)', () => {
      const settings = store.getSettings()
      expect(settings.calendar).toBe('gregorian')
    })

    it('mutations are visible to subsequent reads without debouncing', () => {
      // The previous JSON store had a 1s debounce + a sync
      // flush on overflow. SQLite has neither: each write is
      // immediately durable. We assert the simpler contract
      // here so a future regression to in-memory-only state
      // would fail loudly.
      const project = makeProject({ id: 'p1', name: 'A' })
      store.addProject(project)
      expect(store.getProjects()).toContainEqual(project)
    })
  })

  // -----------------------------------------------------------------
  // Projects
  // -----------------------------------------------------------------

  describe('projects', () => {
    it('adds a project', () => {
      const project = makeProject({ id: 'p1', name: 'Test', color: '#FF0000' })
      const result = store.addProject(project)
      expect(result).toEqual(project)
      expect(store.getProjects()).toContainEqual(project)
    })

    it('updates an existing project', () => {
      const project = store.addProject(makeProject({ id: 'p1', name: 'Original', color: '#000000' }))
      const updated = store.updateProject('p1', { name: 'Updated' })
      expect(updated).not.toBeNull()
      expect(updated?.name).toBe('Updated')
      expect(updated?.color).toBe('#000000')
      expect(updated?.id).toBe(project.id)
    })

    it('returns null when updating a non-existent project', () => {
      const result = store.updateProject('missing', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('deletes an existing project', () => {
      store.addProject(makeProject({ id: 'p1', name: 'Test' }))
      const lengthBefore = store.getProjects().length
      expect(store.deleteProject('p1')).toBe(true)
      expect(store.getProjects()).toHaveLength(lengthBefore - 1)
      expect(store.getProjects().map(p => p.id)).not.toContain('p1')
    })

    it('returns false when deleting a non-existent project', () => {
      expect(store.deleteProject('missing')).toBe(false)
    })

    it('detaches tasks from a deleted project rather than cascade-deleting', () => {
      // Projects must exist for `deleteProject` to find and detach
      // tasks. Tasks pointing at non-existent project ids are not
      // touched (their projectId stays as-is).
      store.addProject(makeProject({ id: 'p1', name: 'P1' }))
      store.addProject(makeProject({ id: 'p2', name: 'P2' }))
      store.addTask(makeTask({ id: 't1', projectId: 'p1', title: 'A', date: '2024-01-01' }))
      store.addTask(makeTask({ id: 't2', projectId: 'p2', title: 'B', date: '2024-01-01' }))
      store.deleteProject('p1')
      const tasks = store.getTasks()
      const t1 = tasks.find(t => t.id === 't1')
      const t2 = tasks.find(t => t.id === 't2')
      // Task `t1` was attached to the deleted project; its `projectId`
      // should now be empty. Task `t2` is unaffected.
      expect(t1?.projectId).toBe('')
      expect(t2?.projectId).toBe('p2')
    })
  })

  // -----------------------------------------------------------------
  // Tasks
  // -----------------------------------------------------------------

  describe('tasks', () => {
    it('adds a task', () => {
      const task = makeTask({ id: 't1', projectId: 'p1', title: 'A', date: '2024-01-01' })
      expect(store.addTask(task)).toEqual(task)
      expect(store.getTasks()).toContainEqual(task)
    })

    it('updates task status', () => {
      store.addTask(makeTask({ id: 't1', projectId: 'p1', title: 'A', date: '2024-01-01' }))
      const updated = store.updateTask('t1', { status: 'completed' })
      expect(updated?.status).toBe('completed')
    })

    it('returns null when updating a non-existent task', () => {
      expect(store.updateTask('missing', { status: 'completed' })).toBeNull()
    })

    it('deletes an existing task', () => {
      store.addTask(makeTask({ id: 't1', projectId: 'p1', title: 'A', date: '2024-01-01' }))
      expect(store.deleteTask('t1')).toBe(true)
      expect(store.getTasks()).toHaveLength(0)
    })

    it('returns false when deleting a non-existent task', () => {
      expect(store.deleteTask('missing')).toBe(false)
    })
  })

  // -----------------------------------------------------------------
  // Properties
  // -----------------------------------------------------------------

  describe('properties', () => {
    it('adds a property', () => {
      const prop = makeProperty({ id: 'pr1', name: 'Hours', unit: 'h' })
      expect(store.addProperty(prop)).toEqual(prop)
      expect(store.getProperties()).toContainEqual(prop)
    })

    it('updates an existing property', () => {
      store.addProperty(makeProperty({ id: 'pr1', name: 'Hours', unit: 'h' }))
      const updated = store.updateProperty('pr1', { name: 'Hrs' })
      expect(updated?.name).toBe('Hrs')
      expect(updated?.unit).toBe('h')
    })

    it('deletes an existing property and cascades to its values', () => {
      store.addProperty(makeProperty({ id: 'pr1', name: 'Hours', unit: 'h' }))
      store.addProperty(makeProperty({ id: 'other', name: 'Other', unit: '' }))
      store.setPropertyValue({ id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 })
      store.setPropertyValue({ id: 'pv2', propertyId: 'pr1', date: '2024-01-02', value: 3 })
      store.setPropertyValue({ id: 'pv3', propertyId: 'other', date: '2024-01-01', value: 1 })
      expect(store.deleteProperty('pr1')).toBe(true)
      expect(store.getProperties()).toHaveLength(1)
      const remaining = store.getPropertyValues()
      expect(remaining.map(v => v.id)).toEqual(['pv3'])
    })

    it('returns null when updating a non-existent property', () => {
      expect(store.updateProperty('missing', { name: 'X' })).toBeNull()
    })

    it('returns false when deleting a non-existent property', () => {
      expect(store.deleteProperty('missing')).toBe(false)
    })
  })

  // -----------------------------------------------------------------
  // Property values
  // -----------------------------------------------------------------

  describe('property values', () => {
    beforeEach(() => {
      store.addProperty(makeProperty({ id: 'pr1', name: 'Hours', unit: 'h' }))
    })

    it('inserts a new value', () => {
      const pv: PropertyValue = { id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 }
      store.setPropertyValue(pv)
      expect(store.getPropertyValues()).toHaveLength(1)
      expect(store.getPropertyValues()[0]?.value).toBe(5)
    })

    it('updates an existing value (same propertyId + date)', () => {
      store.setPropertyValue({ id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 })
      store.setPropertyValue({ id: 'pv2', propertyId: 'pr1', date: '2024-01-01', value: 7 })
      const values = store.getPropertyValues()
      expect(values).toHaveLength(1)
      expect(values[0]?.value).toBe(7)
    })

    it('removes a row when the new value is 0', () => {
      store.setPropertyValue({ id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 })
      store.setPropertyValue({ id: 'pv2', propertyId: 'pr1', date: '2024-01-01', value: 0 })
      expect(store.getPropertyValues()).toHaveLength(0)
    })

    it('treats different dates as independent rows', () => {
      store.setPropertyValue({ id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 })
      store.setPropertyValue({ id: 'pv2', propertyId: 'pr1', date: '2024-01-02', value: 3 })
      const values = store.getPropertyValues()
      expect(values).toHaveLength(2)
    })
  })

  // -----------------------------------------------------------------
  // Day notes
  // -----------------------------------------------------------------

  describe('day notes', () => {
    it('inserts a new note', () => {
      const note: DayNote = { date: '2024-01-01', note: 'hello' }
      store.setDayNote(note)
      expect(store.getDayNotes()).toHaveLength(1)
      expect(store.getDayNotes()[0]?.note).toBe('hello')
    })

    it('updates an existing note', () => {
      store.setDayNote({ date: '2024-01-01', note: 'one' })
      store.setDayNote({ date: '2024-01-01', note: 'two' })
      const notes = store.getDayNotes()
      expect(notes).toHaveLength(1)
      expect(notes[0]?.note).toBe('two')
    })

    it('removes the note when cleared with an empty string', () => {
      store.setDayNote({ date: '2024-01-01', note: 'hello' })
      store.setDayNote({ date: '2024-01-01', note: '' })
      expect(store.getDayNotes()).toHaveLength(0)
    })

    it('removes the note when cleared with whitespace only', () => {
      store.setDayNote({ date: '2024-01-01', note: 'hello' })
      store.setDayNote({ date: '2024-01-01', note: '   ' })
      expect(store.getDayNotes()).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------
  // Week notes
  // -----------------------------------------------------------------

  describe('week notes', () => {
    it('inserts, updates, and clears a week note', () => {
      const week: WeekNote = { weekStart: '2024-01-01', note: 'plan' }
      store.setWeekNote(week)
      expect(store.getWeekNotes()).toHaveLength(1)

      store.setWeekNote({ weekStart: '2024-01-01', note: 'updated' })
      const notes = store.getWeekNotes()
      expect(notes).toHaveLength(1)
      expect(notes[0]?.note).toBe('updated')

      store.setWeekNote({ weekStart: '2024-01-01', note: '' })
      expect(store.getWeekNotes()).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------

  describe('settings', () => {
    it('returns the persisted settings object', () => {
      expect(store.getSettings()).toEqual({ weekStart: 6, calendar: 'gregorian' })
    })

    it('updates settings and returns the new value', () => {
      const updated = store.updateSettings({ weekStart: 1, calendar: 'jalali' })
      expect(updated).toEqual({ weekStart: 1, calendar: 'jalali' })
      expect(store.getSettings()).toEqual({ weekStart: 1, calendar: 'jalali' })
    })

    it('round-trips a calendar change (gregorian ↔ jalali)', () => {
      const updated = store.updateSettings({ weekStart: 6, calendar: 'jalali' })
      expect(updated.calendar).toBe('jalali')
      const reverted = store.updateSettings({ weekStart: 6, calendar: 'gregorian' })
      expect(reverted.calendar).toBe('gregorian')
    })
  })
})