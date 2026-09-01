/**
 * `useTheme` — owns the theme setting end-to-end.
 *
 * Three pieces of state, all module-level so every consumer (the
 * `SettingsSection` UI, the boot path in `main.ts`, anything else
 * that needs the applied theme) shares the same singleton, the same
 * way `useAuth` does:
 *
 *   1. `theme`     — the user's *choice* (`'light' | 'dark' | 'system'`).
 *                    What gets persisted to `localStorage` and shown
 *                    in the settings select.
 *   2. `resolvedTheme` — the theme actually applied to the document
 *                    (`'light' | 'dark'`). A function of `theme` and
 *                    the current `prefers-color-scheme` value.
 *   3. `mediaQuery` — the `MediaQueryList` we subscribed to (only
 *                    while `theme === 'system'`).
 *
 * The lifecycle is small:
 *
 *   - `initTheme()` runs once at boot, *before* Vue mounts, so the
 *     `data-theme` attribute is on `<html>` before the first paint
 *     and there's no flash of the wrong theme.
 *   - `setTheme(t)` is the only mutator called from the UI. It
 *     validates, persists, recomputes the resolved theme, and
 *     re-applies.
 *   - When the OS preference changes, the `matchMedia` listener
 *     recomputes the resolved theme and re-applies — but only while
 *     the user is in `'system'` mode. Explicit `'light'` / `'dark'`
 *     are sticky and ignore the OS.
 */
import { onScopeDispose, ref, type Ref } from 'vue'
import { resolveTheme } from '../utils/theme'
import type { ResolvedTheme, Theme } from '../types'

/**
 * `localStorage` key for the theme choice. Versioned via the
 * `planner.` prefix so a future schema change (e.g. moving to a
 * per-user server setting) can do a clean break without colliding
 * with old values.
 */
const THEME_STORAGE_KEY = 'planner.theme'

/* ------------------------------------------------------------------ */
/* Module-level singleton state                                         */
/* ------------------------------------------------------------------ */

const theme: Ref<Theme> = ref<Theme>('system')
const resolvedTheme: Ref<ResolvedTheme> = ref<ResolvedTheme>('light')
let mediaQuery: MediaQueryList | null = null
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null

/* ------------------------------------------------------------------ */
/* Storage I/O                                                          */
/* ------------------------------------------------------------------ */

/**
 * Read the user's choice from `localStorage`, validated against the
 * `Theme` literal union. Any malformed value (missing, wrong type,
 * unknown string) collapses to `'system'` — the safe default.
 */
function loadStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw
    }
  } catch {
    // `localStorage` can throw in privacy modes / sandboxed iframes.
    // Falling through to the default is the right thing.
  }
  return 'system'
}

/**
 * Persist a validated choice. Returns `true` on success, `false` if
 * the write was rejected (e.g. quota exceeded). The caller is
 * expected to have already validated the input.
 */
function persistTheme(value: Theme): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
    return true
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* OS preference                                                        */
/* ------------------------------------------------------------------ */

/**
 * Wrap `matchMedia` so the composable still works in environments
 * without it (very old browsers, certain test sandboxes). Always
 * returns a `boolean` — `false` is the documented fallback.
 */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/* ------------------------------------------------------------------ */
/* Media-query subscription                                             */
/* ------------------------------------------------------------------ */

/**
 * Subscribe to `prefers-color-scheme` changes so an OS-level toggle
 * (e.g. macOS "Automatic" at sunset) updates the applied theme live.
 * No-op if the API is unavailable.
 */
function attachMediaListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }
  if (mediaQuery) return // already attached

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaListener = (): void => {
    if (theme.value !== 'system') return
    const next = resolveTheme(theme.value, mediaQuery?.matches ?? false)
    if (next !== resolvedTheme.value) {
      resolvedTheme.value = next
      applyTheme()
    }
  }
  mediaQuery.addEventListener('change', mediaListener)
}

/**
 * Tear down the OS-pref subscription. Safe to call when nothing is
 * attached.
 */
function detachMediaListener(): void {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener)
  }
  mediaQuery = null
  mediaListener = null
}

/* ------------------------------------------------------------------ */
/* Apply                                                                */
/* ------------------------------------------------------------------ */

/**
 * Write the resolved theme to `document.documentElement.dataset.theme`
 * so the CSS in `style.css` (`:root[data-theme="dark"]`) can react.
 * Called by `initTheme`, `setTheme`, and the media listener.
 */
function applyTheme(): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', resolvedTheme.value)
}

/* ------------------------------------------------------------------ */
/* Public surface                                                       */
/* ------------------------------------------------------------------ */

/**
 * Read the stored choice, recompute the resolved theme, and apply
 * it. Must be safe to call *before* `createApp().mount(...)` — it
 * touches no Vue lifecycle hooks, only `localStorage`, `matchMedia`,
 * and `document.documentElement`. Idempotent: calling it twice with
 * the same persisted state is a no-op.
 */
function initTheme(): void {
  // Detach any existing listener first — e.g. when initTheme is called
  // more than once in tests, we don't want a second `change` handler
  // stacking on top of the first.
  detachMediaListener()

  theme.value = loadStoredTheme()
  resolvedTheme.value = resolveTheme(theme.value, systemPrefersDark())
  applyTheme()

  if (theme.value === 'system') {
    attachMediaListener()
  }
}

/**
 * Apply a new theme choice. Validates against the literal union
 * before doing anything — invalid input is silently dropped, so a
 * stale `<select>` value (e.g. from a hand-edited DOM) can't poison
 * the persisted state. Returns `true` if the choice was applied,
 * `false` if it was rejected.
 */
function setTheme(next: Theme): boolean {
  if (next !== 'light' && next !== 'dark' && next !== 'system') {
    return false
  }
  theme.value = next
  resolvedTheme.value = resolveTheme(next, systemPrefersDark())
  applyTheme()
  // Move the media listener to match the new mode — only attach in
  // 'system', detach otherwise. Done *after* applying so the
  // detach-then-attach order is well-defined.
  if (next === 'system') {
    attachMediaListener()
  } else {
    detachMediaListener()
  }
  persistTheme(next)
  return true
}

/**
 * Factory returning the public composable surface. The internal
 * state is module-level so the same `useTheme()` call from `App.vue`
 * and `main.ts` returns refs pointing at the same data. Following
 * the same singleton pattern as `useAuth`.
 */
export function useTheme(): {
  theme: Ref<Theme>
  resolvedTheme: Ref<ResolvedTheme>
  initTheme: () => void
  setTheme: (next: Theme) => boolean
} {
  // If a calling component is being torn down (e.g. HMR in dev), make
  // sure we don't leave a dangling matchMedia listener. The composable
  // is otherwise app-scoped, so this rarely fires.
  onScopeDispose(() => {
    detachMediaListener()
  })

  return { theme, resolvedTheme, initTheme, setTheme }
}
