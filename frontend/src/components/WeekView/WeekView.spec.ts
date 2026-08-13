/**
 * Integration tests for the `WeekView` component.
 *
 * `WeekView` is the top of the week-rendering hierarchy. It:
 *   - Derives 7 day cells from `currentWeekStart`
 *   - Filters tasks by `selectedProject`
 *   - Forwards day-level and task-level events from each `DayColumn`
 *
 * Tests pin the clock to a known Monday so day-name and day-number
 * assertions are stable, and exercise the project filter, the
 * event-forwarding path, and the day-cell derivation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekView from './WeekView.vue'
import type { Calendar, Project, Task, Property } from '../../types/index.js'

const now = Date.now()

const baseProject: Project = {
  id: 'p1',
  name: 'A',
  color: '#FF0000',
  createdAt: now,
  updatedAt: now,
}

const otherProject: Project = {
  id: 'p2',
  name: 'B',
  color: '#00FF00',
  createdAt: now,
  updatedAt: now,
}

const taskFor = (projectId: string, date: string, id: string): Task => ({
  id,
  projectId,
  title: `Task ${id}`,
  description: '',
  date,
  status: 'active',
  notes: '',
  createdAt: now,
  updatedAt: now,
})

const baseProps = {
  currentWeekStart: '2024-01-01',
  tasks: [] as Task[],
  projects: [baseProject, otherProject],
  properties: [] as Property[],
  propertyValues: [],
  dayNotes: [],
  selectedProject: 'all',
  calendar: 'gregorian' as Calendar,
}

describe('WeekView', () => {
  beforeEach(() => {
    // Pin to a Monday so the day-name assertions are stable.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  it('renders seven day columns', () => {
    const wrapper = mount(WeekView, { props: baseProps })
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    expect(cols).toHaveLength(7)
  })

  it('labels the day names in en-US short format', () => {
    const wrapper = mount(WeekView, { props: baseProps })
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    const names = cols.map(c => c.props('dayName'))
    expect(names).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('passes day numbers 1..7 to the columns', () => {
    const wrapper = mount(WeekView, { props: baseProps })
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    const nums = cols.map(c => c.props('dayNum'))
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('marks the column whose date matches today as isToday', () => {
    // Today is 2024-01-01 (Monday) per the fake clock. The first
    // column is the only one whose date matches.
    const wrapper = mount(WeekView, { props: baseProps })
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    expect(cols[0]?.props('isToday')).toBe(true)
    expect(cols[1]?.props('isToday')).toBe(false)
  })

  describe('task filtering', () => {
    it('shows all tasks when selectedProject is "all"', () => {
      const tasks = [
        taskFor('p1', '2024-01-01', 't1'),
        taskFor('p2', '2024-01-02', 't2'),
      ]
      const wrapper = mount(WeekView, { props: { ...baseProps, tasks } })
      const titles = wrapper.findAll('.task-title').map(t => t.text())
      expect(titles).toContain('Task t1')
      expect(titles).toContain('Task t2')
    })

    it('hides tasks for other projects when selectedProject is a specific id', async () => {
      const tasks = [
        taskFor('p1', '2024-01-01', 't1'),
        taskFor('p2', '2024-01-02', 't2'),
      ]
      const wrapper = mount(WeekView, {
        props: { ...baseProps, tasks, selectedProject: 'p1' },
      })
      const titles = wrapper.findAll('.task-title').map(t => t.text())
      expect(titles).toContain('Task t1')
      expect(titles).not.toContain('Task t2')
    })

    it('reactively updates the filter when selectedProject changes', async () => {
      const tasks = [
        taskFor('p1', '2024-01-01', 't1'),
        taskFor('p2', '2024-01-02', 't2'),
      ]
      const wrapper = mount(WeekView, { props: { ...baseProps, tasks } })
      expect(wrapper.findAll('.task-title')).toHaveLength(2)

      await wrapper.setProps({ selectedProject: 'p1' })
      const filtered = wrapper.findAll('.task-title').map(t => t.text())
      expect(filtered).toEqual(['Task t1'])
    })
  })

  describe('event forwarding', () => {
    it('forwards add-task from a DayColumn up', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const col = wrapper.findComponent({ name: 'DayColumn' })
      await col.vm.$emit('add-task', '2024-01-03')
      expect(wrapper.emitted('add-task')).toBeTruthy()
      expect(wrapper.emitted('add-task')?.[0]).toEqual(['2024-01-03'])
    })

    it('forwards update-day-note up', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const col = wrapper.findComponent({ name: 'DayColumn' })
      await col.vm.$emit('update-day-note', '2024-01-01', 'hi')
      expect(wrapper.emitted('update-day-note')).toBeTruthy()
      expect(wrapper.emitted('update-day-note')?.[0]).toEqual(['2024-01-01', 'hi'])
    })

    it('forwards toggle-task-status up', async () => {
      const task = taskFor('p1', '2024-01-01', 't1')
      const wrapper = mount(WeekView, { props: { ...baseProps, tasks: [task] } })
      const col = wrapper.findComponent({ name: 'DayColumn' })
      await col.vm.$emit('toggle-task-status', task)
      expect(wrapper.emitted('toggle-task-status')).toBeTruthy()
      expect(wrapper.emitted('toggle-task-status')?.[0]).toEqual([task])
    })

    it('forwards drop-task up with the event and date', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const col = wrapper.findComponent({ name: 'DayColumn' })
      const fakeEvent = new Event('drop') as Event
      await col.vm.$emit('drop-task', fakeEvent, '2024-01-05')
      expect(wrapper.emitted('drop-task')).toBeTruthy()
      expect(wrapper.emitted('drop-task')?.[0]?.[1]).toBe('2024-01-05')
    })
  })

  describe('derived state', () => {
    it('passes a projectsMap (project lookup) to each column', () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const col = wrapper.findComponent({ name: 'DayColumn' })
      const map = col.props('projects') as Map<string, Project>
      expect(map).toBeInstanceOf(Map)
      expect(map.get('p1')?.name).toBe('A')
      expect(map.get('p2')?.name).toBe('B')
    })

    it('passes the day-note value down to each column', () => {
      const dayNotes = [
        { date: '2024-01-03', note: 'middle of week' },
      ]
      const wrapper = mount(WeekView, { props: { ...baseProps, dayNotes } })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      expect(cols[2]?.props('dayNoteValue')).toBe('middle of week')
      // Other columns get an empty string fallback.
      expect(cols[0]?.props('dayNoteValue')).toBe('')
    })

    it('passes Jalali day-num and month-label when calendar is jalali', () => {
      const wrapper = mount(WeekView, {
        props: { ...baseProps, calendar: 'jalali' as Calendar },
      })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      // 2024-01-01 (Mon) is Dey 11, 1402.
      expect(cols[0]?.props('dayNumJalali')).toBe(11)
      expect(cols[0]?.props('monthLabelJalali')).toBe('Dey')
    })

    it('omits Jalali fields when calendar is gregorian', () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      for (const col of cols) {
        expect(col.props('dayNumJalali')).toBeUndefined()
        expect(col.props('monthLabelJalali')).toBeUndefined()
      }
    })
  })
})
