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
import { nextTick } from 'vue'
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
  // `0` is the initial value the composable assigns; the watcher
  // treats it as a "no-trigger-yet" sentinel so the only mount-time
  // scroll comes from the `onMounted` hook.
  goToTodayTrigger: 0,
  pendingTaskIds: new Set<string>(),
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

  it('labels the day names with Persian full names when calendar is jalali (spec §26)', () => {
    const wrapper = mount(WeekView, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    const cols = wrapper.findAllComponents({ name: 'DayColumn' })
    const names = cols.map(c => c.props('dayName'))
    // 2024-01-01..2024-01-07 is Mon..Sun in getDay() order
    // (Mon=1..Sun=0), so the full Persian labels walk through
    // index 1, 2, 3, 4, 5, 6, 0 of JALALI_WEEKDAY_LABELS_LONG.
    expect(names).toEqual([
      '2 Shanbe', '3 Shanbe', '4 Shanbe', '5 Shanbe', 'Jomeh', 'Shanbe', '1 Shanbe',
    ])
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
    // Spec §22: WeekView no longer declares task-level emits; actions
    // go directly from `DayColumn` -> injected `useDayActions()` ->
    // App.vue's handler. WeekView's role is purely to compute the
    // props each column receives. The integration assertion lives
    // in `useDayActions.test.ts` (action channel end-to-end); this
    // block pins the data side instead.

    it('passes the date, day name, and day num to each column', () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      expect(cols[0]?.props('date')).toBe('2024-01-01')
      expect(cols[0]?.props('dayName')).toBe('Mon')
      expect(cols[0]?.props('dayNum')).toBe(1)
      expect(cols[6]?.props('date')).toBe('2024-01-07')
    })

    it('passes the filtered task list to the matching column', () => {
      const tasks = [
        taskFor('p1', '2024-01-03', 'wed-task'),
        taskFor('p1', '2024-01-05', 'fri-task'),
      ]
      const wrapper = mount(WeekView, { props: { ...baseProps, tasks } })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      const wedTitles = cols[2]?.props('tasks').map((t: Task) => t.title)
      const friTitles = cols[4]?.props('tasks').map((t: Task) => t.title)
      expect(wedTitles).toEqual(['Task wed-task'])
      expect(friTitles).toEqual(['Task fri-task'])
    })

    it('does NOT declare any task-level emits (spec §22 acceptance)', () => {
      // After §22 the WeekView wrapper should have no emit bus for
      // the actions surface. We assert this by checking that
      // `wrapper.emitted(...)` returns nothing for every action
      // name — the previous suite relied on each being a real emit,
      // and removing the re-wirings (and the `defineEmits` block)
      // means the bus is empty.
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      // Drive every action on every column and assert the bus is
      // empty — that's the structural guarantee that §22's wiring
      // refactor actually happened.
      const eventNames = [
        'add-task', 'open-day', 'update-day-note', 'update-property-value',
        'drop-task', 'edit-task', 'move-task', 'toggle-task-status',
        'cancel-task', 'restore-task', 'delete-task', 'update-task-notes',
      ] as const
      for (const col of cols) {
        for (const name of eventNames) {
          // Emit directly on the child; WeekView would re-emit if
          // it still had a listener.
          col.vm.$emit(name)
        }
      }
      for (const name of eventNames) {
        expect(wrapper.emitted(name)).toBeFalsy()
      }
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

    it('passes Jalali day-num when calendar is jalali', () => {
      const wrapper = mount(WeekView, {
        props: { ...baseProps, calendar: 'jalali' as Calendar },
      })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      // 2024-01-01 (Mon) is Dey 11, 1402.
      expect(cols[0]?.props('dayNumJalali')).toBe(11)
    })

    it('omits Jalali fields when calendar is gregorian', () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      for (const col of cols) {
        expect(col.props('dayNumJalali')).toBeUndefined()
      }
    })
  })

  describe('auto-scroll to today', () => {
    /**
     * Replace `scrollIntoView` on every element with a spy. happy-dom
     * ships a no-op implementation; we want to count and assert on
     * the calls so we know our scroll logic fires (and fires on the
     * right element).
     *
     * Spy is set up per-test so cleanup is automatic when the test
     * finishes — `vi.restoreAllMocks()` in the global `afterEach`
     * also covers it as a safety net.
     */
    let scrollSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    })

    /**
     * Helper: drain the microtask queue twice. Our `onMounted`
     * callback schedules `nextTick().then(scrollTodayIntoView)`,
     * which runs as a post-flush microtask *after* the test's
     * `await nextTick()` resolves. A second `nextTick` resolves
     * that follow-up microtask, so the scroll has already fired by
     * the time we assert.
     */
    async function settle(): Promise<void> {
      await nextTick()
      await nextTick()
    }

    it('scrolls today into view on initial mount when today is in the week', async () => {
      // Outer beforeEach pins "today" to Mon 2024-01-01 — index 0 of
      // the Mon-start week. Should snap to `start` (no-op scroll
      // because today is already at the left edge).
      mount(WeekView, { props: baseProps })
      await settle()

      // The spy captured exactly one call — the today column.
      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const [options] = scrollSpy.mock.calls[0] ?? []
      expect(options).toMatchObject({ inline: 'start', block: 'nearest' })
    })

    it('scrolls today to `start` when today is mid-week (index 4, Friday)', async () => {
      // Pin "today" to Fri 2024-01-05 (index 4, below the
      // `SCROLL_NEAREST_THRESHOLD` of 5). Should snap to start.
      vi.setSystemTime(new Date('2024-01-05T12:00:00Z'))
      mount(WeekView, { props: baseProps })
      await settle()

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const [options] = scrollSpy.mock.calls[0] ?? []
      expect(options).toMatchObject({ inline: 'start', block: 'nearest' })
    })

    it('uses `nearest` when today is in the last two days of the week', async () => {
      // Pin "today" to Sat 2024-01-06 (index 5). At or beyond the
      // nearest-threshold of 5, so we don't try to scroll past the
      // container's max scroll position.
      vi.setSystemTime(new Date('2024-01-06T12:00:00Z'))
      mount(WeekView, { props: baseProps })
      await settle()

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const [options] = scrollSpy.mock.calls[0] ?? []
      expect(options).toMatchObject({ inline: 'nearest', block: 'nearest' })
    })

    it('also uses `nearest` on the last day of the week (Sunday)', async () => {
      // Today = Sun 2024-01-07 (index 6), the last cell.
      vi.setSystemTime(new Date('2024-01-07T12:00:00Z'))
      mount(WeekView, { props: baseProps })
      await settle()

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const [options] = scrollSpy.mock.calls[0] ?? []
      expect(options).toMatchObject({ inline: 'nearest', block: 'nearest' })
    })

    it('does not call scrollIntoView when today is not in the visible week', async () => {
      // Navigate to a week a year in the future — today is not in
      // this week, so the scroll logic short-circuits entirely.
      mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      await settle()

      expect(scrollSpy).not.toHaveBeenCalled()
    })

    it('scrolls the element that actually carries the `.today` class', async () => {
      // Pin to Wed 2024-01-03 (index 2). The third `DayColumn` is
      // the only one carrying `.today`; the spy was called on that
      // element (preserved via `this`-binding, exposed as
      // `mock.contexts[i]`).
      vi.setSystemTime(new Date('2024-01-03T12:00:00Z'))
      const wrapper = mount(WeekView, { props: baseProps })
      await settle()

      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      const wednesday = cols[2]
      expect(wednesday.props('isToday')).toBe(true)

      expect(scrollSpy).toHaveBeenCalledTimes(1)
      const context = scrollSpy.mock.contexts[0] as HTMLElement
      // The element that had `.today` at the time the scroll fired
      // is the Wed column's root div (the one mounted by
      // `DayColumn`).
      expect(context.classList.contains('today')).toBe(true)
      // And it must NOT be the Mon or Sun column's root.
      expect(cols[0].element).not.toBe(context)
      expect(cols[6]?.element).not.toBe(context)
    })

    it('re-scrolls to today when navigating back from a different week', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      await settle()
      const initialCalls = scrollSpy.mock.calls.length
      expect(initialCalls).toBe(1)

      // Navigate forward one week — today is still Jan 1, but the
      // visible week is Jan 8..14. No scroll.
      await wrapper.setProps({ currentWeekStart: '2024-01-08' })
      await settle()
      expect(scrollSpy.mock.calls.length).toBe(initialCalls)

      // Navigate back to today's week — scroll fires again.
      await wrapper.setProps({ currentWeekStart: '2024-01-01' })
      await settle()
      expect(scrollSpy.mock.calls.length).toBeGreaterThan(initialCalls)
    })

    it('does not scroll when navigating between weeks that do not contain today', async () => {
      // Start in a future week (no today), navigate to an even
      // further future week. Neither week contains today, so the
      // scroll watcher never fires.
      const wrapper = mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      await settle()
      expect(scrollSpy).not.toHaveBeenCalled()

      await wrapper.setProps({ currentWeekStart: '2025-01-13' })
      await settle()
      expect(scrollSpy).not.toHaveBeenCalled()
    })
  })

  describe('goToTodayTrigger (Toolbar Today button)', () => {
    /**
     * The regression test for the mobile bug: when the user is
     * already in today's week, clicking Today should still scroll
     * today's column into view. The `currentWeekStart` watcher
     * can't handle this case because Vue watchers don't fire when
     * the value is unchanged. The trigger watcher must.
     */
    let scrollSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
    })

    async function settle(): Promise<void> {
      await nextTick()
      await nextTick()
    }

    it('scrolls today into view when the trigger fires inside today\'s week', async () => {
      // Today is pinned to Mon 2024-01-01 (index 0). The visible
      // week is already today's week, so `currentWeekStart` does
      // NOT change when we increment the trigger — only the trigger
      // changes.
      const wrapper = mount(WeekView, { props: baseProps })
      await settle()
      const initialCalls = scrollSpy.mock.calls.length
      expect(initialCalls).toBe(1) // mount-time scroll

      await wrapper.setProps({ goToTodayTrigger: 1 })
      await settle()

      // The trigger watcher fired and scrolled.
      expect(scrollSpy.mock.calls.length).toBeGreaterThan(initialCalls)
      const [options] = scrollSpy.mock.calls.at(-1) ?? []
      expect(options).toMatchObject({ inline: 'start', block: 'nearest' })
    })

    it('does not scroll when the trigger sits at its initial value of 0', async () => {
      // Mounting with `goToTodayTrigger: 0` (the composable's
      // initial value) should not double-scroll: the trigger watcher
      // must skip the `n === 0` sentinel so the mount-time scroll
      // remains the only initial scroll.
      mount(WeekView, { props: baseProps })
      await settle()

      expect(scrollSpy).toHaveBeenCalledTimes(1) // the onMounted scroll
    })

    it('does not scroll when the trigger fires but today is not in the visible week', async () => {
      // Defensive: today is not in the visible week, so even if the
      // trigger is incremented, the watcher must short-circuit. In
      // practice `goToToday` always makes the week contain today,
      // but the guard keeps the watcher safe if the trigger is ever
      // wired to anything else.
      const wrapper = mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      await settle()
      expect(scrollSpy).not.toHaveBeenCalled()

      await wrapper.setProps({ goToTodayTrigger: 1 })
      await settle()
      expect(scrollSpy).not.toHaveBeenCalled()
    })

    it('scrolls to today when the trigger fires from a different week', async () => {
      // Cross-week case: the user clicks Today from a different
      // week. Both `currentWeekStart` and `goToTodayTrigger` change
      // in the same flush — the assertion is that *at least one*
      // scroll happened, so the today column is visible after the
      // day-change. (A duplicate scroll is harmless; see the
      // WeekView docstring.)
      const wrapper = mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      await settle()
      expect(scrollSpy).not.toHaveBeenCalled()

      await wrapper.setProps({
        currentWeekStart: '2024-01-01',
        goToTodayTrigger: 1,
      })
      await settle()

      expect(scrollSpy.mock.calls.length).toBeGreaterThan(0)
      const [options] = scrollSpy.mock.calls.at(-1) ?? []
      expect(options).toMatchObject({ inline: 'start', block: 'nearest' })
    })

    it('fires a scroll on each subsequent trigger increment', async () => {
      // The Today button can be tapped multiple times. Each tap
      // should fire a scroll, even between taps the user doesn't
      // navigate weeks. This covers the "user scrolled away, taps
      // Today, scrolls, scrolls again, taps Today again" flow.
      const wrapper = mount(WeekView, { props: baseProps })
      await settle()
      const initialCalls = scrollSpy.mock.calls.length

      await wrapper.setProps({ goToTodayTrigger: 1 })
      await settle()
      const afterFirst = scrollSpy.mock.calls.length
      expect(afterFirst).toBeGreaterThan(initialCalls)

      await wrapper.setProps({ goToTodayTrigger: 2 })
      await settle()
      expect(scrollSpy.mock.calls.length).toBeGreaterThan(afterFirst)
    })

    it('snaps today to `nearest` when the trigger fires and today is in the last two days', async () => {
      // Today pinned to Sat 2024-01-06 (index 5). The trigger
      // fires while today is in the visible week — the watcher's
      // snap-to-start vs `nearest` decision should match what's
      // already in `scrollTodayIntoView`.
      vi.setSystemTime(new Date('2024-01-06T12:00:00Z'))
      const wrapper = mount(WeekView, { props: baseProps })
      await settle()
      const initialCalls = scrollSpy.mock.calls.length

      await wrapper.setProps({ goToTodayTrigger: 1 })
      await settle()

      const triggerScrollCall = scrollSpy.mock.calls.length
      expect(triggerScrollCall).toBeGreaterThan(initialCalls)
      const [options] = scrollSpy.mock.calls.at(-1) ?? []
      expect(options).toMatchObject({ inline: 'nearest', block: 'nearest' })
    })
  })

  /**
   * Regression suite for spec §3 (`docs/specs/7-improve-day-column.md`):
   * `useTodayISO` must keep the `isToday` highlight honest when the
   * wall clock moves. The pre-fix code read `new Date()` inside
   * `weekDays` and `isTodayInVisibleWeek`, so a tab left open across
   * midnight kept showing yesterday's column as today. These tests
   * pin the new behaviour: a tick past midnight moves the highlight
   * to the new day's column, and the today-button scroll path follows
   * the mocked clock.
   */
  describe('today reactivity', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    })

    it('moves the .today highlight to the new day across midnight', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      expect(cols[0]?.props('isToday')).toBe(true)
      expect(cols[1]?.props('isToday')).toBe(false)

      // Roll the clock past local midnight. `useTodayISO`'s
      // 60-second interval picks up the change and the
      // `weekDays` computed re-runs.
      vi.setSystemTime(new Date('2024-01-02T00:00:30Z'))
      vi.advanceTimersByTime(60_000)
      await nextTick()
      await nextTick()

      const updated = wrapper.findAllComponents({ name: 'DayColumn' })
      expect(updated[0]?.props('isToday')).toBe(false)
      expect(updated[1]?.props('isToday')).toBe(true)
      // Every other column must NOT be marked.
      for (let i = 2; i < 7; i++) {
        expect(updated[i]?.props('isToday')).toBe(false)
      }
    })

    it('follows the mocked clock when the Today button fires from a different week', async () => {
      // Start in a week that does not contain today.
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
      const wrapper = mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      await nextTick()
      await nextTick()
      expect(scrollSpy).not.toHaveBeenCalled()

      // Advance to mid-week Wed 2024-01-03 (today = index 2 of the
      // Mon-start week containing 2024-01-01). Advance the
      // composable's 60s timer too so `useTodayISO` re-reads the
      // mocked clock — otherwise the computed stays stale.
      vi.setSystemTime(new Date('2024-01-03T12:00:00Z'))
      vi.advanceTimersByTime(60_000)
      await wrapper.setProps({
        currentWeekStart: '2024-01-01',
        goToTodayTrigger: 1,
      })
      await nextTick()
      await nextTick()

      expect(scrollSpy).toHaveBeenCalled()
      const [options] = scrollSpy.mock.calls.at(-1) ?? []
      expect(options).toMatchObject({ inline: 'start', block: 'nearest' })

      // Sanity: the Wed column (index 2) is now `isToday`.
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      expect(cols[2]?.props('isToday')).toBe(true)
      scrollSpy.mockRestore()
    })
  })

  /**
   * Spec §8: today-orientation pill. The pill is computed inside
   * WeekView (so the calendar logic stays put) and exposed to the
   * parent via `defineExpose`. The parent reads the computed through
   * a template ref. We exercise the seam here so a future refactor
   * that drops the expose (or breaks reactivity) is caught.
   *
   * Vue 3 auto-unwraps refs/computeds on the public instance, so
   * `wrapper.vm.currentDayLabel` is the resolved string (or `null`),
   * not a `Ref` object.
   */
  describe('currentDayLabel (spec §8)', () => {
    it('returns null when today is not in the visible week', () => {
      const wrapper = mount(WeekView, {
        props: { ...baseProps, currentWeekStart: '2025-01-06' },
      })
      const exposed = wrapper.vm as unknown as {
        currentDayLabel: string | null
      }
      expect(exposed.currentDayLabel).toBeNull()
    })

    it('returns the in-week label of the today column', () => {
      // Today is pinned to Mon 2024-01-01 (the first day of the
      // week). Label is weekday short + zero-padded day-of-month.
      const wrapper = mount(WeekView, { props: baseProps })
      const exposed = wrapper.vm as unknown as {
        currentDayLabel: string | null
      }
      expect(exposed.currentDayLabel).toBe('Mon 01')
    })

    it('tracks the today column when the wall clock moves', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const exposed = wrapper.vm as unknown as {
        currentDayLabel: string | null
      }
      expect(exposed.currentDayLabel).toBe('Mon 01')

      // Move today to Wed 2024-01-03 (mid-week).
      vi.setSystemTime(new Date('2024-01-03T12:00:00Z'))
      vi.advanceTimersByTime(60_000)
      await nextTick()
      await nextTick()

      expect(exposed.currentDayLabel).toBe('Wed 03')
    })
  })

  /**
   * Spec §15 step 2: cards in a day column are sorted active
   * first, then completed, then cancelled; ties broken by
   * `createdAt` then `id` so unrelated edits don't reshuffle.
   *
   * Read the rendered DOM order rather than poking at the
   * `tasksByDate` computed directly — that's how the user sees the
   * order, and the existing event-forwarding tests rely on the
   * `wrapper.findAll('.task-title')` ordering already.
   */
  describe('column ordering (spec §15 step 2)', () => {
    const t = (id: string, status: Task['status'], createdAt: number): Task => ({
      id,
      projectId: 'p1',
      title: `Task ${id}`,
      description: '',
      date: '2024-01-01',
      status,
      notes: '',
      createdAt,
      updatedAt: createdAt,
    })

    it('orders cards as active, completed, cancelled', () => {
      // Created in an arbitrary order so the test would fail if
      // creation order leaked through.
      const tasks = [
        t('t-cancelled-1', 'cancelled', 100),
        t('t-completed-1', 'completed', 200),
        t('t-active-1', 'active', 50),
        t('t-cancelled-2', 'cancelled', 300),
        t('t-completed-2', 'completed', 400),
        t('t-active-2', 'active', 500),
      ]
      const wrapper = mount(WeekView, {
        props: { ...baseProps, tasks },
      })
      const titles = wrapper.findAll('.task-title').map(n => n.text())
      // Group order: t-active-1 (oldest active), t-active-2 (newer
      // active), then completed (oldest first), then cancelled
      // (oldest first). `createdAt` ascends within each status.
      expect(titles).toEqual([
        'Task t-active-1',
        'Task t-active-2',
        'Task t-completed-1',
        'Task t-completed-2',
        'Task t-cancelled-1',
        'Task t-cancelled-2',
      ])
    })

    it('keeps the active sequence stable when one task is completed', async () => {
      // The classic regression: toggling one task to completed must
      // move only that task down — the other actives' relative
      // order is preserved.
      const tasks = [
        t('a', 'active', 100),
        t('b', 'active', 200),
        t('c', 'active', 300),
      ]
      const wrapper = mount(WeekView, {
        props: { ...baseProps, tasks },
      })
      expect(wrapper.findAll('.task-title').map(n => n.text())).toEqual([
        'Task a',
        'Task b',
        'Task c',
      ])

      // Toggle `b` to completed via setProps (the real flow is
      // `updateTask`, but `setProps` exercises the same computed).
      await wrapper.setProps({
        tasks: [
          t('a', 'active', 100),
          t('b', 'completed', 200),
          t('c', 'active', 300),
        ],
      })

      expect(wrapper.findAll('.task-title').map(n => n.text())).toEqual([
        'Task a',
        'Task c',
        'Task b',
      ])
    })

    it('uses id as a final tiebreaker when createdAt matches', () => {
      const tasks = [
        t('c', 'active', 100),
        t('a', 'active', 100),
        t('b', 'active', 100),
      ]
      const wrapper = mount(WeekView, {
        props: { ...baseProps, tasks },
      })
      const titles = wrapper.findAll('.task-title').map(n => n.text())
      // id ascends alphabetically when createdAt ties.
      expect(titles).toEqual(['Task a', 'Task b', 'Task c'])
    })
  })

  /**
   * Spec §18: `isPast` is derived from the §3 clock and forwarded
   * to each `DayColumn`. Today stays loudest (no .past); days
   * strictly before today carry the flag; days after today don't.
   */
  describe('isPast (spec §18)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      // Wednesday 2024-01-03 is the "today" for this block.
      vi.setSystemTime(new Date('2024-01-03T12:00:00Z'))
    })

    it('marks only the days strictly before today as isPast', () => {
      const wrapper = mount(WeekView, { props: baseProps })
      const cols = wrapper.findAllComponents({ name: 'DayColumn' })
      // baseProps starts at Mon 2024-01-01. So:
      //   Mon 01 — past
      //   Tue 02 — past
      //   Wed 03 — today (not past)
      //   Thu 04..Sun 07 — future (not past)
      const expected = [true, true, false, false, false, false, false]
      cols.forEach((col, i) => {
        expect(col.props('isPast')).toBe(expected[i])
      })
    })

    it('flips isPast across midnight', async () => {
      const wrapper = mount(WeekView, { props: baseProps })
      expect(
        wrapper.findAllComponents({ name: 'DayColumn' })[2]?.props('isPast'),
      ).toBe(false)

      // Roll the clock forward to Thu 2024-01-04 (Wed → Thu flips
      // Wed from "today" to "past").
      vi.setSystemTime(new Date('2024-01-04T00:00:30Z'))
      vi.advanceTimersByTime(60_000)
      await nextTick()
      await nextTick()
      expect(
        wrapper.findAllComponents({ name: 'DayColumn' })[2]?.props('isPast'),
      ).toBe(true)
    })
  })
})
