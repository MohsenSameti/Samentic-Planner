/**
 * Tests for the `useTodayISO` composable.
 *
 * `useTodayISO` exposes a reactive local-ISO date string that ticks
 * once a minute and on `visibilitychange`, so a tab left open across
 * midnight stops showing yesterday's highlight. The test uses
 * `vi.useFakeTimers()` plus `vi.setSystemTime()` to control the clock
 * deterministically, then drives the composable directly — the same
 * shape `WeekView` uses — via `effectScope`.
 *
 * Reference: spec `docs/specs/7-improve-day-column.md` §3.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useTodayISO } from './useTodayISO'

/**
 * Mount the composable inside an `effectScope` (the same shape that
 * makes `onScopeDispose` fire on `stop()`). Captures the returned
 * refs so tests can read `todayISO.value` and call `refresh()`
 * directly. The scope is stopped in `afterEach` so the interval
 * timer and visibility listener don't bleed across tests.
 */
function mountComposable(): {
  todayISO: { value: string }
  refresh: () => void
  stop: () => void
} {
  const scope = effectScope()
  const captured = scope.run(() => useTodayISO())
  if (!captured) {
    throw new Error('useTodayISO returned no value inside effectScope')
  }
  return { ...captured, stop: () => scope.stop() }
}

describe('useTodayISO', () => {
  beforeEach(() => {
    // `vi.useFakeTimers()` patches `setInterval`/`setTimeout` so the
    // composable's 60-second tick is observable via
    // `vi.advanceTimersByTime`. happy-dom doesn't always expose the
    // global `setInterval` correctly; calling fake-timer setup
    // explicitly makes the test deterministic.
    vi.useFakeTimers()
  })

  afterEach(() => {
    // The global `setup.ts` afterEach already calls `useRealTimers`,
    // but doing it here too keeps this file hermetic if it's ever
    // run in isolation.
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns the current local ISO date on first read', () => {
    // Pin to a noon UTC date so any reasonable local timezone (UTC±12)
    // resolves to the same calendar day.
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { todayISO, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')
    } finally {
      stop()
    }
  })

  it('does not change the value when a tick fires within the same calendar day', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { todayISO, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')

      // Advance 60s with the clock held at the same day — value must
      // not change. This pins "interval ticks without spurious updates".
      vi.advanceTimersByTime(60_000)
      expect(todayISO.value).toBe('2024-01-01')
    } finally {
      stop()
    }
  })

  it('updates across midnight when the wall clock rolls over', () => {
    // Start at 23:59:30 on day 1. Advance 60s, then move the system
    // clock past midnight, then advance another 60s. The interval
    // is the only way `todayISO` should pick up the new day without
    // a visibility event.
    vi.setSystemTime(new Date('2024-01-01T23:59:30Z'))
    const { todayISO, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')

      vi.advanceTimersByTime(60_000)
      vi.setSystemTime(new Date('2024-01-02T00:00:30Z'))
      vi.advanceTimersByTime(60_000)
      expect(todayISO.value).toBe('2024-01-02')
    } finally {
      stop()
    }
  })

  it('updates on a `visibilitychange` event when the tab wakes', async () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { todayISO, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')

      // Move the clock forward without firing the interval, then
      // dispatch a visibilitychange. The composable listens for the
      // tab-wake event and re-reads.
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'))
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
      // The visibility listener triggers a ref assignment which is
      // synchronous in happy-dom, but flushing once avoids flakes
      // from any micro-task delay.
      await nextTick()
      expect(todayISO.value).toBe('2024-01-02')
    } finally {
      stop()
    }
  })

  it('does not refresh when visibilitychange fires while the tab is hidden', async () => {
    // The composable guards on `document.visibilityState === 'visible'`
    // so a hidden→hidden transition doesn't trigger a needless re-read.
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { todayISO, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()
      expect(todayISO.value).toBe('2024-01-01')
    } finally {
      stop()
    }
  })

  it('exposes a manual `refresh()` that updates without a timer or event', () => {
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { todayISO, refresh, stop } = mountComposable()
    try {
      expect(todayISO.value).toBe('2024-01-01')

      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'))
      refresh()
      expect(todayISO.value).toBe('2024-01-02')
    } finally {
      stop()
    }
  })

  it('cleans up its interval and visibility listener on scope dispose', () => {
    // Use Vitest's timer-introspection API: `vi.getTimerCount()`
    // returns the number of currently-scheduled timers. The interval
    // is the only timer this composable schedules, so its count
    // should be 0 once the scope is stopped.
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    const { stop } = mountComposable()
    expect(vi.getTimerCount()).toBe(1)

    // Spy on `document.removeEventListener` to pin the listener removal.
    // We can't easily grab a reference to the original bound function
    // from outside the composable, so the assertion is on the event
    // name + that the spy was called at least once.
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    stop()

    expect(vi.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
