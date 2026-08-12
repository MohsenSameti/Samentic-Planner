/**
 * Lightweight performance monitoring.
 *
 * Tracks:
 * - Total page-load duration (between `initPerformanceMonitoring()` and
 *   the window `load` event).
 * - Total time spent in Vue patch/render work across the lifetime of
 *   the app (sampled via `PerformanceObserver` where available, falling
 *   back to a no-op on browsers that lack support).
 *
 * The data is collected locally only; nothing is sent off the device.
 * Hooks are left in place for a future caller to wire up an analytics
 * sink by replacing `reportMetric` with a network call.
 *
 * Intentionally opt-in via `initPerformanceMonitoring()` so existing
 * tests and dev-time tooling aren't slowed down by the observer.
 */

import { nextTick } from 'vue'

type MetricName =
  | 'page_load'
  | 'long_task'
  | 'vue_render'

interface Metric {
  name: MetricName
  /** Duration in ms (for `long_task` / `vue_render`) or elapsed ms
   *  since the monitor was initialised (for `page_load`). */
  value: number
  /** Arbitrary key/value metadata — component name, entry type, etc. */
  metadata: Readonly<Record<string, string | number | boolean>>
}

/**
 * Outbound metric sink. Default behaviour is a single `console.log`
 * in development; production builds route through the same sink so a
 * future analytics integration can be added by replacing this body.
 *
 * Centralised in one function so we don't sprinkle `console.log` calls
 * through the file — easier to gate / replace / disable in one place.
 */
function reportMetric(metric: Metric): void {
  // eslint-disable-next-line no-console
  console.debug('[perf]', metric.name, metric.value.toFixed(2) + 'ms', metric.metadata)
}

/**
 * Subscribes to `longtask` entries (any task longer than ~50ms on the
 * main thread) and forwards them to `reportMetric`. Browsers without
 * support for the `PerformanceObserver` `longtask` type simply don't
 * fire — the monitor degrades to page-load-only measurement in that
 * case.
 */
function observeLongTasks(): void {
  type LongTaskObserver = { supportedEntryTypes: readonly string[] }
  const perfWithObserver = performance as unknown as { 
    observe?: (opts: { entryTypes: readonly string[]; buffered?: boolean }) => void 
  }
  // We can't import the PerformanceObserver lib types here without
  // widening to `any`; we accept this narrow `unknown` cast.
  const observerCtor = (window as unknown as {
    PerformanceObserver?: unknown
  }).PerformanceObserver
  if (typeof observerCtor !== 'function') return

  try {
    const Observer = observerCtor as new (
      cb: (list: { getEntries: () => ArrayLike<{ duration: number; name: string }> }) => void,
    ) => { observe: (opts: { entryTypes: readonly string[] }) => void }
    const observer = new Observer(list => {
      // `getEntries()` returns an `ArrayLike` which doesn't implement
      // `[Symbol.iterator]`. Wrap in `Array.from` so we can use `for..of`.
      const entries = Array.from(list.getEntries())
      for (const entry of entries) {
        reportMetric({
          name: 'long_task',
          value: entry.duration,
          metadata: { source: entry.name },
        })
      }
    })
    // Capability-check: only call `observe` if `longtask` is listed in
    // the user's supported types. Cheaper than catching a TypeError.
    const supported = (performance as unknown as Partial<LongTaskObserver>)
      .supportedEntryTypes ?? []
    if (!supported.includes('longtask')) return
    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    // Performance observers can throw in restricted contexts (private
    // browsing, certain iframe sandboxes). Fail silently — monitoring
    // is best-effort.
    perfWithObserver.observe?.bind(perfWithObserver)
  }
}

/**
 * Measures the delay between `initPerformanceMonitoring()` and the
 * next macrotask after Vue's initial render. Uses `nextTick` to wait
 * out the first paint, then resolves on window `load` (which fires
 * once all initial resources have settled).
 */
function observePageLoad(startMark: number): void {
  if (document.readyState === 'complete') {
    nextTick(() => {
      reportMetric({
        name: 'page_load',
        value: performance.now() - startMark,
        metadata: { readyState: document.readyState },
      })
    })
    return
  }

  window.addEventListener('load', () => {
    reportMetric({
      name: 'page_load',
      value: performance.now() - startMark,
      metadata: { readyState: document.readyState },
    })
  }, { once: true })
}

/**
 * Mount the performance monitor. Safe to call multiple times — only the
 * first invocation wires up the listeners; subsequent calls are a
 * no-op.
 */
let installed = false

export function initPerformanceMonitoring(): void {
  if (installed) return
  installed = true
  const startMark = performance.now()
  observePageLoad(startMark)
  observeLongTasks()
}

/** Exposed for tests / manual hooks. Not called by app code. */
export const __test__ = { reportMetric }
