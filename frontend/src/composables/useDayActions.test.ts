/**
 * Tests for the `useDayActions` composable + its integration with
 * App.vue's provide (spec §22).
 *
 * `useDayActions` is the typed seam that replaces the old emit
 * channel on `DayColumn` / `WeekView` / `DayNotes` / `TaskCard`.
 * Migration complete: every consumer now calls the injected
 * action and no longer emits. These tests pin the action channel:
 * the right method is called with the right arguments when the
 * underlying user interaction fires.
 */
import { describe, expect, it } from 'vitest'
import { mountWithActions } from './test-utils'
import DayColumn from '../components/WeekView/DayColumn.vue'
import TaskCard from '../components/WeekView/TaskCard.vue'
import DayNotes from '../components/Notes/DayNotes.vue'
import type { Task } from '../types'

const NOW = Date.now()

const baseTask: Task = {
  id: 't1', projectId: 'p1', title: 'A', description: '',
  date: '2024-01-01', status: 'active', notes: '', createdAt: NOW, updatedAt: NOW,
}

const baseProps = {
  date: '2024-01-01',
  dayName: 'Mon',
  dayNum: 1,
  isToday: false,
  isPast: false,
  tasks: [] as Task[],
  projects: new Map<string, never>(),
  properties: [],
  propertyValues: [],
  dayNoteValue: '',
  pendingTaskIds: new Set<string>(),
  monthMarker: null,
}

describe('useDayActions (spec §22)', () => {
  describe('DayColumn', () => {
    it('calls addTask when the + button is clicked', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      await wrapper.find('.add-task-btn').trigger('click')
      expect(actions.addTask).toHaveBeenCalledWith('2024-01-15')
    })

    // Spec §25: the per-column chevron trigger for `openDay` is gone.
    // Header-click coverage lives in `DayColumn.spec.ts`.

    it('calls dropTask with the original DragEvent and target date', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      const event = new Event('drop', { bubbles: true, cancelable: true })
      ;(event as Event & { preventDefault?: () => void }).preventDefault =
        () => undefined
      await wrapper.find('.day-column').trigger('drop', event)
      expect(actions.dropTask).toHaveBeenCalledTimes(1)
      const call = actions.dropTask.mock.calls[0]
      expect(call?.[1]).toBe('2024-01-15')
    })

    it('calls updatePropertyValue with the parsed number', async () => {
      const props = [
        { id: 'pr1', name: 'Hours', unit: 'h', createdAt: NOW, updatedAt: NOW },
      ]
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, properties: props },
      })
      const input = wrapper.find('.property-input')
      Object.defineProperty(input.element, 'value', {
        value: '12', configurable: true,
      })
      await input.trigger('change')
      expect(actions.updatePropertyValue).toHaveBeenCalledWith(
        '2024-01-01', 'pr1', 12,
      )
    })
  })

  describe('TaskCard', () => {
    const taskProps = {
      task: baseTask,
      project: null as null,
    }

    it('calls toggleTaskStatus when the checkbox is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: taskProps,
      })
      await wrapper.find('.task-checkbox').trigger('click')
      expect(actions.toggleTaskStatus).toHaveBeenCalledWith(baseTask)
    })

    it('calls editTask when the menu Edit item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: taskProps,
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      )
      const editItem = items.find(
        i => (i.textContent || '').includes('Edit'),
      )
      editItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(actions.editTask).toHaveBeenCalledWith(baseTask)
    })

    it('calls moveTask when the menu Move item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: taskProps,
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      )
      const moveItem = items.find(
        i => (i.textContent || '').toLowerCase().includes('move'),
      )
      moveItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(actions.moveTask).toHaveBeenCalledWith(baseTask)
    })

    it('calls updateTaskNotes with the textarea value on blur', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: taskProps,
        attachTo: document.body,
      })
      // Open the notes textarea via the menu.
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      )
      const notesItem = items.find(
        i => (i.textContent || '').toLowerCase().includes('add notes'),
      )
      notesItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wrapper.vm.$nextTick()
      const textarea = wrapper.find('.task-notes textarea')
      await textarea.setValue('a note')
      await textarea.trigger('blur')
      expect(actions.updateTaskNotes).toHaveBeenCalledWith(baseTask, 'a note')
    })
  })

  describe('DayNotes', () => {
    it('calls updateDayNote when the textarea blurs', async () => {
      const { actions } = mountWithActions(DayNotes, {
        props: { date: '2024-01-01', initialValue: '' },
        attachTo: document.body,
      })
      // Open the textarea.
      const toggle = document.body.querySelector(
        '.day-notes-toggle',
      ) as HTMLElement
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      const textarea = document.body.querySelector(
        '.day-notes textarea',
      ) as HTMLTextAreaElement
      expect(textarea).toBeTruthy()
      textarea.value = 'hello'
      textarea.dispatchEvent(new Event('blur'))
      expect(actions.updateDayNote).toHaveBeenCalledWith('2024-01-01', 'hello')
    })
  })
})
