/**
 * Tests for the `ProjectList` sidebar component.
 *
 * Verifies rendering of the projects list, the "All Tasks" filter,
 * the add project button, and the per-project edit buttons including
 * their accessible names and click isolation.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProjectList from './ProjectList.vue'
import type { Project } from '../../types/index.js'

const now = Date.now()

const testProjects: Project[] = [
  { id: 'p1', name: 'Alpha', color: '#E74C3C', createdAt: now, updatedAt: now },
  { id: 'p2', name: 'Beta', color: '#3498DB', createdAt: now, updatedAt: now },
]

const defaultProps = {
  projects: testProjects,
  selectedProject: 'all',
  taskCounts: { p1: 3, p2: 0 },
  totalActiveTasks: 3,
}

describe('ProjectList', () => {
  it('renders "All Tasks" item and all projects with counts', () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const items = wrapper.findAll('.project-item')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('All Tasks')
    expect(items[0].text()).toContain('3')
    expect(items[1].text()).toContain('Alpha')
    expect(items[1].text()).toContain('3')
    expect(items[2].text()).toContain('Beta')
    expect(items[2].text()).toContain('0')
  })

  it('renders an edit button with accessible name for each project', () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    expect(editButtons).toHaveLength(2)

    expect(editButtons[0].attributes('aria-label')).toBe('Edit Alpha')
    expect(editButtons[1].attributes('aria-label')).toBe('Edit Beta')
  })

  it('does not render an edit button for "All Tasks"', () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const allTasksItem = wrapper.findAll('.project-item')[0]
    expect(allTasksItem.find('.project-edit-btn').exists()).toBe(false)
  })

  it('emits "edit" with the project when an edit button is clicked', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    await editButtons[0].trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')?.[0]).toEqual([testProjects[0]])
  })

  it('does not emit "select" when an edit button is clicked', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    await editButtons[0].trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('does not emit "select" when Enter keydown is pressed on edit button', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    await editButtons[0].trigger('keydown.enter')

    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('does not emit "select" when Space keydown is pressed on edit button', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const editButtons = wrapper.findAll('.project-edit-btn')
    await editButtons[0].trigger('keydown.space')

    expect(wrapper.emitted('select')).toBeFalsy()
  })

  it('emits "select" when a project item itself is clicked', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const items = wrapper.findAll('.project-item')
    await items[1].trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual(['p1'])
  })

  it('emits "add" when the Add Project button is clicked', async () => {
    const wrapper = mount(ProjectList, { props: defaultProps })
    const addBtn = wrapper.find('.add-btn')
    await addBtn.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
  })
})
