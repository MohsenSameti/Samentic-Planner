/**
 * Unit tests for the layout threshold helpers (spec §23).
 *
 * `App.vue` seeds the sidebar's default collapsed state from the
 * viewport width at mount time. That decision used to be an inline
 * magic number (`window.innerWidth <= 1024`), untestable without
 * mounting the whole app — and no App-level spec exists. Extracting
 * it into a pure function makes the thresholds pin-able:
 *
 *   - below 1024px the sidebar is an overlay, so it starts collapsed;
 *   - below 1632px a full 7-column week at the §23 176px column floor
 *     (280px sidebar + 48px padding + 7×176px + 6×12px gaps) would
 *     scroll horizontally, so the sidebar also starts collapsed;
 *   - from 1632px up the week fits with the sidebar open.
 */
import { describe, expect, it } from 'vitest'
import { initialSidebarCollapsed } from './layout.js'

describe('initialSidebarCollapsed (spec §23)', () => {
  it('collapses below the overlay breakpoint (1024px)', () => {
    expect(initialSidebarCollapsed(1023)).toBe(true)
  })

  it('collapses between 1024px and the week-fit breakpoint', () => {
    expect(initialSidebarCollapsed(1024)).toBe(true)
    expect(initialSidebarCollapsed(1351)).toBe(true)
  })

  it('collapses just under the week-fit breakpoint (1632px)', () => {
    // 1631 < 1632: a 7×176px week plus an open 280px sidebar does
    // not fit without horizontal scrolling.
    expect(initialSidebarCollapsed(1631)).toBe(true)
  })

  it('stays open from the week-fit breakpoint up (1632px+)', () => {
    expect(initialSidebarCollapsed(1632)).toBe(false)
    expect(initialSidebarCollapsed(1920)).toBe(false)
  })
})
