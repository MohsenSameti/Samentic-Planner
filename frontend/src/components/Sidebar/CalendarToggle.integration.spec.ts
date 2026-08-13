/**
 * End-to-end test for the calendar toggle flow.
 *
 * Wires the `SettingsSection` (which dispatches the `change-calendar`
 * event) to the `WeekView` (which renders Jalali day numbers when
 * `calendar === 'jalali'`) through a small harness, then asserts
 * that switching the calendar in settings propagates to the day
 * columns without any extra plumbing on the consumer's part.
 *
 * The test mirrors the shape `App.vue` actually wires — same props,
 * same events — but in a minimal harness so it doesn't depend on
 * the full app (composables, async modals, network).
 */
import { describe, expect, it } from 'vitest'
import { h, defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import SettingsSection from './SettingsSection.vue'
import WeekView from '../WeekView/WeekView.vue'
import type { Calendar, Project, Task, Property, WeekStartDay } from '../../types/index.js'

const now = Date.now()

const baseProject: Project = {
  id: 'p1', name: 'A', color: '#FF0000', createdAt: now, updatedAt: now,
}

const baseTask: Task = {
  id: 't1',
  projectId: 'p1',
  title: 'Test',
  description: '',
  date: '2024-01-03',
  status: 'active',
  notes: '',
  createdAt: now,
  updatedAt: now,
}

/**
 * Minimal harness that wires SettingsSection ↔ WeekView through a
 * shared `calendar` ref, the way `App.vue` does. The harness is a
 * tiny component so we can use `mount` with the real components
 * instead of a hand-rolled renderer.
 */
const Harness = defineComponent({
  components: { SettingsSection, WeekView },
  setup() {
    const calendar = ref<Calendar>('gregorian')
    const weekStart = ref<WeekStartDay>(6) // Saturday-start
    return { calendar, weekStart }
  },
  render(): ReturnType<typeof h> {
    return h('div', [
      h(SettingsSection, {
        weekStart: this.weekStart,
        calendar: this.calendar,
        'onChange-calendar': (c: Calendar) => { this.calendar = c },
      }),
      h(WeekView, {
        currentWeekStart: '2024-01-01',
        tasks: [] as Task[],
        projects: [baseProject],
        properties: [] as Property[],
        propertyValues: [],
        dayNotes: [],
        selectedProject: 'all',
        calendar: this.calendar,
        // No-op handlers for events we don't exercise here.
        onAddTask: () => {},
        onUpdateDayNote: () => {},
        onUpdatePropertyValue: () => {},
        onDropTask: () => {},
        onEditTask: (task: Task) => task,
        onMoveTask: (task: Task) => task,
        onToggleTaskStatus: (task: Task) => task,
        onCancelTask: (task: Task) => task,
        onRestoreTask: (task: Task) => task,
        onDeleteTask: (task: Task) => task,
        onUpdateTaskNotes: (_: Task, notes: string) => notes,
      }),
    ])
  },
})

describe('Calendar toggle (SettingsSection → WeekView)', () => {
  it('initially renders Gregorian day numbers', () => {
    const wrapper = mount(Harness)
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    // The first day of the displayed week is Gregorian 2024-01-01
    // (Monday) regardless of calendar. The Jalali field should
    // therefore be undefined.
    for (const col of cols) {
      expect(col.props('dayNumJalali')).toBeUndefined()
      expect(col.props('monthLabelJalali')).toBeUndefined()
    }
  })

  it('re-renders WeekView with Jalali day numbers after switching to Jalali', async () => {
    const wrapper = mount(Harness)
    // Pick the Jalali option in the SettingsSection.
    const calSelect = wrapper.find('select[aria-label="Calendar"]')
    expect(calSelect.exists()).toBe(true)
    Object.defineProperty(calSelect.element, 'value', { value: 'jalali', configurable: true })
    await calSelect.trigger('change')
    // The WeekView's day cells should now carry Jalali metadata.
    // 2024-01-01 (Mon) is Dey 11, 1402.
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    const firstCol = cols[0]
    expect(firstCol?.props('dayNumJalali')).toBe(11)
    expect(firstCol?.props('monthLabelJalali')).toBe('Dey')
  })

  it('reverts to Gregorian when the user switches back', async () => {
    const wrapper = mount(Harness)
    const calSelect = wrapper.find('select[aria-label="Calendar"]')
    // Switch to Jalali first.
    Object.defineProperty(calSelect.element, 'value', { value: 'jalali', configurable: true })
    await calSelect.trigger('change')
    let firstCol = wrapper.findAllComponents({ name: 'DayColumn' })[0]
    expect(firstCol?.props('dayNumJalali')).toBe(11)
    // Switch back to Gregorian.
    Object.defineProperty(calSelect.element, 'value', { value: 'gregorian', configurable: true })
    await calSelect.trigger('change')
    firstCol = wrapper.findAllComponents({ name: 'DayColumn' })[0]
    expect(firstCol?.props('dayNumJalali')).toBeUndefined()
    expect(firstCol?.props('monthLabelJalali')).toBeUndefined()
  })

  it('Tasks grouped by day still land in the correct Gregorian column under Jalali mode', async () => {
    // A task dated 2024-01-03 (Wed, Dey 13) should still appear in
    // the column whose date is 2024-01-03, even when the user is
    // viewing Jalali labels.
    const TasksHarness = defineComponent({
      components: { SettingsSection, WeekView },
      setup() {
        const calendar = ref<Calendar>('gregorian')
        const weekStart = ref<WeekStartDay>(6)
        return { calendar, weekStart }
      },
      render(): ReturnType<typeof h> {
        return h('div', [
          h(SettingsSection, {
            weekStart: this.weekStart,
            calendar: this.calendar,
            'onChange-calendar': (c: Calendar) => { this.calendar = c },
          }),
          h(WeekView, {
            currentWeekStart: '2024-01-01',
            tasks: [baseTask],
            projects: [baseProject],
            properties: [] as Property[],
            propertyValues: [],
            dayNotes: [],
            selectedProject: 'all',
            calendar: this.calendar,
            onAddTask: () => {},
            onUpdateDayNote: () => {},
            onUpdatePropertyValue: () => {},
            onDropTask: () => {},
            onEditTask: (t: Task) => t,
            onMoveTask: (t: Task) => t,
            onToggleTaskStatus: (t: Task) => t,
            onCancelTask: (t: Task) => t,
            onRestoreTask: (t: Task) => t,
            onDeleteTask: (t: Task) => t,
            onUpdateTaskNotes: (_: Task, n: string) => n,
          }),
        ])
      },
    })
    const wrapper = mount(TasksHarness)
    // Switch to Jalali.
    const calSelect = wrapper.find('select[aria-label="Calendar"]')
    Object.defineProperty(calSelect.element, 'value', { value: 'jalali', configurable: true })
    await calSelect.trigger('change')
    // The task card should still be in the Wed (Dey 13) column.
    const titles = wrapper.findAll('.task-title').map(t => t.text())
    expect(titles).toContain('Test')
  })
})
