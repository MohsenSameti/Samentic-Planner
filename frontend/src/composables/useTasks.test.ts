/**
 * Tests for the `useTasks` composable.
 *
 * The composable wraps `api` calls with local `ref`-backed state, so
 * the strategy is to stub the `api` module and assert on both the
 * returned refs and the methods that mutate them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasks } from './useTasks.js'
import type { Task } from '../types/index.js'

// Stub the entire `api` module so the composable sees a deterministic
// surface — the composable never sees the real network, only `api.*`.
vi.mock('../api.js', () => ({
  api: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}))

import { api } from '../api.js'

const mockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Test',
  description: '',
  date: '2024-01-01',
  status: 'active',
  notes: '',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with an empty task list', () => {
    const { tasks } = useTasks()
    expect(tasks.value).toEqual([])
  })

  it('loadTasks populates the ref', async () => {
    const seed = [mockTask({ id: 't1' }), mockTask({ id: 't2' })]
    vi.mocked(api.getTasks).mockResolvedValue(seed)
    const { tasks, loadTasks } = useTasks()
    await loadTasks()
    expect(tasks.value).toEqual(seed)
  })

  it('addTask calls api.createTask and appends the result', async () => {
    const created = mockTask({ id: 'new' })
    vi.mocked(api.createTask).mockResolvedValue(created)
    const { tasks, addTask } = useTasks()
    const result = await addTask({
      title: 'New',
      projectId: 'p1',
      description: '',
      date: '2024-01-01',
    })
    expect(result).toEqual(created)
    expect(tasks.value).toContainEqual(created)
    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New',
        status: 'active',
        notes: '',
      }),
    )
  })

  it('updateTask replaces the matching task in the list', async () => {
    const existing = mockTask({ id: 't1', title: 'Old' })
    const updated = mockTask({ id: 't1', title: 'New' })
    vi.mocked(api.updateTask).mockResolvedValue(updated)
    const { tasks, updateTask } = useTasks()
    tasks.value = [existing]
    const result = await updateTask('t1', { title: 'New' })
    expect(result).toEqual(updated)
    expect(tasks.value[0]?.title).toBe('New')
  })

  it('updateTask does nothing if the id is not in the list', async () => {
    const updated = mockTask({ id: 'other' })
    vi.mocked(api.updateTask).mockResolvedValue(updated)
    const { tasks, updateTask } = useTasks()
    const original = mockTask({ id: 't1' })
    tasks.value = [original]
    await updateTask('other', { title: 'X' })
    expect(tasks.value[0]?.title).toBe('Test')
  })

  it('toggleTaskStatus flips active <-> completed', async () => {
    const t = mockTask({ id: 't1', status: 'active' })
    vi.mocked(api.updateTask).mockResolvedValue(mockTask({ id: 't1', status: 'completed' }))
    const { tasks, toggleTaskStatus } = useTasks()
    tasks.value = [t]
    await toggleTaskStatus(t)
    expect(api.updateTask).toHaveBeenCalledWith('t1', { status: 'completed' })

    await toggleTaskStatus(mockTask({ id: 't1', status: 'completed' }))
    expect(api.updateTask).toHaveBeenLastCalledWith('t1', { status: 'active' })
  })

  it('cancelTask sets status to cancelled', async () => {
    vi.mocked(api.updateTask).mockResolvedValue(mockTask({ id: 't1', status: 'cancelled' }))
    const { cancelTask } = useTasks()
    await cancelTask(mockTask({ id: 't1' }))
    expect(api.updateTask).toHaveBeenCalledWith('t1', { status: 'cancelled' })
  })

  it('restoreTask sets status back to active', async () => {
    vi.mocked(api.updateTask).mockResolvedValue(mockTask({ id: 't1', status: 'active' }))
    const { restoreTask } = useTasks()
    await restoreTask(mockTask({ id: 't1', status: 'cancelled' }))
    expect(api.updateTask).toHaveBeenCalledWith('t1', { status: 'active' })
  })

  it('deleteTask removes the task from the list', async () => {
    vi.mocked(api.deleteTask).mockResolvedValue({ success: true })
    const { tasks, deleteTask } = useTasks()
    tasks.value = [mockTask({ id: 't1' }), mockTask({ id: 't2' })]
    await deleteTask(mockTask({ id: 't1' }))
    expect(tasks.value).toHaveLength(1)
    expect(tasks.value[0]?.id).toBe('t2')
  })

  it('moveTask calls updateTask with the new date', async () => {
    vi.mocked(api.updateTask).mockResolvedValue(mockTask({ id: 't1', date: '2024-02-01' }))
    const { moveTask } = useTasks()
    await moveTask(mockTask({ id: 't1' }), '2024-02-01')
    expect(api.updateTask).toHaveBeenCalledWith('t1', { date: '2024-02-01' })
  })

  describe('tasksForProject', () => {
    it('returns the live tasks ref for "all"', () => {
      const { tasks, tasksForProject } = useTasks()
      tasks.value = [mockTask({ id: 't1' })]
      const result = tasksForProject('all')
      expect(result).toBe(tasks.value)
    })

    it('filters by projectId otherwise', () => {
      const { tasks, tasksForProject } = useTasks()
      tasks.value = [
        mockTask({ id: 't1', projectId: 'p1' }),
        mockTask({ id: 't2', projectId: 'p2' }),
      ]
      const filtered = tasksForProject('p1')
      expect(filtered).toHaveLength(1)
      expect(filtered[0]?.id).toBe('t1')
    })
  })
})
