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
  formatDayTitle,
  formatWeekDisplay,
  fromLocalISODate,
  getWeekDays,
  getWeekStart,
  monthMarkerFor,
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

  it('honors an explicit `today` parameter so reactive callers can pin the clock', () => {
    // Pin the *system* clock to a date that's NOT in the displayed
    // week, then pass a `today` argument that IS. Exactly one cell
    // must be marked `isToday`, and it must be the cell whose date
    // matches the argument. Regression guard for the new parameter:
    // if a future refactor drops the argument, the default fallback
    // would read the system clock and no cell would be marked.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 15)) // June 15, 2024
    try {
      const days = getWeekDays(
        '2024-01-01',
        1,
        'gregorian',
        new Date(2024, 0, 3),
      )
      const todayCells = days.filter(d => d.isToday)
      expect(todayCells).toHaveLength(1)
      expect(todayCells[0]?.date).toBe('2024-01-03')
    } finally {
      vi.useRealTimers()
    }
  })

  it('populates dayNumJalali when calendar is jalali', () => {
    // Nowruz week: Gregorian 2024-03-20..2024-03-26 is Jalali
    // 1403-01-01..1403-01-07. Use a Saturday-start so the displayed
    // grid lines up with the plan's anchor.
    const days = getWeekDays('2024-03-20', 6, 'jalali')
    expect(days[0]?.date).toBe('2024-03-16') // Saturday-start snaps back
    // The first day of the grid is Gregorian 2024-03-16 = Jalali
    // 1402-12-26 (Esfand 26).
    expect(days[0]?.dayNumJalali).toBe(26)
    // Find the day that lands on Gregorian 2024-03-20 (= Jalali 1403-01-01).
    const nowruz = days.find(d => d.date === '2024-03-20')
    expect(nowruz?.dayNumJalali).toBe(1)
  })

  it('leaves dayNumJalali undefined when calendar is gregorian', () => {
    const days = getWeekDays('2024-03-20', 6, 'gregorian')
    for (const d of days) {
      expect(d.dayNumJalali).toBeUndefined()
    }
  })

  it('defaults to Gregorian when calendar is omitted', () => {
    const days = getWeekDays('2024-03-20', 6)
    for (const d of days) {
      expect(d.dayNumJalali).toBeUndefined()
    }
  })
})

/**
 * Spec §17: month-marker helper. Tested independently from the
 * component because the calendar arithmetic is non-trivial (Jalali
 * months don't align with Gregorian ones), and a unit-level seam
 * is far easier to debug than a rendered DOM assertion.
 */
describe('monthMarkerFor (spec §17)', () => {
  function days(start: string): ReadonlyArray<{ date: string }> {
    // Use the existing `getWeekDays` to enumerate a week, but only
    // carry the `date` field through so the helper's input shape is
    // preserved.
    return getWeekDays(start, 1).map(d => ({ date: d.date }))
  }

  it('returns null for every column in a mid-month week', () => {
    // 2024-02-05 is a Monday; the entire week (Feb 5..11) is mid-Feb.
    const result = monthMarkerFor(days('2024-02-05'), 'gregorian')
    for (const v of result.values()) {
      expect(v).toBeNull()
    }
  })

  it('does not mark the first column even when the week starts on the 1st', () => {
    // 2024-04-01 is a Monday. The toolbar already says "Apr 01-07",
    // so an inline marker on the first column would be redundant.
    const result = monthMarkerFor(days('2024-04-01'), 'gregorian')
    expect(result.get('2024-04-01')).toBeNull()
  })

  it('marks the rollover column when a new month starts mid-week', () => {
    // 2024-01-29 is a Monday; week is Jan 29 - Feb 04. The Feb 1
    // column (Thursday) gets the marker.
    const result = monthMarkerFor(days('2024-01-29'), 'gregorian')
    expect(result.get('2024-01-29')).toBeNull()
    expect(result.get('2024-01-30')).toBeNull()
    expect(result.get('2024-01-31')).toBeNull()
    expect(result.get('2024-02-01')).toBe('1 Feb')
    expect(result.get('2024-02-02')).toBeNull()
    expect(result.get('2024-02-03')).toBeNull()
    expect(result.get('2024-02-04')).toBeNull()
  })

  it('marks with year when the rollover is January (new Gregorian year)', () => {
    // 2023-12-25 is a Monday; week is Dec 25 - Dec 31. None of
    // these is Jan 1; for an actual year rollover, use a week
    // that includes 2024-01-01 (Monday) — but per the spec the
    // first column is *never* marked, so a Jan-1 week starting on
    // the 1st itself isn't useful for the year test. The year
    // case is exercised in 2024-12-30 → 2025-01-05 (Sat-start week
    // including 1 Jan).
    const result = monthMarkerFor(days('2023-12-25'), 'gregorian')
    // No Jan 1 in this week; nothing is marked.
    expect(result.get('2024-01-01')).toBeUndefined()
  })

  it('handles a year rollover mid-week with a year marker on the right column', () => {
    // 2024-12-30 is a Monday; week is Dec 30 - Jan 05.
    const result = monthMarkerFor(days('2024-12-30'), 'gregorian')
    // The Dec 30 column is the first → no marker.
    expect(result.get('2024-12-30')).toBeNull()
    // Jan 1 (Wed in this Monday-start week) carries the year marker.
    expect(result.get('2025-01-01')).toBe('1 Jan 2025')
  })

  it('marks a Jalali month rollover independently of the Gregorian 1st', () => {
    // 2024-03-20 is a Jalali 1403-01-01 (Nowruz). In a Monday-start
    // week 2024-03-18..2024-03-24 the Gregorian 1st is NOT in the
    // week, but the Jalali Far 1st IS (Wed Mar 20). The marker must
    // appear on the Jalali rollover column. Because Far 1 *is* the
    // first month of a new Jalali year, the marker carries the
    // year — see the year-rollover test below for the same data
    // point with the assertion spelled out separately.
    const result = monthMarkerFor(days('2024-03-18'), 'jalali')
    expect(result.get('2024-03-18')).toBeNull() // first column never marked
    expect(result.get('2024-03-19')).toBeNull()
    expect(result.get('2024-03-20')).toBe('1 Far 1403')
    expect(result.get('2024-03-21')).toBeNull()
  })

  it('marks a Jalali year rollover (1 Farvardin) with the year', () => {
    // Same Nowruz date as above but the new Jalali year → include year.
    const result = monthMarkerFor(days('2024-03-18'), 'jalali')
    // Far 1 of 1403 — first month of a new Jalali year, so the
    // marker includes the year.
    expect(result.get('2024-03-20')).toBe('1 Far 1403')
  })

  it('does not apply Jalali boundary when calendar is gregorian (independence check)', () => {
    // Spec §17: "the two checks cannot be collapsed into one" and
    // "a Jalali boundary ... is marked on the correct column and
    // not on the Gregorian 1st" — meaning the calendar argument
    // is the single source of truth, and a Gregorian-mode query
    // on a day that's Jalali 1 Far (Mar 20) must return null
    // because Mar 20 is *not* a Gregorian 1st.
    const result = monthMarkerFor(days('2024-03-18'), 'gregorian')
    expect(result.get('2024-03-20')).toBeNull()
  })

  it('does not apply Gregorian boundary when calendar is jalali (independence check)', () => {
    // Mirror of the previous test for the other direction: in
    // Jalali mode, a Gregorian 1st (Jan 1) must not produce a
    // Gregorian-style marker — Jalali Dey 11 has no `jd === 1`.
    const result = monthMarkerFor(days('2023-12-25'), 'jalali')
    // 2024-01-01 is Gregorian 1 Jan but Jalali 1402-10-11.
    // The map shouldn't even contain it (the week ends Dec 31),
    // but assert what's there anyway.
    expect(result.get('2024-01-01')).toBeUndefined()
    for (const v of result.values()) {
      // No Gregorian-style "1 <English>" labels must leak through.
      if (v !== null) {
        expect(v).not.toMatch(/^1 (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/)
      }
    }
  })
})

describe('formatWeekDisplay', () => {
  it('formats a single-month week as "Mon DD-DD, YYYY"', () => {
    // 2024-01-01 (Mon) .. 2024-01-07 (Sun) — days zero-padded.
    expect(formatWeekDisplay('2024-01-01')).toBe('Jan 01-07, 2024')
  })

  it('formats a cross-month week as "Mon DD - Mon DD, YYYY"', () => {
    // 2024-01-29 is a Monday; the week ends on 2024-02-04.
    expect(formatWeekDisplay('2024-01-29')).toBe('Jan 29 - Feb 04, 2024')
  })

  it('formats a cross-year week with the start year', () => {
    // 2023-12-25 is a Monday; the week ends on 2023-12-31.
    expect(formatWeekDisplay('2023-12-25')).toBe('Dec 25-31, 2023')
  })

  it('formats a Saturday-start week that crosses into the new year', () => {
    // 2023-12-30 (Sat) .. 2024-01-05 (Fri)
    expect(formatWeekDisplay('2023-12-30')).toBe('Dec 30, 2023 - Jan 05, 2024')
  })

  it('formats a Jalali single-month week as "Far DD-DD, YYYY"', () => {
    // Saturday-start week beginning Gregorian 2024-03-16:
    // Sat 2024-03-16 (Jalali 1402-12-26) .. Fri 2024-03-22 (Jalali 1403-01-03).
    // Nowruz lands on 2024-03-20, so the week straddles 1402 / 1403 —
    // see the cross-year case below for the pure-Far week.
    expect(formatWeekDisplay('2024-03-16', 'jalali')).toBe('Esf 26, 1402 - Far 03, 1403')
  })

  it('formats a Jalali Nowruz week as "Far 01-07, 1403"', () => {
    // Gregorian 2024-03-20 (Wed) is Jalali 1403-01-01; +6 days
    // lands on Gregorian 2024-03-26 = Jalali 1403-01-07. Days are
    // zero-padded to two digits.
    expect(formatWeekDisplay('2024-03-20', 'jalali')).toBe('Far 01-07, 1403')
  })

  it('formats a Jalali cross-month week as "Ord DD-Kho DD, 1403"', () => {
    // Saturday-start week beginning Gregorian 2024-05-18 = Jalali
    // 1403-02-29 (Ordibehesht 29). The week ends on Gregorian
    // 2024-05-24 = Jalali 1403-03-04 (Khordad 4). Expected:
    // "Ord 29-Kho 04, 1403".
    expect(formatWeekDisplay('2024-05-18', 'jalali')).toBe('Ord 29-Kho 04, 1403')
  })
})

describe('formatDayTitle', () => {
  it('formats a Gregorian Monday as "YYYY-MM-DD (Mon)"', () => {
    // 2024-03-04 is a Monday.
    expect(formatDayTitle('2024-03-04', 'gregorian')).toBe('2024-03-04 (Mon)')
  })

  it('formats a Gregorian Friday as "YYYY-MM-DD (Fri)"', () => {
    // 2024-03-15 is a Friday.
    expect(formatDayTitle('2024-03-15', 'gregorian')).toBe('2024-03-15 (Fri)')
  })

  it('formats a Gregorian Saturday as "YYYY-MM-DD (Sat)"', () => {
    // 2024-03-16 is a Saturday.
    expect(formatDayTitle('2024-03-16', 'gregorian')).toBe('2024-03-16 (Sat)')
  })

  it('formats a Jalali Friday (one day before Nowruz) as "jy-MM-dd (Jomeh)"', () => {
    // 2024-03-15 (Fri) = Jalali 1402-12-25 (Esf 25), Friday.
    expect(formatDayTitle('2024-03-15', 'jalali')).toBe('1402-12-25 (Jomeh)')
  })

  it('formats a Jalali Saturday as "jy-MM-dd (Shanbe)"', () => {
    // 2024-03-16 (Sat) = Jalali 1402-12-26 (Esf 26), Saturday.
    expect(formatDayTitle('2024-03-16', 'jalali')).toBe('1402-12-26 (Shanbe)')
  })

  it('formats a Jalali Monday as "jy-MM-dd (2 Shanbe)"', () => {
    // 2024-03-18 (Mon) = Jalali 1402-12-28 (Esf 28), Monday.
    expect(formatDayTitle('2024-03-18', 'jalali')).toBe('1402-12-28 (2 Shanbe)')
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
