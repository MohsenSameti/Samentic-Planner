/**
 * Tests for the `TaskCard` component.
 *
 * `TaskCard` owns its own UI state (notes expansion, menu open/closed,
 * notes buffer) — none of that is exposed as a prop. Tests therefore
 * drive the component through user events: clicks on the menu button,
 * keyboard activation of the checkbox, etc.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskCard from './TaskCard.vue'
import type { Project, Task } from '../../types/index.js'

const now = Date.now()

const baseTask: Task = {
  id: 't1',
  projectId: 'p1',
  title: 'Test Task',
  description: '',
  date: '2024-01-01',
  status: 'active',
  notes: '',
  createdAt: now,
  updatedAt: now,
}

const baseProject: Project = {
  id: 'p1',
  name: 'Project A',
  color: '#FF0000',
  createdAt: now,
  updatedAt: now,
}

describe('TaskCard', () => {
  describe('rendering', () => {
    it('renders the task title', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-title').text()).toBe('Test Task')
    })

    it('renders the description when provided', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, description: 'A description' }, project: baseProject },
      })
      expect(wrapper.find('.task-description').text()).toBe('A description')
    })

    it('omits the description block when the description is empty', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-description').exists()).toBe(false)
    })

    it('renders the project badge when a project is provided', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-project').exists()).toBe(true)
      expect(wrapper.find('.task-project-name').text()).toBe('Project A')
    })

    it('omits the project block when project is null', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: null },
      })
      expect(wrapper.find('.task-project').exists()).toBe(false)
    })

    it('applies the project color to the project dot', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      const dot = wrapper.find('.task-project-dot')
      expect(dot.attributes('style')).toContain('#FF0000')
    })
  })

  describe('status styling', () => {
    it('applies the .completed class to a completed task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('completed')
    })

    it('applies the .cancelled class to a cancelled task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('cancelled')
    })

    it('marks the checkbox as checked when status is completed', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').classes()).toContain('checked')
      expect(wrapper.find('.task-checkbox').attributes('aria-checked')).toBe('true')
    })
  })

  describe('toggle-status', () => {
    it('emits toggle-status when the checkbox is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('click')
      expect(wrapper.emitted('toggle-status')).toBeTruthy()
    })

    it('emits toggle-status on Enter', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('keydown.enter')
      expect(wrapper.emitted('toggle-status')).toBeTruthy()
    })

    it('emits toggle-status on Space', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('keydown.space')
      expect(wrapper.emitted('toggle-status')).toBeTruthy()
    })
  })

  describe('draggable', () => {
    it('is draggable when the task is not cancelled', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-card').attributes('draggable')).toBe('true')
    })

    it('is not draggable when the task is cancelled', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').attributes('draggable')).toBe('false')
    })
  })

  describe('menu', () => {
    it('opens the menu when the kebab button is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-menu').classes()).not.toContain('open')
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(wrapper.find('.task-menu').classes()).toContain('open')
    })

    it('shows edit / move / cancel items when the task is active', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      const labels = items.map(i => i.text())
      expect(labels.some(l => l.includes('Edit'))).toBe(true)
      expect(labels.some(l => l.includes('Move'))).toBe(true)
      expect(labels.some(l => l.includes('Cancel'))).toBe(true)
    })

    it('shows restore / delete items when the task is cancelled', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      const labels = items.map(i => i.text())
      expect(labels.some(l => l.includes('Restore'))).toBe(true)
      expect(labels.some(l => l.includes('Delete'))).toBe(true)
      // Active-only items should not appear.
      expect(labels.some(l => l.includes('Move'))).toBe(false)
    })

    it('emits edit when the Edit item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Edit'))!.trigger('click')
      expect(wrapper.emitted('edit')).toBeTruthy()
    })

    it('emits move when the Move item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Move'))!.trigger('click')
      expect(wrapper.emitted('move')).toBeTruthy()
    })

    it('emits cancel when the Cancel item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Cancel'))!.trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits restore when the Restore item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Restore'))!.trigger('click')
      expect(wrapper.emitted('restore')).toBeTruthy()
    })

    it('emits delete when the Delete item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Delete'))!.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
    })
  })

  describe('notes', () => {
    it('does not show the notes textarea by default', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-notes').classes()).not.toContain('expanded')
    })

    it('expands the notes block when the Add Notes menu item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Notes'))!.trigger('click')
      expect(wrapper.find('.task-notes').classes()).toContain('expanded')
    })

    it('emits update-notes with the new value on textarea blur', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      // Open the notes section.
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = wrapper.findAll('.task-menu-item')
      await items.find(i => i.text().includes('Notes'))!.trigger('click')

      const textarea = wrapper.find('textarea')
      await textarea.setValue('New note content')
      await textarea.trigger('blur')
      expect(wrapper.emitted('update-notes')).toBeTruthy()
      expect(wrapper.emitted('update-notes')?.[0]).toEqual(['New note content'])
    })

    it('seeds the textarea with the task notes prop on mount', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, notes: 'existing' }, project: baseProject },
      })
      // The notes block is collapsed by default, but the prop value
      // is mirrored into a local ref. Force-expansion to assert.
      const vm = wrapper.vm as unknown as { notes: string }
      expect(vm.notes).toBe('existing')
    })
  })

  describe('drag start', () => {
    it('sets the task id as the drag data transfer payload', () => {
      // We test the underlying handler by dispatching the event with
      // a stub `dataTransfer` on the actual DOM element so the
      // property survives Vue Test Utils' trigger wrapping.
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      const setData = vi.fn()
      const card = wrapper.find('.task-card').element as HTMLElement
      // `dispatchEvent` accepts a generic Event; the handler reads
      // `dataTransfer` off it, so we patch the property in.
      const event = new Event('dragstart', { bubbles: true, cancelable: true }) as Event & {
        dataTransfer?: unknown
      }
      event.dataTransfer = { setData, getData: () => 't1' }
      card.dispatchEvent(event)
      expect(setData).toHaveBeenCalledWith('text/plain', 't1')
    })

    it('cancels a drag for a cancelled task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      const setData = vi.fn()
      const card = wrapper.find('.task-card').element as HTMLElement
      const event = new Event('dragstart', { bubbles: true, cancelable: true }) as Event & {
        dataTransfer?: unknown
      }
      event.dataTransfer = { setData, getData: () => '' }
      card.dispatchEvent(event)
      // The handler short-circuits without calling setData.
      expect(setData).not.toHaveBeenCalled()
    })
  })
})
