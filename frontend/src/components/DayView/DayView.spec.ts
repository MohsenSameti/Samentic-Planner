/**
 * Tests for the `DayView` component.
 *
 * `DayView` is the focused single-day counterpart to `WeekView`. It
 * renders a single day with the same entity event surface as
 * `DayColumn` (so `App.vue` can wire it to the same handlers),
 * plus a header with prev/next-day chevrons and a back-to-week
 * button, a summary line, and the date-picker popover.
 *
 * Tests drive the component in isolation (no composables, no API).
 * The fixture style mirrors `DayColumn.spec.ts` for consistency.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DayView from './DayView.vue'
import type {
  Calendar,
  Project,
  Property,
  PropertyValue,
  Task,
} from '../../types/index.js'

const now = Date.now()

const project: Project = {
  id: 'p1', name: 'A', color: '#FF0000', createdAt: now, updatedAt: now,
}

const projectsMap = new Map<string, Project>([[project.id, project]])

const properties: Property[] = [
  { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
  { id: 'pr2', name: 'Pages', unit: '', createdAt: now, updatedAt: now },
]

const taskFor = (
  projectId: string,
  date: string,
  id: string,
  status: 'active' | 'completed' | 'cancelled' = 'active',
): Task => ({
  id,
  projectId,
  title: `Task ${id}`,
  description: '',
  date,
  status,
  notes: '',
  createdAt: now,
  updatedAt: now,
})

interface SummaryFixture {
  active: number
  completed: number
  cancelled: number
  propertyValues: Array<{ id: string; name: string; unit: string; value: number }>
}

const baseProps = {
  date: '2024-01-15',
  title: '2024-03-04 (Mon)',
  dayNum: 15,
  tasks: [] as Task[],
  projects: projectsMap,
  properties,
  propertyValues: [] as PropertyValue[],
  dayNoteValue: '',
  selectedProject: 'all',
  calendar: 'gregorian' as Calendar,
  summary: {
    active: 0,
    completed: 0,
    cancelled: 0,
    propertyValues: [],
  } as SummaryFixture,
}

describe('DayView', () => {
  describe('header', () => {
    it('renders the back-to-week button', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const back = wrapper.find('button.day-back-btn')
      expect(back.exists()).toBe(true)
      expect(back.attributes('aria-label')).toBe('Back to week')
    })

    it('renders the prev-day chevron with the right aria-label', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const prev = wrapper.find('button.day-prev-btn')
      expect(prev.exists()).toBe(true)
      expect(prev.attributes('aria-label')).toBe('Previous day')
    })

    it('renders the next-day chevron with the right aria-label', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const next = wrapper.find('button.day-next-btn')
      expect(next.exists()).toBe(true)
      expect(next.attributes('aria-label')).toBe('Next day')
    })

    it('renders the date button with formatted date', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const anchor = wrapper.find('.date-anchor')
      expect(anchor.exists()).toBe(true)
      const txt = anchor.text()
      // Anchor label is the new `formatDayTitle` shape: `YYYY-MM-DD (Mon)`.
      // The focused day is Gregorian 2024-01-15 (a Monday).
      expect(txt).toBe('2024-01-15 (Mon)')
    })

    it('renders the new title prop in the header', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const title = wrapper.find('.day-view-title')
      expect(title.exists()).toBe(true)
      // baseProps.title is the pre-formatted string supplied by App.vue.
      expect(title.text()).toBe('2024-03-04 (Mon)')
    })

    it('contains a DatePickerPopover anchored to the header date', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const popover = wrapper.findComponent({ name: 'DatePickerPopover' })
      expect(popover.exists()).toBe(true)
      expect(popover.props('value')).toBe('2024-01-15')
      expect(popover.props('calendar')).toBe('gregorian')
    })
  })

  describe('summary line', () => {
    it('renders the active/done/cancelled counts', () => {
      const wrapper = mount(DayView, {
        props: {
          ...baseProps,
          summary: {
            active: 2,
            completed: 1,
            cancelled: 0,
            propertyValues: [],
          } as SummaryFixture,
        },
      })
      const summary = wrapper.find('.day-view-summary')
      expect(summary.exists()).toBe(true)
      expect(summary.text()).toContain('2')
      expect(summary.text()).toContain('active')
      expect(summary.text()).toContain('1')
      expect(summary.text()).toContain('done')
    })

    it('renders one badge per property with the day\'s value', () => {
      const wrapper = mount(DayView, {
        props: {
          ...baseProps,
          summary: {
            active: 0,
            completed: 0,
            cancelled: 0,
            propertyValues: [
              { id: 'pr1', name: 'Hours', unit: 'h', value: 2.5 },
              { id: 'pr2', name: 'Pages', unit: '', value: 30 },
            ],
          } as SummaryFixture,
        },
      })
      const summary = wrapper.find('.day-view-summary')
      expect(summary.text()).toContain('Hours')
      expect(summary.text()).toContain('2.5')
      expect(summary.text()).toContain('Pages')
      expect(summary.text()).toContain('30')
    })

    it('renders 0/0/0 counts when the day has no tasks', () => {
      const wrapper = mount(DayView, { props: baseProps })
      const summary = wrapper.find('.day-view-summary')
      expect(summary.text()).toContain('0 active')
      expect(summary.text()).toContain('0 done')
      expect(summary.text()).toContain('0 cancelled')
    })
  })

  describe('task list', () => {
    it('renders a TaskCard for each task matching the focused date', () => {
      const tasks = [
        taskFor('p1', '2024-01-15', 't1'),
        taskFor('p1', '2024-01-15', 't2'),
        taskFor('p1', '2024-01-16', 't3'), // different date — must not show
      ]
      const wrapper = mount(DayView, { props: { ...baseProps, tasks } })
      const titles = wrapper.findAll('.task-title').map(t => t.text())
      expect(titles).toContain('Task t1')
      expect(titles).toContain('Task t2')
      expect(titles).not.toContain('Task t3')
    })

    it('shows the empty state when the focused day has no tasks', () => {
      const wrapper = mount(DayView, { props: baseProps })
      expect(wrapper.find('.day-view-empty').exists()).toBe(true)
    })

    it('hides the empty state when the focused day has at least one task', () => {
      const wrapper = mount(DayView, {
        props: { ...baseProps, tasks: [taskFor('p1', '2024-01-15', 't1')] },
      })
      expect(wrapper.find('.day-view-empty').exists()).toBe(false)
    })

    it('respects the selectedProject filter (all shows everything)', () => {
      const tasks = [
        taskFor('p1', '2024-01-15', 't1'),
        taskFor('p1', '2024-01-15', 't2'),
      ]
      const wrapper = mount(DayView, {
        props: { ...baseProps, tasks, selectedProject: 'all' },
      })
      expect(wrapper.findAll('.task-title')).toHaveLength(2)
    })

    it('respects the selectedProject filter (specific id hides others)', () => {
      const otherProject: Project = {
        id: 'p2', name: 'B', color: '#00FF00', createdAt: now, updatedAt: now,
      }
      const map = new Map<string, Project>([
        [project.id, project],
        [otherProject.id, otherProject],
      ])
      const tasks = [
        taskFor('p1', '2024-01-15', 't1'),
        taskFor('p2', '2024-01-15', 't2'),
      ]
      const wrapper = mount(DayView, {
        props: {
          ...baseProps,
          projects: map,
          tasks,
          selectedProject: 'p1',
        },
      })
      const titles = wrapper.findAll('.task-title').map(t => t.text())
      expect(titles).toContain('Task t1')
      expect(titles).not.toContain('Task t2')
    })

    it('reacts to selectedProject changes (tasks appear/disappear)', async () => {
      const tasks = [
        taskFor('p1', '2024-01-15', 't1'),
        taskFor('p1', '2024-01-15', 't2'),
      ]
      const wrapper = mount(DayView, {
        props: { ...baseProps, tasks, selectedProject: 'all' },
      })
      expect(wrapper.findAll('.task-title')).toHaveLength(2)
      await wrapper.setProps({ selectedProject: 'no-such-project' })
      expect(wrapper.findAll('.task-title')).toHaveLength(0)
    })
  })

  describe('day properties', () => {
    it('renders the property section when there are properties', () => {
      const wrapper = mount(DayView, { props: baseProps })
      expect(wrapper.find('.day-view-properties').exists()).toBe(true)
      expect(wrapper.find('.property-label').text()).toBe('Hours')
    })

    it('reflects the current property value in the input', () => {
      const propertyValues: PropertyValue[] = [
        { id: 'pv1', propertyId: 'pr1', date: '2024-01-15', value: 7 },
      ]
      const wrapper = mount(DayView, { props: { ...baseProps, propertyValues } })
      const input = wrapper.find('.property-input').element as HTMLInputElement
      expect(input.value).toBe('7')
    })

    it('emits update-property-value with the parsed number on change', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      const input = wrapper.find('.property-input')
      Object.defineProperty(input.element, 'value', { value: '12', configurable: true })
      await input.trigger('change')
      expect(wrapper.emitted('update-property-value')).toBeTruthy()
      expect(wrapper.emitted('update-property-value')?.[0]).toEqual([
        '2024-01-15', 'pr1', 12,
      ])
    })
  })

  describe('day notes', () => {
    it('renders the DayNotes section', () => {
      const wrapper = mount(DayView, {
        props: { ...baseProps, dayNoteValue: 'a note' },
      })
      expect(wrapper.find('.day-view-notes').exists()).toBe(true)
    })

    it('emits update-day-note on blur of the textarea', async () => {
      const wrapper = mount(DayView, {
        props: { ...baseProps, dayNoteValue: 'old' },
      })
      // DayNotes keeps the textarea collapsed until the toggle is
      // clicked. Open it, set the value, then trigger blur.
      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('.day-notes textarea')
      await textarea.setValue('new note')
      await textarea.trigger('blur')
      expect(wrapper.emitted('update-day-note')).toBeTruthy()
      expect(wrapper.emitted('update-day-note')?.[0]).toEqual(['2024-01-15', 'new note'])
    })
  })

  describe('day navigation', () => {
    it('emits back-to-week when the back button is clicked', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      await wrapper.find('button.day-back-btn').trigger('click')
      expect(wrapper.emitted('back-to-week')).toBeTruthy()
    })

    it('emits prev-day when the prev chevron is clicked', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      await wrapper.find('button.day-prev-btn').trigger('click')
      expect(wrapper.emitted('prev-day')).toBeTruthy()
    })

    it('emits next-day when the next chevron is clicked', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      await wrapper.find('button.day-next-btn').trigger('click')
      expect(wrapper.emitted('next-day')).toBeTruthy()
    })

    it('emits navigate-day with the picked date when the date popover picks a date', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      const popover = wrapper.findComponent({ name: 'DatePickerPopover' })
      expect(popover.exists()).toBe(true)
      popover.vm.$emit('update', '2024-02-01')
      expect(wrapper.emitted('navigate-day')).toBeTruthy()
      expect(wrapper.emitted('navigate-day')?.[0]).toEqual(['2024-02-01'])
    })
  })

  describe('entity event forwarding', () => {
    it('emits add-task with the focused date when add-task is triggered on a task list', async () => {
      // DayView doesn't render an explicit "add task" button in the
      // header — it relies on the existing DayColumn pattern of
      // exposing add-task via the "+" button on the tasks card.
      // We add a small button inside the tasks card for parity.
      const wrapper = mount(DayView, { props: baseProps })
      const addBtn = wrapper.find('button.day-add-task-btn')
      expect(addBtn.exists()).toBe(true)
      await addBtn.trigger('click')
      expect(wrapper.emitted('add-task')).toBeTruthy()
      expect(wrapper.emitted('add-task')?.[0]).toEqual(['2024-01-15'])
    })

    it('forwards toggle-task-status from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      expect(card.exists()).toBe(true)
      await card.vm.$emit('toggle-status', task)
      expect(wrapper.emitted('toggle-task-status')).toBeTruthy()
      expect(wrapper.emitted('toggle-task-status')?.[0]).toEqual([task])
    })

    it('forwards edit-task from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('edit', task)
      expect(wrapper.emitted('edit-task')).toBeTruthy()
      expect(wrapper.emitted('edit-task')?.[0]).toEqual([task])
    })

    it('forwards move-task from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('move', task)
      expect(wrapper.emitted('move-task')).toBeTruthy()
      expect(wrapper.emitted('move-task')?.[0]).toEqual([task])
    })

    it('forwards cancel-task from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('cancel', task)
      expect(wrapper.emitted('cancel-task')).toBeTruthy()
      expect(wrapper.emitted('cancel-task')?.[0]).toEqual([task])
    })

    it('forwards restore-task from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1', 'cancelled')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('restore', task)
      expect(wrapper.emitted('restore-task')).toBeTruthy()
      expect(wrapper.emitted('restore-task')?.[0]).toEqual([task])
    })

    it('forwards delete-task from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1', 'cancelled')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('delete', task)
      expect(wrapper.emitted('delete-task')).toBeTruthy()
      expect(wrapper.emitted('delete-task')?.[0]).toEqual([task])
    })

    it('forwards update-task-notes from a TaskCard', async () => {
      const task = taskFor('p1', '2024-01-15', 't1')
      const wrapper = mount(DayView, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      await card.vm.$emit('update-notes', 'new note text')
      expect(wrapper.emitted('update-task-notes')).toBeTruthy()
      expect(wrapper.emitted('update-task-notes')?.[0]).toEqual([task, 'new note text'])
    })

    it('emits drop-task when something is dropped on the tasks card', async () => {
      const wrapper = mount(DayView, { props: baseProps })
      const tasksCard = wrapper.find('.day-view-tasks')
      const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
        preventDefault?: () => void
      }
      event.preventDefault = () => {}
      await tasksCard.trigger('drop', event)
      expect(wrapper.emitted('drop-task')).toBeTruthy()
      // The emit is `(event, date)`; the date is the second arg.
      expect(wrapper.emitted('drop-task')?.[0]?.[1]).toBe('2024-01-15')
    })
  })
})
