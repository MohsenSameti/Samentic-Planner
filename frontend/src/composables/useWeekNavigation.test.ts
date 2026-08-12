/**
 * Tests for `useWeekNavigation`.
 *
 * The composable is fully self-contained (no API calls), so each test
 * gets a fresh instance and exercises the state-mutation methods
 * directly. The clock is faked to a known Monday so the
 * `currentWeekStart` and `goToToday` assertions are stable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeekNavigation } from './useWeekNavigation.js'

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

  it('initialises to the week containing the current date', () => {
    const { currentWeekStart, weekDays } = useWeekNavigation()
    // The Wednesday 2024-01-03 belongs to the week starting Mon 2024-01-01.
    expect(currentWeekStart.value).toBe('2024-01-01')
    expect(weekDays.value).toHaveLength(7)
  })

  it('navigates forward by one week', () => {
    const { currentWeekStart, navigateWeek } = useWeekNavigation()
    navigateWeek(1)
    expect(currentWeekStart.value).toBe('2024-01-08')
  })

  it('navigates backward by one week', () => {
    const { currentWeekStart, navigateWeek } = useWeekNavigation()
    navigateWeek(-1)
    expect(currentWeekStart.value).toBe('2023-12-25')
  })

  it('navigates by arbitrary multiples of 7 days', () => {
    const { currentWeekStart, navigateWeek } = useWeekNavigation()
    navigateWeek(5)
    expect(currentWeekStart.value).toBe('2024-02-05')
    navigateWeek(-3)
    expect(currentWeekStart.value).toBe('2024-01-15')
  })

  it('goToToday returns to the week containing today', () => {
    const { currentWeekStart, navigateWeek, goToToday } = useWeekNavigation()
    navigateWeek(10)
    expect(currentWeekStart.value).not.toBe('2024-01-01')
    goToToday()
    expect(currentWeekStart.value).toBe('2024-01-01')
  })

  it('weekDays updates when currentWeekStart changes', () => {
    const { weekDays, navigateWeek } = useWeekNavigation()
    const initialDates = weekDays.value.map(d => d.date)
    expect(initialDates[0]).toBe('2024-01-01')
    navigateWeek(1)
    const nextDates = weekDays.value.map(d => d.date)
    expect(nextDates[0]).toBe('2024-01-08')
    expect(nextDates[6]).toBe('2024-01-14')
  })

  it('weekStart computed is the same as currentWeekStart', () => {
    const { currentWeekStart, weekStart } = useWeekNavigation()
    expect(weekStart.value).toBe(currentWeekStart.value)
  })
})
