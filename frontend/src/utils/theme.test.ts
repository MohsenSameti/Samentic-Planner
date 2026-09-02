/**
 * Tests for the `resolveTheme` helper.
 *
 * The function is a pure 2-input → 1-output table; six cases (three
 * choices × two system prefs). The contract:
 *
 *   - `'light'` always resolves to `'light'`, regardless of OS.
 *   - `'dark'` always resolves to `'dark'`, regardless of OS.
 *   - `'system'` resolves to whatever the OS reports (`true` → dark,
 *     `false` → light).
 *
 * Edge cases worth pinning down:
 *
 *   - The two manual choices must IGNORE the system pref, otherwise a
 *     user who picked Dark would have it flip on them whenever the OS
 *     was in light mode.
 *   - The OS pref must be a `boolean`, not a tristate — there is no
 *     "no preference" in our model (browsers that don't support
 *     `prefers-color-scheme` report `false`).
 */
import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme.js'
import type { ResolvedTheme, Theme } from '../types/index.js'

describe('resolveTheme', () => {
  /**
   * The full truth table. Iterating keeps the test in lockstep with
   * the `Theme` literal union: if a new choice is ever added, this
   * list will need to grow, which is a useful tripwire.
   */
  const cases: ReadonlyArray<{
    choice: Theme
    systemPrefersDark: boolean
    expected: ResolvedTheme
    reason: string
  }> = [
    { choice: 'light', systemPrefersDark: false, expected: 'light', reason: 'light overrides system (light OS)' },
    { choice: 'light', systemPrefersDark: true,  expected: 'light', reason: 'light overrides system (dark OS)' },
    { choice: 'dark',  systemPrefersDark: false, expected: 'dark',  reason: 'dark overrides system (light OS)' },
    { choice: 'dark',  systemPrefersDark: true,  expected: 'dark',  reason: 'dark overrides system (dark OS)' },
    { choice: 'system', systemPrefersDark: false, expected: 'light', reason: 'system follows OS in light mode' },
    { choice: 'system', systemPrefersDark: true,  expected: 'dark',  reason: 'system follows OS in dark mode' },
  ]

  for (const c of cases) {
    it(`returns '${c.expected}' when choice is '${c.choice}' and OS prefers dark = ${c.systemPrefersDark} (${c.reason})`, () => {
      expect(resolveTheme(c.choice, c.systemPrefersDark)).toBe(c.expected)
    })
  }

  it('returns only "light" or "dark" — never a third value', () => {
    const choices: ReadonlyArray<Theme> = ['light', 'dark', 'system']
    for (const choice of choices) {
      for (const sys of [false, true]) {
        const result = resolveTheme(choice, sys)
        expect(result === 'light' || result === 'dark').toBe(true)
      }
    }
  })
})
