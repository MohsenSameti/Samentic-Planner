/**
 * Tests for `useWeekNavigation`.
 *
 * The composable is fully self-contained (no API calls), so each test
 * gets a fresh instance and exercises the state-mutation methods
 * directly. The clock is faked to a known Wednesday so the
 * `currentWeekStart` and `goToToday` assertions are stable across
 * whichever `weekStart` setting is in play.
 */
import { ref } from 'vue'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeekNavigation } from './useWeekNavigation.js'
import type { Calendar, WeekStartDay } from '../types/index.js'

/**
 * The clock is pinned to Wednesday 2024-01-03. For each week-start
 * convention under test, the expected `currentWeekStart` ISO date is
 * computed by hand so the assertions are stable regardless of which
 * convention the test pins.
 *
 * - Monday-start    (1): the week is Mon 2024-01-01 .. Sun 2024-01-07.
 * - Sunday-start    (0): the week is Sun 2023-12-31 .. Sat 2024-01-06.
 * - Saturday-start  (6): the week is Sat 2023-12-30 .. Fri 2024-01-05.
 */
const EXPECTED_BY_WEEK_START: Record<WeekStartDay, string> = {
  0: '2023-12-31',
  1: '2024-01-01',
  2: '2024-01-02',
  3: '2024-01-03',
  4: '2023-12-28',
  5: '2023-12-29',
  6: '2023-12-30',
}

describe('useWeekNavigation', () => {
  beforeEach(() => {
    // Pin the clock to 2024-01-03 (Wednesday) so the "current week"
    // assertions are deterministic.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 3, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state (Saturday-start default)', () => {
    it('initialises to the week containing the current date', () => {
      const { currentWeekStart, weekDays } = useWeekNavigation(ref(6))
      expect(currentWeekStart.value).toBe('2023-12-30')
      expect(weekDays.value).toHaveLength(7)
    })

    it('uses Saturday as the default when no weekStart ref is provided', () => {
      const { currentWeekStart } = useWeekNavigation()
      expect(currentWeekStart.value).toBe('2023-12-30')
    })
  })

  describe('configurable week start', () => {
    it.each([0, 1, 2, 3, 4, 5, 6] as WeekStartDay[])(
      'computes the week-start from weekStart=%i',
      (weekStart) => {
        const { currentWeekStart } = useWeekNavigation(ref(weekStart))
        expect(currentWeekStart.value).toBe(EXPECTED_BY_WEEK_START[weekStart])
      },
    )

    it('re-anchors currentWeekStart to today when weekStart changes', async () => {
      const weekStartRef = ref<WeekStartDay>(1)
      const { currentWeekStart } = useWeekNavigation(weekStartRef)
      expect(currentWeekStart.value).toBe('2024-01-01')

      weekStartRef.value = 6 // Saturday
      // The watch fires on the next tick; assertions before then
      // would observe the stale value.
      await nextTick()
      expect(currentWeekStart.value).toBe('2023-12-30')

      weekStartRef.value = 0 // Sunday
      await nextTick()
      expect(currentWeekStart.value).toBe('2023-12-31')
    })

    it('reflects the new weekStart in derived weekDays', async () => {
      const weekStartRef = ref<WeekStartDay>(1)
      const { weekDays } = useWeekNavigation(weekStartRef)
      expect(weekDays.value[0]?.name).toBe('Mon')

      weekStartRef.value = 6
      await nextTick()
      expect(weekDays.value[0]?.name).toBe('Sat')
    })

    it('clamps out-of-range weekStart values back to the default', async () => {
      // Simulate a hand-edited data.json that ended up with a value
      // outside 0..6 (e.g. due to schema drift). The composable
      // should fall back to the default rather than compute nonsense
      // dates.
      const bad = ref<WeekStartDay>(99 as unknown as WeekStartDay)
      const { weekDays, weekStart } = useWeekNavigation(bad)
      // `weekStart` in the return shape aliases `currentWeekStart`,
      // which we expect to be a valid ISO date — not 'Invalid Date'.
      expect(weekStart.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // And the first day should be the default's Saturday.
      expect(weekDays.value[0]?.name).toBe('Sat')
    })

    it('formats the week-start date using local components', () => {
      // Regression test for the timezone shift bug. The composable
      // previously computed `currentWeekStart` via
      // `.toISOString().split('T')[0]`, which is UTC-relative and
      // produced the wrong calendar day for users east or west of
      // UTC. The fix routes everything through `toLocalISODate`,
      // which formats with the Date's local y/m/d.
      //
      // The test environment is pinned to UTC (see
      // `vitest.config.ts`), so we can't fully simulate a Tehran
      // timezone here — but we *can* verify the contract: the
      // returned ISO string is the same one `toLocalISODate`
      // produces for the computed `Date`.
      const { weekStart } = useWeekNavigation(ref<WeekStartDay>(6))
      // The Saturday of the pinned-clock Wednesday is 2023-12-30.
      expect(weekStart.value).toBe('2023-12-30')
    })
  })

  describe('navigation', () => {
    it('navigates forward by one week', () => {
      const { currentWeekStart, navigateWeek } = useWeekNavigation(ref(1))
      navigateWeek(1)
      expect(currentWeekStart.value).toBe('2024-01-08')
    })

    it('navigates backward by one week', () => {
      const { currentWeekStart, navigateWeek } = useWeekNavigation(ref(1))
      navigateWeek(-1)
      expect(currentWeekStart.value).toBe('2023-12-25')
    })

    it('navigates by arbitrary multiples of 7 days', () => {
      const { currentWeekStart, navigateWeek } = useWeekNavigation(ref(1))
      navigateWeek(5)
      expect(currentWeekStart.value).toBe('2024-02-05')
      navigateWeek(-3)
      expect(currentWeekStart.value).toBe('2024-01-15')
    })

    it('goToToday returns to the week containing today', () => {
      const { currentWeekStart, navigateWeek, goToToday } = useWeekNavigation(ref(1))
      navigateWeek(10)
      expect(currentWeekStart.value).not.toBe('2024-01-01')
      goToToday()
      expect(currentWeekStart.value).toBe('2024-01-01')
    })

    it('goToToday honours the current weekStart setting', () => {
      const { currentWeekStart, navigateWeek, goToToday } = useWeekNavigation(ref(6))
      navigateWeek(2)
      goToToday()
      // 2024-01-03 (Wed) belongs to the Saturday-start week of 2023-12-30.
      expect(currentWeekStart.value).toBe('2023-12-30')
    })
  })

  describe('derived state', () => {
    it('weekDays updates when currentWeekStart changes', () => {
      const { weekDays, navigateWeek } = useWeekNavigation(ref(1))
      const initialDates = weekDays.value.map(d => d.date)
      expect(initialDates[0]).toBe('2024-01-01')
      navigateWeek(1)
      const nextDates = weekDays.value.map(d => d.date)
      expect(nextDates[0]).toBe('2024-01-08')
      expect(nextDates[6]).toBe('2024-01-14')
    })

    it('weekStart computed is the same as currentWeekStart', () => {
      const { currentWeekStart, weekStart } = useWeekNavigation(ref(1))
      expect(weekStart.value).toBe(currentWeekStart.value)
    })

    it('weekDays does not include Jalali fields when calendar is Gregorian', () => {
      const { weekDays } = useWeekNavigation(ref(6), ref<Calendar>('gregorian'))
      for (const d of weekDays.value) {
        expect(d.dayNumJalali).toBeUndefined()
        expect(d.monthLabelJalali).toBeUndefined()
      }
    })

    it('weekDays includes Jalali fields when calendar is Jalali', () => {
      const { weekDays } = useWeekNavigation(ref(6), ref<Calendar>('jalali'))
      // The Saturday-start week containing 2024-01-03 (Wed) is
      // 2023-12-30 .. 2024-01-05. 2024-01-03 falls on Jalali
      // 1402-10-13 (Dey 13).
      const wed = weekDays.value.find(d => d.date === '2024-01-03')
      expect(wed?.dayNumJalali).toBe(13)
      expect(wed?.monthLabelJalali).toBe('Dey')
    })

    it('re-derives weekDays when the calendar ref changes', async () => {
      const calRef = ref<Calendar>('gregorian')
      const { weekDays } = useWeekNavigation(ref(6), calRef)
      expect(weekDays.value[0]?.dayNumJalali).toBeUndefined()

      calRef.value = 'jalali'
      await nextTick()
      expect(weekDays.value[0]?.dayNumJalali).toBeDefined()
      expect(weekDays.value[0]?.monthLabelJalali).toBeDefined()
    })

    it('clamps an out-of-range calendar value to the default', async () => {
      const bad = ref<Calendar>('X' as unknown as Calendar)
      const { weekDays } = useWeekNavigation(ref(6), bad)
      // Falls back to Gregorian — no Jalali fields.
      expect(weekDays.value[0]?.dayNumJalali).toBeUndefined()
    })

    it('does not re-anchor currentWeekStart when calendar changes', async () => {
      const calRef = ref<Calendar>('gregorian')
      const { currentWeekStart } = useWeekNavigation(ref(1), calRef)
      const before = currentWeekStart.value

      calRef.value = 'jalali'
      await nextTick()
      // Calendar is display-only — switching it shouldn't move the week.
      expect(currentWeekStart.value).toBe(before)
    })
  })
})
