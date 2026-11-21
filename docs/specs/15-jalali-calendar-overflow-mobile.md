# Spec: Fix Jalali calendar overflow in task dialog on mobile

## Goal
The Jalali date picker inside the Add Task / Edit Task dialog must fit within
the modal at small mobile viewports (down to 320px) without a horizontal
scrollbar.

## Current state
- `TaskModal` renders `JalaliDatePicker` inline when the calendar setting is
  `jalali` (Persian language forces it).
- Measured (Chromium, Jalali calendar, Add Task dialog open):
  - 390×844: picker 310px, fits (0 overflow).
  - 360×740: 26px horizontal overflow inside the modal.
  - 320×568: 66px overflow.
- Root causes, all in `JalaliDatePicker.vue` scoped styles:
  1. `.grid` uses `repeat(7, 1fr)` — grid tracks have a min-content floor.
     Persian weekday labels (~41px each at 0.7rem, e.g. "چهارشنبه") make the
     grid's min-content ≈ 313px, wider than the ~254px available at 360px.
  2. `.jalali-picker` hard-codes `min-width: 280px`, so the picker cannot
     shrink to the available modal-content width.

## What needs to change
- `JalaliDatePicker.vue`:
  - Grid tracks shrinkable: `repeat(7, minmax(0, 1fr))`.
  - Fluid width: replace the hard `min-width: 280px` with a fluid width that
    fills the available space up to a sensible maximum (~320px). The
    `DatePickerPopover` override (`:deep(.jalali-picker) { width: 280px;
    max-width: 100% }`) keeps the popover behaviour unchanged.
  - Narrow-viewport weekday labels (≤ 480px, decided: **narrow only**, not
    all sizes): switch the header row to compact abbreviations and reduce the
    label font. Reactive to viewport resize via `matchMedia`.
  - Weekday label cells: `min-width: 0` so they cannot push grid tracks out.
- `utils/date.ts`: add a compact Persian weekday list
  (`WEEKDAYS_FA_COMPACT`: یک / دو / سه / چهار / پنج / جم / ش) aligned with
  the existing `WEEKDAYS_FA` `getDay()` indexing. English side reuses the
  existing `JALALI_WEEKDAY_LABELS_COMPACT`.
- Regression tests:
  - Component spec: header shows full labels above 480px, compact labels at
    ≤ 480px, and swaps on resize (mock `matchMedia`).
  - Playwright (all three projects): Jalali calendar active, Add Task
    dialog at 390 / 360 / 320px and wide (1440px) viewports — no
    horizontal overflow on the page or inside `.modal`
    (`scrollWidth − clientWidth` ≤ 1), the picker's bounding box is fully
    inside the viewport, its width respects the 320px cap on wide layouts,
    and a day cell in the view month is clickable (selection moves to it).

## Out of scope
- `DatePickerPopover` positioning/caps (its own rules already cap it; the
  shared picker CSS fix applies to it automatically).
- Week/Day view layouts and tablet/desktop sizes (already fit).
- Full weekday names everywhere: intentionally unchanged above 480px.
- Unrelated infra note found while reproducing: `pnpm build` does not copy
  `backend/src/db/migrations` into `dist`, so `pnpm test:e2e` crashes at
  backend startup on a clean checkout. Tracked separately.

## Acceptance criteria
- Add Task dialog with Jalali calendar: no horizontal scroll at 320, 360,
  and 390px viewports; picker fully visible and cells tappable.
- At ≤ 480px the picker header shows compact weekday labels with the reduced
  font; above 480px the full labels are shown.
- 390px+ and Gregorian paths: picker is capped at 320px on wide layouts
  (per the fluid-width change); otherwise unchanged.
- `pnpm test`, `pnpm build`, `pnpm test:e2e` pass; UI checked at
  mobile/tablet/desktop.
