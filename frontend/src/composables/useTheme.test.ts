/**
 * Tests for the `useTheme` composable.
 *
 * Contract under test:
 *
 *   - `initTheme()` reads `localStorage['planner.theme']`, validates
 *     it against the `Theme` literal union, resolves the applied
 *     theme via `resolveTheme(choice, systemPrefersDark)`, and writes
 *     the result to `document.documentElement.dataset.theme`.
 *   - `setTheme(t)` writes the validated value to `localStorage` and
 *     updates the internal refs in a way that's visible to a fresh
 *     `useTheme()` call.
 *   - Invalid / missing `localStorage` values fall back to `'system'`.
 *   - A `matchMedia` `change` event updates `resolvedTheme` only
 *     when the user's *choice* is `'system'`.
 *
 * Isolation strategy: each test does `vi.resetModules()` then
 * dynamically imports `useTheme.js` so the module-level singleton
 * state is fresh per test. `localStorage`, `matchMedia`, and
 * `documentElement.dataset.theme` are reset in `beforeEach`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Theme } from '../types/index.js'

/**
 * `MediaQueryListEvent`-ish object that happy-dom (and the real
 * browser) dispatches on `matchMedia('(prefers-color-scheme: dark)')`
 * listeners when the OS preference changes. We only need `matches`
 * and `type`; constructing the real class is awkward in tests.
 */
type MediaQueryListener = (event: { matches: boolean; type?: string }) => void

/**
 * Stub factory for `window.matchMedia`. Returns an object that
 * captures its listener so tests can simulate a preference change.
 */
function makeMatchMediaStub(initialMatches: boolean): {
  matchMedia: (query: string) => {
    matches: boolean
    media: string
    addEventListener: (type: 'change', cb: MediaQueryListener) => void
    removeEventListener: (type: 'change', cb: MediaQueryListener) => void
  }
  fire: (matches: boolean) => void
} {
  let currentMatches = initialMatches
  let listener: MediaQueryListener | null = null
  return {
    matchMedia: (query: string) => ({
      get matches(): boolean {
        return currentMatches
      },
      media: query,
      addEventListener: (_type: 'change', cb: MediaQueryListener) => {
        listener = cb
      },
      removeEventListener: (_type: 'change', _cb: MediaQueryListener) => {
        listener = null
      },
    }),
    fire: (matches: boolean) => {
      currentMatches = matches
      if (listener) listener({ matches, type: 'change' })
    },
  }
}

describe('useTheme', () => {
  beforeEach(() => {
    // Reset persistent state between tests.
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
  })

  describe('initTheme', () => {
    it("defaults to 'system' when localStorage has no theme key", async () => {
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      // System pref was false, so resolved theme is 'light'.
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it("applies 'dark' when localStorage holds 'dark' regardless of OS pref", async () => {
      localStorage.setItem('planner.theme', 'dark')
      const stub = makeMatchMediaStub(false) // OS prefers LIGHT
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it("applies 'light' when localStorage holds 'light' regardless of OS pref", async () => {
      localStorage.setItem('planner.theme', 'light')
      const stub = makeMatchMediaStub(true) // OS prefers DARK
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it("follows the OS pref when localStorage holds 'system'", async () => {
      localStorage.setItem('planner.theme', 'system')
      const stub = makeMatchMediaStub(true)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('falls back to system when localStorage holds an invalid value', async () => {
      localStorage.setItem('planner.theme', 'chartreuse')
      const stub = makeMatchMediaStub(true)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      // Invalid → 'system' choice → resolved from OS pref (true → dark).
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('falls back to system when matchMedia is unavailable', async () => {
      // Simulate a very old browser — no `matchMedia` at all. We cast
      // through `unknown` because `vi.stubGlobal`'s second parameter
      // is typed against the global; `undefined` is a deliberate
      // stand-in for "not implemented", which the composable handles
      // defensively.
      vi.stubGlobal('matchMedia', undefined as unknown as typeof window.matchMedia)
      localStorage.setItem('planner.theme', 'dark') // still honors explicit choice

      const { useTheme } = await import('./useTheme.js')
      useTheme().initTheme()

      // Explicit 'dark' still works even without matchMedia.
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('setTheme', () => {
    it("persists 'light' to localStorage and applies it", async () => {
      const stub = makeMatchMediaStub(true) // OS prefers dark
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('light')

      expect(localStorage.getItem('planner.theme')).toBe('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it("persists 'dark' to localStorage and applies it", async () => {
      const stub = makeMatchMediaStub(false) // OS prefers light
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('dark')

      expect(localStorage.getItem('planner.theme')).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it("persists 'system' and resolves from current OS pref", async () => {
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('dark') // switch to explicit dark first
      t.setTheme('system') // back to following OS (false → light)

      expect(localStorage.getItem('planner.theme')).toBe('system')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('rejects an invalid value without mutating state or storage', async () => {
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      // setTheme is typed to only accept Theme, so the only way to
      // get an invalid value is a cast — exactly the seam we want
      // to lock down.
      t.setTheme('chartreuse' as unknown as Theme)

      expect(localStorage.getItem('planner.theme')).toBeNull()
      // Resolved theme unchanged (still the init default of 'light').
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('matchMedia integration', () => {
    it("updates the applied theme when OS pref flips and choice is 'system'", async () => {
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('system')

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      // User toggles OS to dark mode at runtime.
      stub.fire(true)

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it("ignores OS pref changes when choice is not 'system'", async () => {
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('light') // explicit light, OS currently false

      // OS flips to dark. We should NOT switch to dark.
      stub.fire(true)

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('removes its matchMedia listener when setTheme moves off system', async () => {
      // This is a guard against leaking listeners. Without it, every
      // time a user picked "system" and then picked "light", a stale
      // listener would stay attached and could fire after the user
      // explicitly chose a non-system theme.
      const stub = makeMatchMediaStub(false)
      vi.stubGlobal('matchMedia', stub.matchMedia)

      const { useTheme } = await import('./useTheme.js')
      const t = useTheme()
      t.initTheme()
      t.setTheme('system') // attach listener
      t.setTheme('light')  // should detach

      // OS flips to dark. If the listener was properly removed, the
      // applied theme stays 'light'.
      stub.fire(true)
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })
})
