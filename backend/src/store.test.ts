/**
 * Unit tests for the `JsonStore` class.
 *
 * Each test creates a fresh `JsonStore` pointing at a per-test temp
 * file so the on-disk state is fully isolated. The temp files live
 * under `os.tmpdir()/planner-store-tests/` and are cleaned up in
 * `afterEach`.
 *
 * Tests focus on observable behaviour of the in-memory state plus the
 * debounced write boundary (we use `vi.useFakeTimers()` to advance
 * the debounce window deterministically rather than waiting for real
 * time).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { JsonStore } from './store.js'
import type {
  Project,
  Task,
  Property,
  PropertyValue,
  DayNote,
  WeekNote,
  State,
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

describe('JsonStore', () => {
  let tmpDir: string
  let storePath: string
  let store: JsonStore

  beforeEach(() => {
    // Fake timers so the debounced save fires deterministically when
    // we explicitly `vi.advanceTimersByTime(...)` — without this the
    // test would either race the real timer or take 1s each.
    vi.useFakeTimers()
    tmpDir = mkdtempSync(join(tmpdir(), 'planner-store-tests-'))
    storePath = join(tmpDir, 'data.json')
    store = new JsonStore({ storePath })
  })

  afterEach(() => {
    // `shutdown()` is sync, so it cancels any pending debounce and
    // flushes. After that, the temp dir is safe to delete.
    store.shutdown()
    vi.useRealTimers()
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  // -----------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------

  describe('initial state', () => {
    it('seeds a default "General" project when the file does not exist', () => {
      // The constructor writes the default state to disk on first
      // run; reading it back should show the seeded project.
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

    it('persists the default state to disk immediately on construction', () => {
      // Skip the timer — the file should already exist because
      // `loadFromDisk` writes the default synchronously when none
      // exists.
      expect(existsSync(storePath)).toBe(true)
      const parsed = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(parsed.projects).toHaveLength(1)
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
      // The default 'General' project is seeded on construction, so we
      // add one more, delete it, and expect only the default to remain.
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
      store.setPropertyValue({ id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 })
      store.setPropertyValue({ id: 'pv2', propertyId: 'pr1', date: '2024-01-02', value: 3 })
      store.setPropertyValue({ id: 'pv3', propertyId: 'other', date: '2024-01-01', value: 1 })
      expect(store.deleteProperty('pr1')).toBe(true)
      expect(store.getProperties()).toHaveLength(0)
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
      expect(store.getSettings()).toEqual({ weekStart: 6 })
    })

    it('updates settings and persists the change', () => {
      const updated = store.updateSettings({ weekStart: 1 })
      expect(updated).toEqual({ weekStart: 1 })
      expect(store.getSettings()).toEqual({ weekStart: 1 })
      // The update is debounced; advance the timer and read back from
      // disk to confirm the write landed.
      vi.advanceTimersByTime(1000)
      const onDisk = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(onDisk.settings.weekStart).toBe(1)
    })
  })

  // -----------------------------------------------------------------
  // Persistence / debounce
  // -----------------------------------------------------------------

  describe('persistence', () => {
    it('does not write synchronously for a single mutation', () => {
      store.addProject(makeProject({ id: 'p1', name: 'A' }))
      // `vi.advanceTimersByTime` with no args would be 0; we use the
      // simpler `vi.getTimerCount()` to check the timer exists.
      expect(vi.getTimerCount()).toBeGreaterThan(0)
    })

    it('flushes pending writes after the debounce window elapses', () => {
      store.addProject(makeProject({ id: 'p1', name: 'A' }))
      // Advance just before the window — file should not exist.
      vi.advanceTimersByTime(999)
      // The constructor wrote the default state, so the file *does*
      // exist; the test is whether the *new* project is in it.
      const beforeTimer = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(beforeTimer.projects.map(p => p.id)).not.toContain('p1')

      // Advance past the debounce window.
      vi.advanceTimersByTime(2)
      const afterTimer = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(afterTimer.projects.map(p => p.id)).toContain('p1')
    })

    it('coalesces multiple mutations within the debounce window into a single write', () => {
      store.addProject(makeProject({ id: 'p1', name: 'A' }))
      store.addTask(makeTask({ id: 't1', projectId: 'p1', title: 'A', date: '2024-01-01' }))
      store.addProperty(makeProperty({ id: 'pr1', name: 'H' }))

      vi.advanceTimersByTime(1000)
      const written = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(written.projects.map(p => p.id)).toContain('p1')
      expect(written.tasks.map(t => t.id)).toContain('t1')
      expect(written.properties.map(p => p.id)).toContain('pr1')
    })

    it('flushes synchronously once MAX_UNSAVED_CHANGES is reached', () => {
      // MAX_UNSAVED_CHANGES is 10; we send 10 mutations and expect
      // the file to be written before the debounce timer fires.
      for (let i = 0; i < 10; i++) {
        store.addProject(makeProject({ id: `p${i}`, name: `P${i}` }))
      }
      // No timer advance — the cap should have triggered a sync flush.
      const written = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(written.projects.length).toBe(11) // 1 default + 10
    })

    it('shutdown() flushes any pending writes immediately', () => {
      store.addProject(makeProject({ id: 'p1', name: 'A' }))
      // We intentionally do NOT advance the debounce. `shutdown` is
      // the contract: "everything I have in memory is on disk after
      // this returns."
      store.shutdown()
      const written = JSON.parse(readFileSync(storePath, 'utf-8')) as State
      expect(written.projects.map(p => p.id)).toContain('p1')
    })

    it('survives a reload — a new JsonStore reads back the previous state', () => {
      store.addProject(makeProject({ id: 'p1', name: 'A' }))
      store.shutdown() // ensures the writes hit disk

      const reloaded = new JsonStore({ storePath })
      const projects = reloaded.getProjects()
      // Default project + the one we added.
      expect(projects.map(p => p.id)).toContain('p1')
      reloaded.shutdown()
    })
  })

  // -----------------------------------------------------------------
  // Read-path validation
  // -----------------------------------------------------------------

  describe('read-path validation', () => {
    it('falls back to defaults when the on-disk JSON is malformed', () => {
      const dir = mkdtempSync(join(tmpdir(), 'planner-bad-'))
      const badPath = join(dir, 'data.json')
      writeFileSync(badPath, '{ not json')
      const bad = new JsonStore({ storePath: badPath })
      // Falls back to the default seeded state.
      expect(bad.getProjects().map(p => p.id)).toEqual(['default'])
      bad.shutdown()
      rmSync(dir, { recursive: true, force: true })
    })

    it('seeds default settings for legacy data files missing the field', () => {
      const dir = mkdtempSync(join(tmpdir(), 'planner-legacy-'))
      const legacyPath = join(dir, 'data.json')
      // Pre-`settings` shape: same collections but no `settings` key.
      writeFileSync(
        legacyPath,
        JSON.stringify({
          projects: [],
          tasks: [],
          properties: [],
          propertyValues: [],
          dayNotes: [],
          weekNotes: [],
        })
      )
      const migrated = new JsonStore({ storePath: legacyPath })
      // Migration should have run and the in-memory state carries the
      // default settings.
      expect(migrated.getSettings()).toEqual({ weekStart: 6 })
      migrated.shutdown()
      // The migrated file should now also contain settings on disk.
      const onDisk = JSON.parse(readFileSync(legacyPath, 'utf-8')) as State
      expect(onDisk.settings).toEqual({ weekStart: 6 })
      rmSync(dir, { recursive: true, force: true })
    })
  })
})
