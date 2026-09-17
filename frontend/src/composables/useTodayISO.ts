/**
 * `useTodayISO` — reactive "today" (local ISO date) that updates at
 * least once a minute and whenever the tab wakes.
 *
 * The motivation is the spec `§3` defect: previously the week view
 * computed `isToday` from `new Date()` inside computeds that never
 * re-ran, so a tab left open across midnight kept showing yesterday's
 * highlight. Centralising the read here gives every consumer a single
 * reactive source that ticks on its own.
 *
 * Returns:
 * - `todayISO`: a `Ref<string>` containing the local `YYYY-MM-DD` of
 *   "now". Local because the planner is week-of-calendar-day based and
 *   users east or west of UTC would otherwise see a wrong day near
 *   midnight.
 * - `refresh()`: a manual re-read. Useful for tests and the future
 *   "Today button forces a refresh" path.
 */
import { onScopeDispose, ref, type Ref } from 'vue'
import { toLocalISODate } from '../utils/date'

/**
 * Tick interval: a no-op re-read costs nothing, and once a minute is
 * fast enough that midnight is never more than ~60s stale even if
 * the visibility listener misses (e.g. the OS kept the tab asleep).
 */
const TODAY_TICK_MS = 60_000

/**
 * Read the current local ISO date. Pulled out so the manual `refresh()`
 * path and the interval/visibility callbacks share one source of truth.
 */
function readTodayISO(): string {
  return toLocalISODate(new Date())
}

export interface UseTodayISOReturn {
  todayISO: Ref<string>
  refresh: () => void
}

export function useTodayISO(): UseTodayISOReturn {
  const todayISO = ref<string>(readTodayISO())

  const refresh = (): void => {
    todayISO.value = readTodayISO()
  }

  // Use `window.setInterval` rather than the bare global so SSR/test
  // environments that don't define `window` fail fast. Vitest's
  // `useFakeTimers` patches the global, so the test still observes ticks.
  const id = window.setInterval(refresh, TODAY_TICK_MS)

  /**
   * Bind the listener once and store the reference so removal uses
   * the *same* function object the browser stores internally. Passing
   * an inline arrow at removal time would be a silent no-op.
   */
  function onVisibility(): void {
    if (document.visibilityState === 'visible') {
      refresh()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)

  /**
   * `onScopeDispose` runs in both `setup()` and `effectScope` contexts,
   * and (most importantly) on `app.unmount()`, so the existing
   * `App.vue` unmount path is enough to clean up without each consumer
   * needing its own `onUnmounted`.
   */
  onScopeDispose(() => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { todayISO, refresh }
}
