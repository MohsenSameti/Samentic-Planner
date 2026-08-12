import { computed, ref, watch, type Ref } from 'vue'
import {
  DEFAULT_WEEK_START,
  fromLocalISODate,
  getWeekDays,
  getWeekStart,
  toLocalISODate,
  type WeekDay,
} from '../utils/date'
import type { WeekStartDay } from '../types'

/**
 * Normalise a `WeekStartDay` value into the 0..6 range, falling back
 * to the default for anything out of range. Defence-in-depth for the
 * case where `data.json` is hand-edited into an invalid state — the
 * backend's write-path validation keeps valid data in, but a stray
 * edit shouldn't break navigation.
 */
function clampWeekStart(value: WeekStartDay): WeekStartDay {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    return DEFAULT_WEEK_START
  }
  return value
}

/**
 * Manages the currently-viewed week and exposes derived state and
 * navigation actions. Kept separate from the entity composables so the
 * navigation logic can be unit-tested without any API involvement.
 *
 * `currentWeekStart` is stored as an ISO date (`YYYY-MM-DD`) — string
 * comparison is stable and serialization-friendly, and it's the same
 * shape the rest of the codebase already uses for dates.
 *
 * `weekStart` is sourced from a `Ref<WeekStartDay>` so changes
 * (typically the user picking a new start-of-week in settings) flow
 * through automatically. When the setting changes, the composable
 * re-anchors `currentWeekStart` to today so the user doesn't see a
 * week that was valid under the old convention but is off-by-N-days
 * under the new one.
 */
export function useWeekNavigation(weekStart: Ref<WeekStartDay> = ref(DEFAULT_WEEK_START)) {
  // Snapshot the (clamped) value once at construction; the watcher
  // below re-clamps on every update.
  const safeWeekStart = computed<WeekStartDay>(() => clampWeekStart(weekStart.value))

  const currentWeekStart = ref<string>(
    toLocalISODate(getWeekStart(new Date(), safeWeekStart.value)),
  )

  /**
   * Re-anchor the displayed week to today whenever the user changes
   * the start-of-week setting. We compute the new week's start from
   * "now" rather than re-using `currentWeekStart` so the user lands
   * back in their current calendar week under the new convention.
   */
  watch(safeWeekStart, (next) => {
    currentWeekStart.value = toLocalISODate(getWeekStart(new Date(), next))
  })

  /** Seven `WeekDay` entries for the current week. Re-derives when the week
   *  or the week-start setting changes. */
  const weekDays = computed<WeekDay[]>(() =>
    getWeekDays(currentWeekStart.value, safeWeekStart.value),
  )

  /** ISO date string of the current week's first day. */
  const currentWeekStartStr = computed<string>(() => currentWeekStart.value)

  /** Moves the view forward (`dir > 0`) or backward (`dir < 0`) by `dir * 7` days. */
  function navigateWeek(dir: number): void {
    const d = fromLocalISODate(currentWeekStart.value)
    d.setDate(d.getDate() + dir * 7)
    currentWeekStart.value = toLocalISODate(d)
  }

  /** Jumps back to the week containing today. */
  function goToToday(): void {
    currentWeekStart.value = toLocalISODate(
      getWeekStart(new Date(), safeWeekStart.value),
    )
  }

  return {
    currentWeekStart,
    weekDays,
    /** Alias kept for tests/older call sites; equivalent to `currentWeekStart`. */
    weekStart: currentWeekStartStr,
    navigateWeek,
    goToToday,
  }
}
