/**
 * Tests for the `Sidebar` component.
 *
 * Verifies that Sidebar renders ProjectList and wires events appropriately,
 * specifically forwarding project edit requests to the parent.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import type { Calendar, Project, Task, Theme, WeekStartDay } from '../../types/index.js'

const now = Date.now()

const testProjects: Project[] = [
  { id: 'p1', name: 'Alpha', color: '#E74C3C', createdAt: now, updatedAt: now },
  { id: 'p2', name: 'Beta', color: '#3498DB', createdAt: now, updatedAt: now },
]

const testTasks: Task[] = [
  {
    id: 't1',
    projectId: 'p1',
    title: 'Task 1',
    description: '',
    date: '2024-01-01',
    status: 'active',
    notes: '',
    createdAt: now,
    updatedAt: now,
  },
]

const defaultProps = {
  projects: testProjects,
  properties: [],
  tasks: testTasks,
  selectedProject: 'all',
  weeklyPropertySums: [],
  theme: 'system' as Theme,
  weekStart: 1 as WeekStartDay,
  calendar: 'gregorian' as Calendar,
  collapsed: false,
}

describe('Sidebar', () => {
  it('renders projects and forwards edit event as edit-project', async () => {
    const wrapper = mount(Sidebar, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    expect(editButtons.length).toBeGreaterThan(0)

    await editButtons[0].trigger('click')

    expect(wrapper.emitted('edit-project')).toBeTruthy()
    expect(wrapper.emitted('edit-project')?.[0]).toEqual([testProjects[0]])
  })

  it('forwards select-project when a project item is clicked', async () => {
    const wrapper = mount(Sidebar, { props: defaultProps })
    const items = wrapper.findAll('.project-item')
    // Item 0 is "All Tasks", item 1 is "Alpha"
    await items[1].trigger('click')

    expect(wrapper.emitted('select-project')).toBeTruthy()
    expect(wrapper.emitted('select-project')?.[0]).toEqual(['p1'])
  })

  it('forwards add-project when Add Project is clicked', async () => {
    const wrapper = mount(Sidebar, { props: defaultProps })
    const addBtn = wrapper.find('.add-btn')
    await addBtn.trigger('click')

    expect(wrapper.emitted('add-project')).toBeTruthy()
  })
})
