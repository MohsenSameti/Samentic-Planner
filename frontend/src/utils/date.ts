import type { Calendar, WeekStartDay } from '../types'
import {
  JALALI_MONTH_LABELS,
  toJalaliYMD,
} from './jalali'

/**
 * Date helpers used by the week-view navigation and headers.
 *
 * Kept pure (no Vue reactivity) so they can be reused inside composables,
 * computeds, and tests without dragging the reactivity system along.
 */

/**
 * Format a `Date` as an ISO calendar date (`YYYY-MM-DD`) using its
 * **local** day/month/year — not UTC. Necessary because
 * `Date#toISOString()` is timezone-relative and would shift the date
 * by ±1 day for users east or west of UTC, breaking the "this string
 * is the calendar date the user picked" invariant.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parse an ISO calendar date (`YYYY-MM-DD`) as **local** midnight. The
 * default `new Date('2024-01-01')` parses as UTC midnight per the ES
 * spec, which would also shift by ±1 day outside UTC. We want the
 * parsed `Date` to represent the same calendar day in the user's
 * timezone.
 */
export function fromLocalISODate(iso: string): Date {
  const parts = iso.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  return new Date(y, m - 1, d)
}

/** A single day cell in the week grid. */
export interface WeekDay {
  /** ISO date string (`YYYY-MM-DD`) — stable for keys and API calls. */
  date: string
  /** Short weekday label, e.g. "Mon". */
  name: string
  /** Day-of-month number, e.g. `7`. */
  dayNum: number
  /** True when this calendar day is today (local timezone). */
  isToday: boolean
  /**
   * Jalali day-of-month. Only populated when the user has selected
   * the Jalali calendar; otherwise `undefined`.
   */
  dayNumJalali?: number
  /**
   * Jalali month label (e.g. "Far"). Only populated when the user
   * has selected the Jalali calendar; otherwise `undefined`.
   */
  monthLabelJalali?: string
}

/** Default week start — Saturday — when the persisted setting is
 *  missing or invalid. Matches the backend's default. */
export const DEFAULT_WEEK_START: WeekStartDay = 6

/**
 * Returns the first day of the week containing `date`, at local
 * midnight. `weekStart` picks which day is the start: `0` = Sunday,
 * `1` = Monday, ..., `6` = Saturday. The math `(day - weekStart + 7)
 * % 7` works for every value, so callers can pick any week convention
 * (Mon-start, Sun-start, Sat-start) without branching.
 */
export function getWeekStart(date: Date, weekStart: WeekStartDay = DEFAULT_WEEK_START): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Produces seven `WeekDay` entries starting from the week containing
 * `weekStartStr`. `weekStartStr` is an ISO date (`YYYY-MM-DD`); it is
 * parsed in the local timezone, not UTC, because the planner is
 * week-of-the-calendar-day based. The first entry is always
 * `weekStart` (e.g. Saturday when `weekStart === 6`).
 *
 * When `calendar === 'jalali'`, each entry is enriched with
 * `dayNumJalali` and `monthLabelJalali`. The `date` field stays
 * Gregorian ISO (the canonical key for storage, navigation, and
 * grouping).
 */
export function getWeekDays(
  weekStartStr: string,
  weekStart: WeekStartDay = DEFAULT_WEEK_START,
  calendar: Calendar = 'gregorian',
): WeekDay[] {
  const days: WeekDay[] = []
  const start = fromLocalISODate(weekStartStr)
  // Defensive: if the stored value happens to be off-week due to a
  // setting change that happened while a different week was visible,
  // snap back to the actual week-start for the current setting.
  const normalized = getWeekStart(start, weekStart)
  const today = new Date().toDateString()
  for (let i = 0; i < 7; i++) {
    const d = new Date(normalized)
    d.setDate(d.getDate() + i)
    const gregIso = toLocalISODate(d)
    const entry: WeekDay = {
      date: gregIso,
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === today,
    }
    if (calendar === 'jalali') {
      const j = toJalaliYMD(gregIso)
      entry.dayNumJalali = j.jd
      // `JALALI_MONTH_LABELS` is indexed by `jm - 1`; default to an
      // empty string for an out-of-range month (should never happen
      // for valid dates, but the type system requires a fallback).
      const labelIdx = j.jm - 1
      entry.monthLabelJalali = JALALI_MONTH_LABELS[labelIdx] ?? ''
    }
    days.push(entry)
  }
  return days
}

/**
 * Human-readable header for the week navigation, e.g. `Mar 4 - 10, 2024`.
 * Crosses months without doubling the year string; cross-year weeks
 * show the year on both ends so the date range is unambiguous.
 *
 * The function takes the ISO date of the first day of the displayed
 * week (`weekStartStr`); the end is always +6 days regardless of which
 * day the week starts on, so the signature doesn't need a
 * `weekStart` parameter.
 *
 * When `calendar === 'jalali'`, the format uses Jalali month labels
 * and day-of-month numbers but keeps the same cross-month / cross-year
 * logic. The `gregIso` parameter is still the Gregorian ISO of the
 * week start — the glyphs are just translated for display.
 */
export function formatWeekDisplay(
  weekStartStr: string,
  calendar: Calendar = 'gregorian',
): string {
  const start = fromLocalISODate(weekStartStr)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  if (calendar === 'jalali') {
    const jStart = toJalaliYMD(weekStartStr)
    const endIso = toLocalISODate(end)
    const jEnd = toJalaliYMD(endIso)
    const startLabel = JALALI_MONTH_LABELS[jStart.jm - 1] ?? ''
    const endLabel = JALALI_MONTH_LABELS[jEnd.jm - 1] ?? ''
    const startYear = jStart.jy
    const endYear = jEnd.jy

    // Same month: collapse into "Mon D - D, YYYY".
    if (jStart.jm === jEnd.jm && startYear === endYear) {
      return `${startLabel} ${jStart.jd} - ${jEnd.jd}, ${startYear}`
    }
    // Same year, different months: "Mon D - Mon D, YYYY".
    if (startYear === endYear) {
      return `${startLabel} ${jStart.jd} - ${endLabel} ${jEnd.jd}, ${startYear}`
    }
    // Cross-year: include the year on both ends so the range is unambiguous.
    return `${startLabel} ${jStart.jd}, ${startYear} - ${endLabel} ${jEnd.jd}, ${endYear}`
  }

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  // Same month: collapse into "Mon D - D, YYYY".
  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${startYear}`
  }
  // Same year, different months: "Mon D - Mon D, YYYY".
  if (startYear === endYear) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${startYear}`
  }
  // Cross-year: include the year on both ends so the range is unambiguous.
  return `${startMonth} ${start.getDate()}, ${startYear} - ${endMonth} ${end.getDate()}, ${endYear}`
}

/**
 * Stable, user-visible labels for the seven possible week-start days.
 * Indexed by `WeekStartDay` so callers can do
 * `WEEKDAY_LABELS[weekStart]`.
 */
export const WEEKDAY_LABELS: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
