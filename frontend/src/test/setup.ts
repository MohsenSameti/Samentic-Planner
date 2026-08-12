/**
 * Vitest setup — runs before every test file.
 *
 * We don't use Pinia, so the typical `setActivePinia(createPinia())`
 * wiring from the plan doesn't apply. Instead, the two things we need
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
 */
import { afterEach, beforeEach, vi } from 'vitest'
import { apiError, isLoading } from '../api'

beforeEach(() => {
  apiError.value = null
  isLoading.value = false
})

afterEach(() => {
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
