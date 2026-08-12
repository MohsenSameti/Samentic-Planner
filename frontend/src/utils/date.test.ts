/**
 * Tests for the pure date helpers.
 *
 * The tests that depend on `new Date()` use a fixed reference date so
 * the assertions don't drift with the wall clock. `vi.useFakeTimers`
 * is restored to real time in the test setup, so a few of these tests
 * explicitly lock the clock to keep things deterministic.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WEEK_START,
  WEEKDAY_LABELS,
  formatWeekDisplay,
  fromLocalISODate,
  getWeekDays,
  getWeekStart,
  toLocalISODate,
} from './date.js'

describe('getWeekStart', () => {
  it('returns the same date for a Monday when week starts on Monday', () => {
    // 2024-01-01 is a Monday.
    const monday = new Date(2024, 0, 1)
    const start = getWeekStart(monday, 1)
    expect(start.getDay()).toBe(1)
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
  })

  it('returns the previous Monday for a Wednesday when week starts on Monday', () => {
    // 2024-01-03 is a Wednesday.
    const wed = new Date(2024, 0, 3)
    const start = getWeekStart(wed, 1)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(1)
  })

  it('treats Sunday as the *last* day of the previous week (ISO 8601)', () => {
    // 2024-01-07 is a Sunday — it belongs to the week starting 2024-01-01.
    const sun = new Date(2024, 0, 7)
    const start = getWeekStart(sun, 1)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(1)
  })

  it('returns the same date for a Sunday when week starts on Sunday', () => {
    const sun = new Date(2024, 0, 7)
    const start = getWeekStart(sun, 0)
    expect(start.getDay()).toBe(0)
    expect(start.getDate()).toBe(7)
  })

  it('returns the previous Saturday when week starts on Saturday', () => {
    // 2024-01-03 is a Wednesday. With a Saturday-start week the week
    // began on 2023-12-30.
    const wed = new Date(2024, 0, 3)
    const start = getWeekStart(wed, 6)
    expect(start.getDay()).toBe(6)
    expect(start.getFullYear()).toBe(2023)
    expect(start.getMonth()).toBe(11)
    expect(start.getDate()).toBe(30)
  })

  it('returns the same date for a Saturday when week starts on Saturday', () => {
    const sat = new Date(2024, 0, 6)
    const start = getWeekStart(sat, 6)
    expect(start.getDay()).toBe(6)
    expect(start.getDate()).toBe(6)
  })

  it('defaults to Saturday when weekStart is omitted', () => {
    const wed = new Date(2024, 0, 3)
    const start = getWeekStart(wed)
    expect(start.getDay()).toBe(DEFAULT_WEEK_START)
  })

  it('normalises the time to local midnight', () => {
    const mon = new Date(2024, 0, 1, 14, 30, 45)
    const start = getWeekStart(mon, 1)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
  })

  it('handles month boundaries', () => {
    // 2024-02-01 is a Thursday — its Monday-start week is 2024-01-29.
    const thu = new Date(2024, 1, 1)
    const start = getWeekStart(thu, 1)
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(29)
  })

  it('handles year boundaries', () => {
    // 2024-01-01 (Monday) with a Saturday-start week falls back to
    // 2023-12-30 — crossing the year boundary.
    const mon = new Date(2024, 0, 1)
    const start = getWeekStart(mon, 6)
    expect(start.getFullYear()).toBe(2023)
    expect(start.getMonth()).toBe(11)
    expect(start.getDate()).toBe(30)
  })
})

describe('getWeekDays', () => {
  it('returns seven days starting from the given week start (Monday)', () => {
    const days = getWeekDays('2024-01-01', 1)
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

  it('returns seven days starting from Saturday when weekStart=Saturday', () => {
    // 2023-12-30 is a Saturday — the week runs Sat..Fri.
    const days = getWeekDays('2023-12-30', 6)
    expect(days).toHaveLength(7)
    expect(days.map(d => d.date)).toEqual([
      '2023-12-30',
      '2023-12-31',
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ])
  })

  it('normalises the input date to the configured week-start day', () => {
    // Passing a Tuesday while weekStart=Saturday should snap back to
    // the previous Saturday so the returned days start on Saturday.
    const days = getWeekDays('2024-01-02', 6)
    expect(days[0]?.date).toBe('2023-12-30')
    expect(days[0]?.name).toBe('Sat')
  })

  it('emits short weekday names in en-US format', () => {
    const days = getWeekDays('2024-01-01', 1)
    expect(days[0]?.name).toBe('Mon')
    expect(days[6]?.name).toBe('Sun')
  })

  it('emits day-of-month numbers', () => {
    const days = getWeekDays('2024-01-01', 1)
    expect(days.map(d => d.dayNum)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('marks the day that matches today as isToday', () => {
    // Pin the clock to a known date so the assertion is stable.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 3, 12, 0, 0)) // Wed Jan 3 2024
    try {
      const days = getWeekDays('2024-01-01', 1)
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
      const days = getWeekDays('2024-01-01', 1)
      expect(days.every(d => !d.isToday)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('defaults to Saturday-start when weekStart is omitted', () => {
    const days = getWeekDays('2023-12-30')
    expect(days[0]?.name).toBe('Sat')
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

  it('formats a Saturday-start week that crosses into the new year', () => {
    // 2023-12-30 (Sat) .. 2024-01-05 (Fri)
    expect(formatWeekDisplay('2023-12-30')).toBe('Dec 30, 2023 - Jan 5, 2024')
  })
})

describe('WEEKDAY_LABELS', () => {
  it('has seven entries in Date#getDay() order', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7)
    expect(WEEKDAY_LABELS[0]).toBe('Sunday')
    expect(WEEKDAY_LABELS[6]).toBe('Saturday')
  })
})

describe('local ISO date helpers', () => {
  it('formats a Date as YYYY-MM-DD using local components', () => {
    // Build a Date at local midnight so the test is timezone-stable
    // under TZ=UTC.
    const d = new Date(2024, 0, 6) // Sat Jan 6 2024
    expect(toLocalISODate(d)).toBe('2024-01-06')
  })

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = fromLocalISODate('2024-01-06')
    // `getDay()` is timezone-sensitive; asserting on it requires
    // TZ=UTC (the test env). In any other tz the day name would
    // reflect local midnight on that date.
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(6)
    expect(d.getHours()).toBe(0)
  })

  it('round-trips a date through the helpers', () => {
    const original = new Date(2024, 0, 6)
    expect(fromLocalISODate(toLocalISODate(original)).getTime()).toBe(original.getTime())
  })

  it('formats using local components, not UTC', () => {
    // Constructing via `new Date(y, m, d)` puts the Date at local
    // midnight. The local components are then y/m/d regardless of
    // host timezone — unlike `Date#toISOString()`, which would
    // shift by ±1 day outside UTC.
    //
    // We can't change `process.env.TZ` from a test file (the
    // frontend has no @types/node), but this test exercises the
    // exact code path that previously broke in east-of-UTC zones:
    // a Date at local midnight must format back to its own
    // y/m/d, not the UTC equivalent.
    const sat = new Date(2024, 0, 6)
    expect(toLocalISODate(sat)).toBe('2024-01-06')
    // And the inverse: parsing the resulting string as local
    // midnight returns the same calendar day.
    expect(fromLocalISODate(toLocalISODate(sat)).getDate()).toBe(6)
  })

  it('getWeekDays emits the calendar day in the ISO string, not the UTC shifted one', () => {
    // Regression test for the timezone shift bug: with a Saturday
    // week-start, `getWeekDays('2024-01-06', 6)` previously produced
    // Friday (2024-01-05) as its first day in timezones east of UTC
    // because the implementation read ISO dates as UTC. After the
    // fix, the first day is always Saturday regardless of timezone.
    const days = getWeekDays('2024-01-06', 6)
    expect(days[0]?.date).toBe('2024-01-06')
    expect(days[0]?.name).toBe('Sat')
    expect(days[6]?.date).toBe('2024-01-12')
    expect(days[6]?.name).toBe('Fri')
  })
})
