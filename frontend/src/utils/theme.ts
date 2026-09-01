/**
 * Theme utilities.
 *
 * Kept separate from the `useTheme` composable so the pure resolution
 * rule (`resolveTheme`) is testable in isolation — it has no DOM,
 * localStorage, or Vue dependency, and is the one piece of logic
 * that's worth pinning down with a full truth-table test.
 */
import type { ResolvedTheme, Theme } from '../types'

/**
 * Resolve a user's theme *choice* into the *applied* theme given the
 * OS preference.
 *
 * Rules:
 *
 *   - `'light'` and `'dark'` ignore the system pref — the user has
 *     explicitly asked for a particular look and we honor it even if
 *     the OS flips.
 *   - `'system'` always defers to the OS preference.
 *
 * The function is intentionally total: every input combination
 * produces one of the two `ResolvedTheme` values, no `null` /
 * `undefined` / exceptions.
 */
export function resolveTheme(choice: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'light') return 'light'
  if (choice === 'dark') return 'dark'
  return systemPrefersDark ? 'dark' : 'light'
}
