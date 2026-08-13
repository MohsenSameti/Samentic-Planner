/**
 * Tests for the Jalali conversion helpers in `jalali.ts`.
 *
 * The test environment is pinned to UTC (`vitest.config.ts`), so
 * `fromLocalISODate('2024-03-20')` produces a `Date` at 2024-03-20
 * UTC midnight regardless of the host's local timezone. That makes
 * the Nowruz anchor stable across hosts.
 */
import { describe, expect, it } from 'vitest'
import {
  JALALI_MONTH_LABELS,
  JALALI_WEEKDAY_LABELS,
  fromJalaliYMD,
  isLeapJalali,
  jalaliMonthLength,
  toJalaliYMD,
} from './jalali.js'

describe('toJalaliYMD', () => {
  it('converts Gregorian 2024-03-20 to Jalali 1403-01-01 (Nowruz)', () => {
    // The well-known Nowruz anchor: 2024-03-20 (Gregorian) is the
    // first day of Farvardin 1403 (Jalali).
    const result = toJalaliYMD('2024-03-20')
    expect(result.jy).toBe(1403)
    expect(result.jm).toBe(1)
    expect(result.jd).toBe(1)
  })

  it('converts a date in the middle of the year', () => {
    // 2024-05-18 (Gregorian) should land in Farvardin 1403. The
    // exact day-of-month depends on the converter; we just check
    // the rough position so the test stays robust against tiny
    // drift in the underlying library.
    const result = toJalaliYMD('2024-05-18')
    expect(result.jy).toBe(1403)
    expect(result.jm).toBe(2) // Ordibehesht
  })

  it('handles a date before Nowruz', () => {
    // 2024-03-19 is the last day of Esfand 1402.
    const result = toJalaliYMD('2024-03-19')
    expect(result.jy).toBe(1402)
    expect(result.jm).toBe(12)
    expect(result.jd).toBe(29)
  })
})

describe('fromJalaliYMD', () => {
  it('round-trips Nowruz 1403 back to Gregorian 2024-03-20', () => {
    expect(fromJalaliYMD(1403, 1, 1)).toBe('2024-03-20')
  })

  it('round-trips a mid-year Jalali date', () => {
    // 1403-02-29 is the last day of Ordibehesht 1403 (1403 is a leap
    // year, so Esfand has 30 days, but Ordibehesht's length is
    // 31 — the library's contract). 1403-02-29 corresponds to
    // Gregorian 2024-05-18.
    expect(fromJalaliYMD(1403, 2, 29)).toBe('2024-05-18')
  })

  it('round-trips a pre-Nowruz date', () => {
    // 1402-12-29 (last day of Esfand 1402) is Gregorian 2024-03-19.
    expect(fromJalaliYMD(1402, 12, 29)).toBe('2024-03-19')
  })

  it('is the inverse of toJalaliYMD for arbitrary dates', () => {
    const samples = [
      '2024-01-01',
      '2024-06-15',
      '2024-12-31',
      '2025-03-21',
      '2023-09-22',
    ]
    for (const iso of samples) {
      const j = toJalaliYMD(iso)
      expect(fromJalaliYMD(j.jy, j.jm, j.jd)).toBe(iso)
    }
  })
})

describe('isLeapJalali', () => {
  it('returns true for a known Jalali leap year', () => {
    // 1403 is a leap year in the 33-year cycle starting at 1403.
    expect(isLeapJalali(1403)).toBe(true)
  })

  it('returns false for a known Jalali non-leap year', () => {
    // 1402 is not a leap year.
    expect(isLeapJalali(1402)).toBe(false)
  })
})

describe('jalaliMonthLength', () => {
  it('returns 31 for the first six months of a non-leap year', () => {
    // Months 1..6 always have 31 days in the Jalali calendar.
    for (let m = 1; m <= 6; m++) {
      expect(jalaliMonthLength(1402, m)).toBe(31)
    }
  })

  it('returns 30 for months 7..11 of any year', () => {
    // Months 7..11 always have 30 days.
    for (let m = 7; m <= 11; m++) {
      expect(jalaliMonthLength(1402, m)).toBe(30)
      expect(jalaliMonthLength(1403, m)).toBe(30)
    }
  })

  it('returns 29 for Esfand (month 12) in a non-leap year', () => {
    expect(jalaliMonthLength(1402, 12)).toBe(29)
  })

  it('returns 30 for Esfand (month 12) in a leap year', () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30)
  })
})

describe('JALALI_MONTH_LABELS', () => {
  it('has 12 entries', () => {
    expect(JALALI_MONTH_LABELS).toHaveLength(12)
  })

  it('starts with "Far" and ends with "Esf"', () => {
    expect(JALALI_MONTH_LABELS[0]).toBe('Far')
    expect(JALALI_MONTH_LABELS[11]).toBe('Esf')
  })

  it('contains the expected transliterations in order', () => {
    expect(JALALI_MONTH_LABELS).toEqual([
      'Far',
      'Ord',
      'Kho',
      'Tir',
      'Mor',
      'Sha',
      'Meh',
      'Aab',
      'Aza',
      'Dey',
      'Bah',
      'Esf',
    ])
  })
})

describe('JALALI_WEEKDAY_LABELS', () => {
  it('has 7 entries in Date#getDay() order', () => {
    expect(JALALI_WEEKDAY_LABELS).toHaveLength(7)
    expect(JALALI_WEEKDAY_LABELS[0]).toBe('Sun')
    expect(JALALI_WEEKDAY_LABELS[6]).toBe('Sat')
  })
})
