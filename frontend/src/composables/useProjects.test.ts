/**
 * Tests for the `useProjects` composable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjects } from './useProjects.js'
import type { Project } from '../types/index.js'

vi.mock('../api.js', () => ({
  api: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}))

import { api } from '../api.js'

const mockProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  name: 'Test',
  color: '#000000',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes empty', () => {
    const { projects } = useProjects()
    expect(projects.value).toEqual([])
  })

  it('loadProjects populates the ref', async () => {
    const seed = [mockProject({ id: 'p1' })]
    vi.mocked(api.getProjects).mockResolvedValue(seed)
    const { projects, loadProjects } = useProjects()
    await loadProjects()
    expect(projects.value).toEqual(seed)
  })

  it('addProject calls api.createProject and appends the result', async () => {
    const created = mockProject({ id: 'new' })
    vi.mocked(api.createProject).mockResolvedValue(created)
    const { projects, addProject } = useProjects()
    const result = await addProject({ name: 'New', color: '#FFF' })
    expect(result).toEqual(created)
    expect(projects.value).toContainEqual(created)
  })

  it('updateProject merges updates into the matching entry', async () => {
    const existing = mockProject({ id: 'p1', name: 'Old' })
    const updated = mockProject({ id: 'p1', name: 'New' })
    vi.mocked(api.updateProject).mockResolvedValue(updated)
    const { projects, updateProject } = useProjects()
    projects.value = [existing]
    const result = await updateProject('p1', { name: 'New' })
    expect(result).toEqual(updated)
    expect(projects.value[0]?.name).toBe('New')
    expect(projects.value[0]?.color).toBe('#000000')
  })

  describe('deleteProject', () => {
    it('removes the project and clears the projectId on every dependent task', async () => {
      vi.mocked(api.deleteProject).mockResolvedValue({ success: true })
      const { projects, deleteProject } = useProjects()
      projects.value = [mockProject({ id: 'p1', name: 'A' })]

      const tasks = [
        { id: 't1', projectId: 'p1' },
        { id: 't2', projectId: 'p1' },
        { id: 't3', projectId: 'p2' },
      ]
      await deleteProject(mockProject({ id: 'p1' }), tasks)
      expect(projects.value).toHaveLength(0)
      // Tasks that pointed at p1 should have projectId cleared.
      expect(tasks[0]?.projectId).toBe('')
      expect(tasks[1]?.projectId).toBe('')
      // Tasks pointing elsewhere should be untouched.
      expect(tasks[2]?.projectId).toBe('p2')
    })

    it('does not touch tasks when no tasks reference the project', async () => {
      vi.mocked(api.deleteProject).mockResolvedValue({ success: true })
      const { projects, deleteProject } = useProjects()
      projects.value = [mockProject({ id: 'p1' })]

      const tasks = [{ id: 't1', projectId: 'p2' }]
      await deleteProject(mockProject({ id: 'p1' }), tasks)
      expect(tasks[0]?.projectId).toBe('p2')
    })
  })
})
