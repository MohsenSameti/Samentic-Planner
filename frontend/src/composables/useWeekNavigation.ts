import { ref, computed } from 'vue'
import { getWeekStart, getWeekDays, type WeekDay } from '../utils/date'

/**
 * Manages the currently-viewed week and exposes derived state and
 * navigation actions. Kept separate from the entity composables so the
 * navigation logic can be unit-tested without any API involvement.
 *
 * `currentWeekStart` is stored as an ISO date (`YYYY-MM-DD`) — string
 * comparison is stable and serialization-friendly, and it's the same
 * shape the rest of the codebase already uses for dates.
 */
export function useWeekNavigation() {
  const currentWeekStart = ref<string>(
    getWeekStart(new Date()).toISOString().split('T')[0],
  )

  /** Seven `WeekDay` entries for the current week. Re-derives when the week changes. */
  const weekDays = computed<WeekDay[]>(() => getWeekDays(currentWeekStart.value))

  /** ISO date string of the current week's Monday. */
  const weekStart = computed<string>(() => currentWeekStart.value)

  /** Moves the view forward (`dir > 0`) or backward (`dir < 0`) by `dir * 7` days. */
  function navigateWeek(dir: number): void {
    const d = new Date(currentWeekStart.value)
    d.setDate(d.getDate() + dir * 7)
    currentWeekStart.value = d.toISOString().split('T')[0]
  }

  /** Jumps back to the week containing today. */
  function goToToday(): void {
    currentWeekStart.value = getWeekStart(new Date()).toISOString().split('T')[0]
  }

  return {
    currentWeekStart,
    weekDays,
    weekStart,
    navigateWeek,
    goToToday,
  }
}
