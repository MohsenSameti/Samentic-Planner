/**
 * Vitest setup — runs before every test file.
 *
 * We don't use Pinia, so the typical `setActivePinia(createPinia())`
 * wiring from the plan doesn't apply. Instead, the things we need
 * globally are:
 *
 *  1. Reset the shared `apiError` / `isLoading` refs exported by
 *     `api.ts` between tests, so one test's network failure doesn't
 *     leak into the next. Each test that needs to control them should
 *     still mutate them directly; this just makes sure they start
 *     clean.
 *
 *  2. Stub `console.error` / `console.warn` for tests that exercise
 *     known-error paths, so test output isn't polluted. Tests that
 *     actually need to assert on a log call can spy explicitly.
 *
 *  3. Provide a synchronous in-memory `localStorage` shim.
 *     Node.js does not expose `localStorage` as a global; happy-dom
 *     exposes it inside the test *environment* but the bare name is
 *     undefined when module-level code (e.g. `beforeEach` hooks that
 *     run before the first `it`) references it. The shim is installed
 *     once per process and cleared between files so tests that call
 *     `localStorage.clear()` / `.setItem()` / `.getItem()` work
 *     without any per-test boilerplate.
 */
import { afterEach, beforeEach, vi } from 'vitest'
import { apiError, isLoading } from '../api'

/* ------------------------------------------------------------------ */
/* localStorage shim                                                    */
/* ------------------------------------------------------------------ */

/**
 * Minimal synchronous key-value store that mirrors the `Storage`
 * interface used by the app. Installed as `globalThis.localStorage`
 * so both bare `localStorage` references and `window.localStorage`
 * resolve to the same object in happy-dom tests.
 */
function makeLocalStorageShim(): Storage {
  let store: Record<string, string> = {}
  return {
    get length(): number {
      return Object.keys(store).length
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null
    },
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? (store[key] ?? null)
        : null
    },
    setItem(key: string, value: string): void {
      store[key] = String(value)
    },
    removeItem(key: string): void {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store[key]
    },
    clear(): void {
      store = {}
    },
  }
}

if (typeof localStorage === 'undefined') {
  const shim = makeLocalStorageShim()
  // Install on both `globalThis` (bare `localStorage`) and `window`
  // (happy-dom's `window.localStorage`) so all access paths work.
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    writable: true,
    configurable: true,
  })
}

/* ------------------------------------------------------------------ */
/* Per-test lifecycle                                                   */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  apiError.value = null
  isLoading.value = false
  // Start each test with a clean store so localStorage-dependent tests
  // are fully isolated without needing their own `localStorage.clear()`
  // calls (though keeping them doesn't hurt).
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  // Clear all mocks/spies so a per-test `vi.spyOn` doesn't bleed into
  // the next file.
  vi.restoreAllMocks()
  // `vi.stubGlobal` is not reset by `restoreAllMocks` — it needs its
  // own cleanup so a stubbed `fetch` from one test doesn't leak into
  // the next.
  vi.unstubAllGlobals()
  // `useFakeTimers` is restored explicitly in tests that enable it,
  // but as a safety net:
  vi.useRealTimers()
})
