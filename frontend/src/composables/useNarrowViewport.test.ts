/**
 * Tests for the `useNarrowViewport` composable.
 *
 * `useNarrowViewport` exposes a reactive `isNarrow` ref that tracks the
 * `(max-width: Npx)` media query (default 480px), so components can
 * swap layout details — e.g. the Jalali picker's compact weekday
 * labels — when the viewport is phone-sized. The `matchMedia` stub
 * follows the `useTheme` test pattern.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useNarrowViewport } from './useNarrowViewport'

/** Listener signature for the `change` event on a `MediaQueryList`. */
type MediaQueryListener = (event: { matches: boolean; type?: string }) => void

/**
 * Stub factory for `window.matchMedia`. `fire(matches)` updates the
 * captured `matches` value and dispatches the stored `change`
 * listener, simulating a viewport crossing the breakpoint.
 */
function makeMatchMediaStub(initialMatches: boolean): {
  matchMedia: (query: string) => {
    matches: boolean
    media: string
    addEventListener: (type: 'change', cb: MediaQueryListener) => void
    removeEventListener: (type: 'change', cb: MediaQueryListener) => void
  }
  fire: (matches: boolean) => void
  /** The query string the composable asked for, for assertions. */
  lastQuery: () => string
} {
  let currentMatches = initialMatches
  let listener: MediaQueryListener | null = null
  let query = ''
  return {
    matchMedia: (q: string) => {
      query = q
      return {
        get matches(): boolean {
          return currentMatches
        },
        media: q,
        addEventListener: (_type: 'change', cb: MediaQueryListener) => {
          listener = cb
        },
        removeEventListener: (_type: 'change', _cb: MediaQueryListener) => {
          listener = null
        },
      }
    },
    fire: (matches: boolean) => {
      currentMatches = matches
      if (listener) listener({ matches, type: 'change' })
    },
    lastQuery: () => query,
  }
}

/**
 * Mount the composable inside an `effectScope` (the same shape that
 * makes `onScopeDispose` fire on `stop()`), capturing the returned
 * refs. The scope stops in `afterEach` so no listener leaks between
 * tests.
 */
function mountComposable(maxWidth = 480): {
  isNarrow: { value: boolean }
  stop: () => void
} {
  const scope = effectScope()
  const captured = scope.run(() => useNarrowViewport(maxWidth))
  if (!captured) {
    throw new Error('useNarrowViewport returned no value inside effectScope')
  }
  return { ...captured, stop: () => scope.stop() }
}

describe('useNarrowViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is wide initially when the media query does not match', () => {
    const stub = makeMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { isNarrow, stop } = mountComposable()
    try {
      expect(isNarrow.value).toBe(false)
      expect(stub.lastQuery()).toBe('(max-width: 480px)')
    } finally {
      stop()
    }
  })

  it('is narrow initially when the media query matches', () => {
    const stub = makeMatchMediaStub(true)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { isNarrow, stop } = mountComposable()
    try {
      expect(isNarrow.value).toBe(true)
    } finally {
      stop()
    }
  })

  it('swaps isNarrow on a viewport resize crossing the breakpoint', () => {
    const stub = makeMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { isNarrow, stop } = mountComposable()
    try {
      expect(isNarrow.value).toBe(false)
      stub.fire(true)
      expect(isNarrow.value).toBe(true)
      stub.fire(false)
      expect(isNarrow.value).toBe(false)
    } finally {
      stop()
    }
  })

  it('removes the change listener when the scope is disposed', () => {
    const stub = makeMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { isNarrow, stop } = mountComposable()
    stop()
    // A fired event after disposal must not touch the ref.
    stub.fire(true)
    expect(isNarrow.value).toBe(false)
  })

  it('defaults to wide when matchMedia is unavailable', () => {
    // No stub: happy-dom's window may or may not expose matchMedia,
    // so force the "unavailable" path.
    vi.stubGlobal('matchMedia', undefined)

    const { isNarrow, stop } = mountComposable()
    try {
      expect(isNarrow.value).toBe(false)
    } finally {
      stop()
    }
  })

  it('honours a custom max width in the query string', () => {
    const stub = makeMatchMediaStub(false)
    vi.stubGlobal('matchMedia', stub.matchMedia)

    const { isNarrow, stop } = mountComposable(320)
    try {
      expect(stub.lastQuery()).toBe('(max-width: 320px)')
      expect(isNarrow.value).toBe(false)
      stub.fire(true)
      expect(isNarrow.value).toBe(true)
    } finally {
      stop()
    }
  })
})
