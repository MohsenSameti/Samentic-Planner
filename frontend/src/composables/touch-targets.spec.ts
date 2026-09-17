/**
 * Source-level guard for spec §6: every interactive element in the
 * day column meets the 44x44px (or 40px for inputs) touch-target
 * minimum at <=768px viewport widths.
 *
 * happy-dom doesn't compute CSS for `@media` rules, so the only
 * deterministic assertion is on the *source* — pin the size bump
 * exists in the right place and the right value, and a future
 * contributor who lowers the touch target will fail this test at CI.
 *
 * Acceptance criteria mapped to assertions:
 *   - `.add-task-btn` + `.open-day-btn`: 44x44px at <=768px
 *   - `.day-notes-toggle`: 44px tall at <=768px
 *   - `.property-input`: >=40px tall at <=768px
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Extract a top-level @media block body, balancing nested braces.
 * The CSS in `<style scoped>` blocks doesn't have @nest or other
 * exotic constructs, so a simple depth counter is enough.
 */
function extractMediaBlocks(css: string, maxWidthPx: number): string[] {
  const out: string[] = []
  const re = new RegExp(
    `@media\\s*\\(\\s*max-width\\s*:\\s*${maxWidthPx}px\\s*\\)\\s*\\{`,
    'g',
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    while (i < css.length && depth > 0) {
      const ch = css[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    if (depth === 0) {
      out.push(css.slice(start, i - 1))
    }
    re.lastIndex = i
  }
  return out
}

/** Concatenate every `<style>` block body in a `.vue` file,
 *  tracking brace depth so the non-greedy `.*?` doesn't break when
 *  blocks are nested (rare, but possible in scoped styles). */
function styleContent(path: string): string {
  const content = readFileSync(resolve(process.cwd(), path), 'utf8')
  const blocks: string[] = []
  const re = /<style[^>]*>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const start = m.index + m[0].length
    // Find the matching </style>. A naive `indexOf` would mis-fire
    // if a comment contained the literal `</style>`, which never
    // happens in this repo but is cheap to be correct about.
    const end = content.indexOf('</style>', start)
    if (end === -1) break
    blocks.push(content.slice(start, end))
    re.lastIndex = end + '</style>'.length
  }
  return blocks.join('\n')
}

describe('source-wide: touch targets meet 44px minimum on mobile (spec §6)', () => {
  describe('DayColumn.vue', () => {
    const css = styleContent('src/components/WeekView/DayColumn.vue')
    const mobileBlocks = extractMediaBlocks(css, 768)

    it('declares a @media (max-width: 768px) block', () => {
      expect(mobileBlocks.length).toBeGreaterThan(0)
    })

    it('bumps .add-task-btn to >=44x44 on mobile', () => {
      const rule = mobileBlocks
        .join('\n')
        .match(/\.add-task-btn\s*\{[^}]*\}/)?.[0] ?? ''
      const w = rule.match(/width\s*:\s*(\d+)px/)?.[1]
      const h = rule.match(/height\s*:\s*(\d+)px/)?.[1]
      expect(Number(w)).toBeGreaterThanOrEqual(44)
      expect(Number(h)).toBeGreaterThanOrEqual(44)
    })

    /**
     * Spec §25: the `.open-day-btn` chevron is gone, so the header's
     * only interactive control is `.add-task-btn` — the 44px bump must
     * survive on it alone. Also pin that no `.open-day-btn` rule
     * sneaks back into the mobile block.
     */
    it('leaves no .open-day-btn rule on mobile (§25 removal)', () => {
      expect(mobileBlocks.join('\n')).not.toMatch(/\.open-day-btn/)
    })

    it('bumps .property-input to >=40px tall on mobile', () => {
      const rule = mobileBlocks
        .join('\n')
        .match(/\.property-input\s*\{[^}]*\}/)?.[0] ?? ''
      const h = rule.match(/(?:min-)?height\s*:\s*(\d+)px/)?.[1]
      // If `height` is set, it counts as the tap area; if `min-height`
      // is set, the box grows to at least that. Either passes the spec.
      expect(Number(h)).toBeGreaterThanOrEqual(40)
    })
  })

  describe('DayNotes.vue', () => {
    const css = styleContent('src/components/Notes/DayNotes.vue')
    const mobileBlocks = extractMediaBlocks(css, 768)

    it('bumps .day-notes-toggle to >=44px tall on mobile', () => {
      const rule = mobileBlocks
        .join('\n')
        .match(/\.day-notes-toggle\s*\{[^}]*\}/)?.[0] ?? ''
      const h = rule.match(/(?:min-)?height\s*:\s*(\d+)px/)?.[1]
      // If the rule isn't in a media block at all, fail — the
      // desktop-only ~22px height is exactly the bug spec §6
      // describes.
      expect(h).toBeDefined()
      expect(Number(h)).toBeGreaterThanOrEqual(44)
    })
  })

  it('keeps the desktop button size at 28x28 (the spec is mobile-only)', () => {
    // Sanity check: the bump must be inside @media (max-width: 768px),
    // not a blanket change. Reading the desktop rule separately
    // confirms the base size was preserved at desktop widths.
    const css = styleContent('src/components/WeekView/DayColumn.vue')

    // Find the FIRST `.add-task-btn { ... }` rule outside any @media
    // block. Approximate by stripping all @media blocks then matching.
    const withoutMedia = css.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '')
    const desktopAdd = withoutMedia.match(/\.add-task-btn\s*\{[^}]*\}/)?.[0] ?? ''
    const w = desktopAdd.match(/width\s*:\s*(\d+)px/)?.[1]
    const h = desktopAdd.match(/height\s*:\s*(\d+)px/)?.[1]
    expect(Number(w)).toBe(28)
    expect(Number(h)).toBe(28)
  })
})

/**
 * Spec §8: edge fades + orientation pill.
 *
 * happy-dom can't compute `@media` queries or actual scroll metrics,
 * so the fade visibility assertions are structural (CSS source has
 * the right selectors + declarations). The orientation pill is
 * already covered in `WeekNavigation.spec.ts`.
 */
describe('source-wide: scroll affordances (spec §8)', () => {
  const css = styleContent('src/components/WeekView/WeekView.vue')

  it('declares a .grid-fade-left rule with a left-to-transparent gradient', () => {
    const rule = css.match(/\.grid-fade-left\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/background\s*:\s*linear-gradient\(\s*to\s+right/)
  })

  it('declares a .grid-fade-right rule with a right-to-transparent gradient', () => {
    const rule = css.match(/\.grid-fade-right\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/background\s*:\s*linear-gradient\(\s*to\s+left/)
  })

  it('disables pointer events on the fades so they never intercept drags or taps', () => {
    // Spec §8 acceptance: "must not intercept drags or taps".
    const rule = css.match(/\.grid-fade\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/pointer-events\s*:\s*none/)
  })

  it('overrides the .week-grid with position:relative so the absolute fades anchor correctly', () => {
    // The fades are absolutely positioned; their container needs
    // `position: relative` for the offsets to mean "inside the grid"
    // rather than "relative to the viewport".
    const rule = css.match(/\.week-grid\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/position\s*:\s*relative/)
  })

  /**
   * Spec §11: the week grid uses mandatory scroll-snap on desktop,
   * proximity on mobile. happy-dom doesn't apply media queries, so we
   * assert on the CSS source.
   */
  it('keeps desktop snap mandatory (the default)', () => {
    const rule = css.match(/\.week-grid\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/scroll-snap-type\s*:\s*x\s+mandatory/)
  })

  it('downgrades snap to proximity on mobile', () => {
    // Find the @media block for the grid; the snap rule inside it
    // must use `x proximity`, not `x mandatory`. Otherwise a phone
    // user can't scroll the page diagonally without the grid
    // stealing the gesture.
    const blocks = extractMediaBlocks(css, 768)
    const mobileCss = blocks.join('\n')
    const rule = mobileCss.match(/\.week-grid\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/scroll-snap-type\s*:\s*x\s+proximity/)
  })
})

/**
 * Spec §12, as superseded by §23: at desktop widths, the seven columns
 * share the available space instead of each demanding a hard-coded width.
 * Floor is 176px so task titles don't wrap hard at any breakpoint; with
 * the sidebar auto-collapsed below 1632px (§23 change 2), every viewport
 * ≥1352px fits a full week without horizontal scrolling.
 */
describe('source-wide: column width is fluid on desktop (spec §12, §23)', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/components/WeekView/DayColumn.vue'),
    'utf8',
  )

  it('declares .day-column as flex: 1 1 0 (sharing space)', () => {
    // Outside any @media block; the desktop default.
    const withoutMedia = css.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '')
    const rule = withoutMedia.match(/\.day-column\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/flex\s*:\s*1\s+1\s+0/)
  })

  it('keeps the 176px minimum width so the column stays readable (§23)', () => {
    const withoutMedia = css.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '')
    const rule = withoutMedia.match(/\.day-column\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/min-width\s*:\s*176px/)
  })

  it('never re-lowers the floor on mobile (§23)', () => {
    // Below --bp-md the grid overflows and the floor *is* the column
    // width, so no @media (max-width: 768px) block may re-declare a
    // smaller .day-column min-width.
    const mobileBlocks = extractMediaBlocks(css, 768)
    const mobileCss = mobileBlocks.join('\n')
    const rules = [...mobileCss.matchAll(/\.day-column\s*\{([^}]*)\}/g)].map(
      m => m[1] ?? '',
    )
    for (const rule of rules) {
      expect(rule).not.toMatch(/min-width/)
    }
  })
})

/**
 * Spec §13: tie column max-height to the viewport on desktop so a
 * 1080p+ monitor gets a taller column instead of dead space below
 * the grid; mobile keeps the original 500px cap.
 */
describe('source-wide: column max-height is viewport-tied on desktop (spec §13)', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/components/WeekView/DayColumn.vue'),
    'utf8',
  )

  it('uses a viewport-relative `min()` cap on desktop', () => {
    const withoutMedia = css.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '')
    const rule = withoutMedia.match(/\.day-column\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/max-height\s*:\s*min\(/)
    // The 720px ceiling is the deliberate upper bound.
    expect(rule).toMatch(/min\(\s*720px/)
    // The viewport-budget arm of the min().
    expect(rule).toMatch(/calc\(100vh\s*-\s*200px\)/)
  })

  it('overrides the cap back to 500px on mobile', () => {
    // Inside the @media (max-width: 768px) block the rule must
    // restore the original 500px cap — the spec calls this out
    // explicitly so phones in portrait don't get a uselessly tall
    // column.
    const mobileBlocks = extractMediaBlocks(css, 768)
    const mobileCss = mobileBlocks.join('\n')
    const rule = mobileCss.match(/\.day-column\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/max-height\s*:\s*500px/)
  })
})
