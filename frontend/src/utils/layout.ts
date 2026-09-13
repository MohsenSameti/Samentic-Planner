/**
 * Pure layout thresholds shared by mount-time decisions in `App.vue`
 * (spec §23).
 *
 * Extracted from `App.vue` so the breakpoint constants are
 * unit-testable without mounting the app — no App-level spec exists,
 * and `App.vue` is too heavy (composables, async modals, network) to
 * mount for one constant.
 */

/**
 * Week-fit breakpoint: the narrowest viewport at which a full
 * 7-column week fits without horizontal scrolling with the sidebar
 * OPEN (280px sidebar + 48px `.week-container` padding + 7 × 176px
 * columns + 6 × 12px gaps = 1632px). Below it the sidebar starts
 * collapsed so every viewport ≥1352px (1632 − 280) still fits a week.
 */
export const WEEK_FITS_WITH_SIDEBAR_PX = 1632

/**
 * Viewport width below which the sidebar is an overlay (backdrop +
 * slide-in) rather than a flex sibling — matches the existing
 * `@media (max-width: 1024px)` backdrop rule in `App.vue`.
 */
export const SIDEBAR_OVERLAY_PX = 1024

/**
 * Default sidebar state at mount time (spec §23).
 *
 * - Collapsed below the week-fit breakpoint so the seven 176px-floor
 *   columns get the room they need on common laptop widths.
 * - The user can still open it; the grid then scrolls horizontally
 *   and §8's edge fades signal the overflow.
 * - Mount-time only, matching the previous behaviour: no resize
 *   listener re-collapses the sidebar out from under the user.
 */
export function initialSidebarCollapsed(width: number): boolean {
  return width < WEEK_FITS_WITH_SIDEBAR_PX
}
