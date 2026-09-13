/**
 * Source-wide guard for spec §4 (opacity contrast).
 *
 * `.task-card.completed` and `.task-card.cancelled` used to carry
 * container-level `opacity: 0.6` / `0.4`, which blended the card's
 * `--bg` into the page's `--surface` and dropped text contrast below
 * the AA 4.5:1 threshold. The fix replaces that with foreground
 * tokens (`--text-completed`, `--text-cancelled`); the container must
 * never get its opacity dimmed again, because doing so silently
 * re-introduces the same defect.
 *
 * Implementation: walk `frontend/src` for `*.vue` files, parse each
 * file's `<style>` block(s) with a tiny CSS rule scanner, and fail if
 * any rule body for one of the three target selectors contains
 * `opacity:`. The scanner is regex-based on purpose — the surface is
 * small (handful of components) and a full CSS parser would be
 * overkill.
 *
 * Co-located with `no-setInterval.spec.ts` (also §3) because both are
 * cheap source-wide grep guards. If a contributor adds a new
 * `opacity:` declaration on one of these selectors, this test fails
 * at CI before the visual regression can land.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Selectors that must NEVER carry a *raw* `opacity:` declaration in
 * their rule body. The container opacity on `.task-card.completed`
 * / `.task-card.cancelled` is what the spec §4 fix removes — any
 * value (literal, `var()`, anything) on those two is a regression.
 *
 * The empty-state SVG is in a softer spot: spec §4 says its opacity
 * should be *tokenised*, not removed. So a regression on that
 * selector is specifically a *raw numeric* literal (e.g.
 * `opacity: 0.5`), not the tokenised form
 * (`opacity: var(--icon-muted-opacity)`).
 */
const HARD_FORBIDDEN_SELECTORS: ReadonlyArray<string> = [
  '.task-card.completed',
  '.task-card.cancelled',
]
const RAW_LITERAL_FORBIDDEN_SELECTORS: ReadonlyArray<string> = [
  '.empty-state svg',
]

/**
 * Tiny CSS rule scanner: returns every `{ ... }` body whose selector
 * (the text up to the first `{`) exactly matches one of the
 * `FORBIDDEN_SELECTORS`. We don't try to handle nested rules,
 * comments inside selectors, etc. — `style` blocks in this project
 * are flat, and a regex scan is enough.
 */
function scanRulesForSelectors(
  css: string,
  selectors: ReadonlyArray<string>,
): Array<{ selector: string; body: string; offset: number }> {
  const out: Array<{ selector: string; body: string; offset: number }> = []
  // Match `selector { body }` where the body may not contain `{` or `}`.
  // The body capture is intentionally non-greedy and stops at the first `}`.
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  for (const m of css.matchAll(ruleRe)) {
    const selector = (m[1] ?? '').trim()
    const body = m[2] ?? ''
    const offset = m.index ?? 0
    if (selectors.includes(selector)) {
      out.push({ selector, body, offset })
    }
  }
  return out
}

describe('source-wide: no opacity on state / decoration classes (spec §4)', () => {
  // Only `.vue` files contain CSS-in-SFC for the target classes.
  // `style.css` declares the *tokens* (`--icon-muted-opacity: 0.5;`),
  // not the consumers, so it's intentionally excluded.
  const targetFiles: ReadonlyArray<string> = globSync('src/**/*.vue', {
    cwd: process.cwd(),
  }).sort()

  it('finds at least one source file under frontend/src', () => {
    expect(targetFiles.length).toBeGreaterThan(0)
  })

  it.each(
    targetFiles.map(f => [f, readFileSync(resolve(process.cwd(), f), 'utf8')] as const),
  )('%s has no opacity on forbidden selectors', (_path, content) => {
    // Only consider content inside `<style>` blocks; template
    // `style="..."` attributes are allowed (they don't reach the
    // cascade for these selectors anyway). We extract the
    // concatenated body of every `<style>` block and scan that.
    const styleBlocks: string[] = []
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g
    for (const m of content.matchAll(styleRe)) {
      styleBlocks.push(m[1] ?? '')
    }
    const css = styleBlocks.join('\n')
    // Container-level opacity on the card states is forbidden in any form.
    const hardMatches = scanRulesForSelectors(css, HARD_FORBIDDEN_SELECTORS)
    const hardViolations = hardMatches.filter(({ body }) => /\bopacity\s*:/.test(body))
    expect(hardViolations).toEqual([])

    // The empty-state SVG can keep an opacity *if* it goes through
    // the `--icon-muted-opacity` token. A raw numeric literal is the
    // exact regression spec §4 warned against.
    const literalMatches = scanRulesForSelectors(css, RAW_LITERAL_FORBIDDEN_SELECTORS)
    const literalViolations = literalMatches.filter(({ body }) => {
      if (!/\bopacity\s*:/.test(body)) return false
      // Accept `var(--icon-muted-opacity)`; reject any other value.
      const decl = body.match(/opacity\s*:\s*([^;]+);/)?.[1]?.trim() ?? ''
      return !decl.startsWith('var(')
    })
    expect(literalViolations).toEqual([])
  })
})
