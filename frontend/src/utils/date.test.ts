/**
 * Tests for the pure date helpers.
 *
 * The tests that depend on `new Date()` use a fixed reference date so
 * the assertions don't drift with the wall clock. `vi.useFakeTimers`
 * is restored to real time in the test setup, so a few of these tests
 * explicitly lock the clock to keep things deterministic.
 */
import { describe, expect, it, vi } from 'vitest'
import { getWeekStart, getWeekDays, formatWeekDisplay } from './date.js'

describe('getWeekStart', () => {
  it('returns the same date for a Monday', () => {
    // 2024-01-01 is a Monday.
    const monday = new Date(2024, 0, 1)
    const start = getWeekStart(monday)
    expect(start.getDay()).toBe(1)
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
  })

  it('returns the previous Monday for a Wednesday', () => {
    // 2024-01-03 is a Wednesday.
    const wed = new Date(2024, 0, 3)
    const start = getWeekStart(wed)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(1)
  })

  it('treats Sunday as the *last* day of the previous week (ISO 8601)', () => {
    // 2024-01-07 is a Sunday — it belongs to the week starting 2024-01-01.
    const sun = new Date(2024, 0, 7)
    const start = getWeekStart(sun)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(1)
  })

  it('normalises the time to local midnight', () => {
    const mon = new Date(2024, 0, 1, 14, 30, 45)
    const start = getWeekStart(mon)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
  })

  it('handles month boundaries', () => {
    // 2024-02-01 is a Thursday — its Monday is 2024-01-29.
    const thu = new Date(2024, 1, 1)
    const start = getWeekStart(thu)
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(29)
  })
})

describe('getWeekDays', () => {
  it('returns seven days starting from the given week start', () => {
    const days = getWeekDays('2024-01-01')
    expect(days).toHaveLength(7)
    expect(days.map(d => d.date)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
      '2024-01-06',
      '2024-01-07',
    ])
  })

  it('emits short weekday names in en-US format', () => {
    const days = getWeekDays('2024-01-01')
    expect(days[0]?.name).toBe('Mon')
    expect(days[6]?.name).toBe('Sun')
  })

  it('emits day-of-month numbers', () => {
    const days = getWeekDays('2024-01-01')
    expect(days.map(d => d.dayNum)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('marks the day that matches today as isToday', () => {
    // Pin the clock to a known date so the assertion is stable.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 3, 12, 0, 0)) // Wed Jan 3 2024
    try {
      const days = getWeekDays('2024-01-01')
      const today = days.find(d => d.isToday)
      expect(today?.date).toBe('2024-01-03')
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks no day as today when the week is in the past', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15)) // June 15, 2024
    try {
      const days = getWeekDays('2024-01-01')
      expect(days.every(d => !d.isToday)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('formatWeekDisplay', () => {
  it('formats a single-month week as "Mon D - D, YYYY"', () => {
    expect(formatWeekDisplay('2024-01-01')).toBe('Jan 1 - 7, 2024')
  })

  it('formats a cross-month week as "Mon D - Mon D, YYYY"', () => {
    // 2024-01-29 is a Monday; the week ends on 2024-02-04.
    expect(formatWeekDisplay('2024-01-29')).toBe('Jan 29 - Feb 4, 2024')
  })

  it('formats a cross-year week with the start year', () => {
    // 2023-12-25 is a Monday; the week ends on 2023-12-31.
    expect(formatWeekDisplay('2023-12-25')).toBe('Dec 25 - 31, 2023')
  })
})
