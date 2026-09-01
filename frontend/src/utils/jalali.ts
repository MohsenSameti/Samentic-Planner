import {
  toJalaali,
  toGregorian,
  isLeapJalaaliYear as jalaaliIsLeap,
  jalaaliMonthLength as jalaaliMonthLen,
} from 'jalaali-js'
import { fromLocalISODate, toLocalISODate } from './date'

/**
 * Jalali (Persian) calendar helpers.
 *
 * Keeps the conversion math in one place so the rest of the app
 * never has to import `jalaali-js` directly. The public surface
 * matches the existing `date.ts` style: pure functions, no Vue
 * reactivity, no I/O.
 *
 * All conversions go through **local-midnight** `Date` objects so
 * the planner stays timezone-stable regardless of where the user
 * runs it. The frontend test environment pins `TZ=UTC`, so tests
 * written against `2024-03-20` (Nowruz 1403) are stable across hosts.
 */

/** Parsed Jalali date components, matching `jalaali.toJalaali`'s output. */
export interface JalaliYMD {
  jy: number
  jm: number
  jd: number
}

/**
 * Convert a Gregorian ISO date (`YYYY-MM-DD`) to Jalali components.
 *
 * Parses the input as local midnight so the result is the same
 * calendar day the user sees in the UI — matching
 * `fromLocalISODate`'s contract.
 */
export function toJalaliYMD(gregIso: string): JalaliYMD {
  const d = fromLocalISODate(gregIso)
  const result = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return { jy: result.jy, jm: result.jm, jd: result.jd }
}

/**
 * Inverse of `toJalaliYMD`: convert Jalali components back to a
 * Gregorian ISO date string. Used by the Jalali date picker (the
 * only module in the app that produces Jalali Y/M/D triples for
 * output).
 */
export function fromJalaliYMD(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd)
  // `toGregorian` returns `{ gy, gm, gd }`. The component values are
  // already in local-calendar shape, so feed them straight into
  // `toLocalISODate` via a local-midnight `Date`.
  const d = new Date(g.gy, g.gm - 1, g.gd)
  return toLocalISODate(d)
}

/**
 * Short Persian-style month labels, indexed by `jm - 1`.
 *
 * Kept in English transliteration (matching the rest of the UI's
 * English-only contract) so a future i18n layer can swap to
 * localized labels without touching the picker internals.
 */
export const JALALI_MONTH_LABELS: readonly string[] = [
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
] as const

/**
 * Weekday labels for the Jalali calendar. The Jalali week has the
 * same 7 days as the Gregorian one, so the labels are identical —
 * included here for symmetry so callers don't need to branch on
 * calendar.
 */
export const JALALI_WEEKDAY_LABELS: readonly string[] = [
  '1 Shan', // Sun (getDay 0)
  '2 Shan', // Mon (1)
  '3 Shan', // Tue (2)
  '4 Shan', // Wed (3)
  '5 Shan', // Thu (4)
  'Jomeh', // Fri (5)
  'Shan',  // Sat (6)
] as const

export const JALALI_WEEKDAY_LABELS_LONG: readonly string[] = [
  '1 Shanbe',
  '2 Shanbe',
  '3 Shanbe',
  '4 Shanbe',
  '5 Shanbe',
  'Jomeh',
  'Shanbe',
] as const

/**
 * Re-export of `jalaali.isLeapJalaaliYear` with a tighter type
 * (the upstream signature accepts `number` and returns
 * `boolean` — we keep that exact contract).
 */
export function isLeapJalali(jy: number): boolean {
  return jalaaliIsLeap(jy)
}

/**
 * Length of the given Jalali month, in days (1..31). Re-export of
 * `jalaali.jalaaliMonthLength` with a tighter return type so the
 * picker can use the value safely in arithmetic.
 */
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLen(jy, jm)
}
