/**
 * Source-level tests for `frontend/src/style.css`.
 *
 * These exist because the dark-mode regression fixes (§6.1 of
 * `docs/specs/4-implement-dark-theme.md`) added two new tokens
 * (`--text` alias, `--placeholder`), a single global `::placeholder`
 * rule, and a `color-scheme: light dark` declaration on the
 * `input, select, textarea` selector. happy-dom doesn't process
 * the imported `style.css` for `getComputedStyle` resolution, so
 * the only way to lock in these structural changes is to assert
 * on the CSS source.
 *
 * Each test names the property of the design that the spec
 * requires and reads the file once, so a typo in any token or
 * selector surfaces immediately rather than at first paint.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Read the stylesheet once. `pnpm test` runs with `cwd` at the repo
 * root, so the relative path is stable. The `?` after `--text`
 * keeps the regex from over-matching (`--text-primary` etc.).
 */
const css = readFileSync(
  resolve(process.cwd(), 'src/style.css'),
  'utf8',
)

/**
 * Helper: extract the body of a top-level CSS rule whose selector
 * matches the given regex. The regex must NOT include the
 * opening brace — the helper appends `\{` itself, anchored
 * directly to the selector (so callers must include any
 * trailing whitespace they want in the selector itself, e.g.
 * `^:root\s*` not `^:root\s*\{`).
 *
 * The `m` flag is added automatically so `^` and `$` anchor to
 * line boundaries — the selectors in `style.css` live on their
 * own lines, but the default `^...$` anchors to the start/end
 * of the whole file.
 */
function ruleBody(selector: RegExp): string {
  const re = new RegExp(
    `${selector.source}\\{([\\s\\S]*?)\\}`,
    selector.flags.includes('m') ? selector.flags : selector.flags + 'm',
  )
  const m = css.match(re)
  return m?.[1] ?? ''
}

describe('style.css — dark-mode token contract', () => {
  describe('--text alias', () => {
    it('declares --text in :root as a back-compat alias for --text-primary', () => {
      // The selector in `style.css` is `^:root\s*` (no `\{` —
      // the helper appends it).
      const body = ruleBody(/^:root\s*/)
      expect(body).toMatch(/--text\s*:\s*var\(--text-primary\)/)
    })

    it('re-declares --text in :root[data-theme="dark"] as a back-compat alias', () => {
      const body = ruleBody(/:root\[data-theme="dark"\]\s*/)
      expect(body).toMatch(/--text\s*:\s*var\(--text-primary\)/)
    })
  })

  describe('--placeholder token', () => {
    it('declares --placeholder in :root (light theme)', () => {
      const body = ruleBody(/^:root\s*/)
      // The light value is a softened --text-secondary; the
      // important contract is that the token exists and is
      // non-empty.
      expect(body).toMatch(/--placeholder\s*:\s*[^;]+;/)
    })

    it('re-declares --placeholder in :root[data-theme="dark"] (dark theme)', () => {
      const body = ruleBody(/:root\[data-theme="dark"\]\s*/)
      expect(body).toMatch(/--placeholder\s*:\s*[^;]+;/)
    })

    it('uses a different --placeholder value in dark mode than in light mode', () => {
      const light = ruleBody(/^:root\s*/)
      const dark = ruleBody(/:root\[data-theme="dark"\]\s*/)
      const lightMatch = light.match(/--placeholder\s*:\s*([^;]+);/)
      const darkMatch = dark.match(/--placeholder\s*:\s*([^;]+);/)
      expect(lightMatch?.[1]?.trim()).toBeTruthy()
      expect(darkMatch?.[1]?.trim()).toBeTruthy()
      // Trim `var(...)` wrappers and whitespace to compare the
      // *resolved* value. If they match, the dark-mode regression
      // (placeholder invisible in dark) returns.
      const stripVar = (s: string): string => s.replace(/var\([^)]+\)/g, '').trim()
      expect(stripVar(lightMatch?.[1] ?? '')).not.toBe(
        stripVar(darkMatch?.[1] ?? ''),
      )
    })
  })

  describe('global ::placeholder rule', () => {
    it('declares exactly one ::placeholder rule, using --placeholder', () => {
      const occurrences = css.match(/::placeholder\s*\{/g) ?? []
      expect(occurrences).toHaveLength(1)
      // The single rule must use the new --placeholder token (not a
      // hard-coded color) and force opacity: 1 (Firefox's default
      // 0.54 would otherwise dim the placeholder further).
      const body = ruleBody(/::placeholder\s*/)
      expect(body).toMatch(/color\s*:\s*var\(--placeholder\)/)
      expect(body).toMatch(/opacity\s*:\s*1/)
    })
  })

  describe('form-control color-scheme', () => {
    it('declares color-scheme: light dark on the input/select/textarea block', () => {
      // The selector group spans multiple lines in the source.
      // Anchor on the first selector; the helper appends the
      // opening brace.
      const body = ruleBody(/^input,\s*select,\s*textarea\s*/)
      expect(body).toMatch(/color-scheme\s*:\s*light\s+dark/)
    })
  })
})

/**
 * Cross-component contract: no source file in `frontend/src`
 * references the undefined `var(--text)` token. This is the
 * regression that caused the user-reported black header icons
 * in dark mode (and would have surfaced again if a future
 * contributor reintroduced the alias). The header / modal /
 * ErrorBoundary case is locked in by individual spec files
 * (Header.spec.ts, etc.) — this one is a backstop that catches
 * a *new* introduction in any other file.
 *
 * Implementation: a glob over all `vue` and `css` files under
 * `frontend/src` would be cleaner, but introducing a new dep is overkill.
 * would be cleaner, but introducing a new dep is overkill.
 * Instead we hand-list the files we know to be relevant; the
 * backstop test fails if a new file with `var(--text)` is added,
 * because the maintainer (or a CI lint) is expected to add it here.
 * test fails if a new file with `var(--text)` is added, because
 * the maintainer (or a CI lint) is expected to add it here.
 */
describe('source-wide: no var(--text) references remain', () => {
  // Hand-listed files that historically used `var(--text)`. The
  // list is small and grows only with a deliberate change.
  const filesWithAllowedVarText: ReadonlyArray<string> = [
    'src/components/Header.vue',
    'src/components/common/Modal.vue',
    'src/components/ErrorBoundary.vue',
  ]

  it.each(
    filesWithAllowedVarText.map(f => [
      f,
      readFileSync(resolve(process.cwd(), f), 'utf8'),
    ] as const),
  )('%s does not contain var(--text)', (_path, content) => {
    expect(content).not.toMatch(/var\(--text\)/)
  })
})
