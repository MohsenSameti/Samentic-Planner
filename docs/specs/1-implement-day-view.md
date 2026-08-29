# Spec: Day view

## Goal
Add a focused single-day view that gives a chosen day significantly more room than the cramped 160 px column in `WeekView`. The user enters day view by clicking the date header of a `DayColumn`, and returns to the week with a visible "← Week" button or the `Esc` key. Day view keeps feature parity with the day column (task list, properties, day note, all task actions) and gains prev/next-day navigation via physical chevron buttons (and a tap-the-date picker popover for jumping to an arbitrary day), a small day-summary block, and full Today-button support in both views, but does not introduce new entity types or any backend changes.

## Current state
- `frontend/src/App.vue` renders `<WeekView>` in the main content area. `WeekView` builds seven `DayColumn` instances in a horizontal scroll, each ~160 px wide, so task cards, properties, and notes are heavily compressed.
- `WeekNavigation` exposes prev/next-week arrows. `useWeekNavigation` exposes `currentWeekStart`, `weekDays`, `navigateWeek`, `goToToday`, `goToTodayTrigger`.
- `DayColumn` (in `frontend/src/components/WeekView/DayColumn.vue`) is the unit of day rendering inside `WeekView`. It owns: header (weekday + day number + add-task button), task list (`VirtualList` once > 50 items), per-day property inputs, and `<DayNotes>`. It emits a uniform event set (`add-task`, `update-day-note`, `update-property-value`, `drop-task`, plus all `TaskCard` events) that the parent forwards into the existing `App.vue` handlers.
- The data layer (`useTasks`, `useProperties`, `useNotes`, projects, `selectedProject` filter, `calendar` preference) is already shared and consumed by App.vue. No new server endpoints are needed.
- No router is in use. `App.vue` does conditional rendering (`v-if`/`v-else-if` chains) for auth + loading states.
- A `JalaliDatePicker` component already exists at `frontend/src/components/common/JalaliDatePicker.vue`; there's no Gregorian equivalent today (most use the native `<input type="date">`).
- Tests live next to components (`*.spec.ts`). Component contracts are exercised through emitted events, not internal refs.

## What needs to change
- **New `DayView` component** at `frontend/src/components/DayView/DayView.vue` + `DayView.spec.ts`:
  - Props mirror `DayColumn`'s event surface (same emit names + payload shapes) plus a `date` prop and a `dayName`/`dayNum`/`dayNumJalali`/`monthLabelJalali` header pair derived in `App.vue` from `currentDay`.
  - **Desktop layout (≥768 px)**: a centered single-column container with a max width of ~960 px that splits into a two-pane grid below the header — a left pane (tasks, `flex: 1`, `min-width: 0`) and a right pane (properties stacked above notes, `flex: 0 0 340 px`). The right pane is itself a flex column; the notes textarea uses `flex: 1` so it expands to fill the remaining height. Each pane has its own `overflow-y: auto` so long task lists or notes scroll inside their pane instead of pushing page height.
  - **Mobile layout (<768 px)**: full-width single column with 16 px gutters, identical card stacking order as desktop (header → summary → tasks → properties → notes).
  - **Header** (all breakpoints): back button on the left ("← Week"), centered weekday + date text in the middle (large on desktop, medium on mobile), prev/next-day chevrons (`‹` / `›`) flanking the date text. The centered date text is itself a button — clicking it opens a small date-picker popover (see `DatePickerPopover` below). Header height ≈ 56 px on mobile, ≈ 64 px on desktop.
  - **Summary line** (full width above the panes): `N active · M done · K cancelled` plus one badge per property with the day's value (e.g. "Hours 2.5", "Pages 30"). Small text, `--text-secondary`.
  - Re-uses `TaskCard`, `DayNotes` unchanged. Re-uses the same drag-and-drop payload (`text/plain` = task id). Property value input change emits `update-property-value`. Day notes textarea blur emits `update-day-note`. All other events forwarded one-for-one from `TaskCard`.
  - **Day navigation** — only physical buttons (chevrons) and the date-picker popover; no keyboard shortcuts:
    - Prev/next-day chevrons: emit `prev-day` / `next-day` (App.vue shifts `currentDay` by ±1 day).
    - Date picker popover: clicking the date text opens a small popover anchored to the header. Gregorian mode shows the native `<input type="date">` (calendar popup for free); Jalali mode shows a tiny inline `<JalaliDatePicker>` so the picker matches the calendar preference. Picking a date emits `navigate-day(date)` and closes the popover.
  - Back-to-week emits `back-to-week` from the visible button. The `Esc` key handler (see App.vue wiring below) also emits the same action.
- **New `DatePickerPopover` component** at `frontend/src/components/common/DatePickerPopover.vue` + `DatePickerPopover.spec.ts`:
  - Props: `value: string` (current ISO date), `calendar: Calendar`.
  - Emits: `update(value: string)`, `close()`.
  - Internal state: a boolean `open` ref; clicking the anchor toggles `open`. Renders `<input type="date">` for Gregorian or `<JalaliDatePicker>` for Jalali.
  - Closes on `Esc`, outside click (handled by a `mousedown` document listener attached while open), or after a pick.
  - Renders inline (no portal/teleport) so it lives inside the header element; positions itself with `position: absolute` and `z-index` above the panes.
- **`App.vue` view-mode state**:
  - Add `viewMode: 'week' | 'day'` ref (default `'week'`) and `currentDay: string` ref (defaults to today ISO).
  - Add `openDayView(date)` (sets `currentDay` and flips `viewMode` to `'day'`), `closeDayView()` (sets `viewMode` back to `'week'` and re-anchors `currentWeekStart` to the week containing `currentDay` so the user lands on the right week), `navigateDay(dir)` (shifts `currentDay` by ±1), `jumpToDay(date)` (sets `currentDay` to the picked ISO date).
  - Replace `<WeekView>` with a `v-if`/`v-else` that renders `WeekView` or `DayView` based on `viewMode`. Both pass the same entity data; `DayView` also gets `currentDay`, the prev/next/back-to-week handlers, and the `navigate-day(date)` handler.
  - **No new event handler bodies for entity actions** in `App.vue` — `DayView` reuses the same emits (`add-task`, `edit-task`, `move-task`, `toggle-task-status`, `cancel-task`, `restore-task`, `delete-task`, `update-task-notes`, `update-property-value`, `update-day-note`, `drop-task`) that `DayColumn` already produces.
  - **Today button behaviour**: in week view, jumps to current week as today (unchanged). In day view, jumps `currentDay` to today and stays in day view. The existing `goToTodayTrigger` increments in both cases so `WeekView`'s auto-scroll still fires when needed.
  - Wire a `window`-level `keydown` listener for `Esc` only when `viewMode === 'day'`; remove it when leaving day view. `Esc` calls `closeDayView()`. No other keyboard shortcuts for day navigation (← / → / Home are intentionally not wired — physical chevrons are the only in-day navigation path; the keyboard is reserved for typing inside the notes textarea and property inputs).
- **`DayColumn` header becomes clickable**:
  - Add an `emit('open-day', date)` on the day-column header (the `.day-header` div's weekday/date text, not the `+` button). The button stops propagation so the add-task button stays independent.
  - `WeekView` forwards `open-day` up to `App.vue`, which calls `openDayView(date)`.
- **Tests**:
  - `DayView.spec.ts` (new): renders header (back button, weekday, date, prev/next chevrons, summary counts), forwards every event `DayColumn` forwards, prev/next emit correct directions, back-button emits `back-to-week`, clicking the date text opens the date picker popover, picking a date in the popover emits `navigate-day` with the picked ISO date. Mounted in isolation against the same fixture style as `DayColumn.spec.ts` (no composables, no API).
  - `DatePickerPopover.spec.ts` (new): renders Gregorian vs Jalali control based on `calendar` prop, emits the picked ISO date, closes on outside click / Esc / pick.
  - `WeekView.spec.ts`: add tests for the new `open-day` event forwarding from a `DayColumn` header click, asserting the date payload.
  - `DayColumn.spec.ts`: add tests for `open-day` emit on header click and that clicking the `+` button does *not* emit `open-day`.
  - `App.vue` Esc-handler is covered indirectly via the existing wiring tests (no new App.vue tests unless something surprising surfaces — the handler is simple enough that the integration is more valuable than a unit).
- **Accessibility / responsive**:
  - Back button has `aria-label="Back to week"`. Prev/next-day chevrons have `aria-label="Previous day"` / `"Next day"`.
  - Date text button has `aria-label="Pick a date"` (the text inside already conveys the current date).
  - On viewports <768 px, the back button collapses to just an arrow glyph (still labelled for screen readers), and the day-summary line wraps onto multiple lines if needed.
  - Touch target sizes ≥ 36 px so mobile users can tap prev/next/back reliably.

## Out of scope
- New backend endpoints, schema changes, or migrations. `Tasks` already carry an ISO `date`, which is everything day view needs.
- Adding new task fields, properties, or notes types.
- Keyboard shortcuts for day-to-day navigation (← / → / Home). Only `Esc` (already approved separately) is wired.
- Drag-and-drop between days inside day view (the column already accepts drops via `drop-task`, but in day view there is only one day so the action would be a no-op; do not advertise it).
- A separate route (vue-router is not installed and App.vue does not currently use it).
- Reskinning `WeekView` itself. The week view layout, columns, and styling stay the same.
- A "month view" or any other new granularity.
- Persisting `viewMode` or `currentDay` across reloads. The default-on-load view stays "week" with no remembered day — entering day view is an in-session action only.

## Acceptance criteria
- Clicking the date header (weekday name + day number, not the `+` button) inside any `DayColumn` switches the main view from week to day, focused on that date.
- In day view, the user can step backward/forward one day at a time using the chevron buttons; the date display updates and the task list, property values, and notes all update to match the new day. No keyboard shortcuts step days.
- Clicking the date text in the day-view header opens a date picker popover. Picking a date moves the focused day to that date and closes the popover. The popover respects the user's calendar preference (Gregorian → native date input, Jalali → `JalaliDatePicker`). The popover also closes on `Esc` and on outside click.
- Clicking the visible "← Week" button returns to the week view; the week displayed contains the day the user was just on.
- Pressing `Esc` while in day view returns to the week view (same effect as the back button). `Esc` does nothing in week view.
- The "Today" button in the toolbar works in both views: in week view it returns to today's week (unchanged); in day view it sets `currentDay` to today and stays in day view.
- Day view shows: header (back button, large weekday + date, prev/next chevrons), a summary line (`N active · M done · K cancelled` plus per-property badges with the day's values), the task list using the existing `TaskCard` in the left pane, day-property inputs in the right pane above the day-notes textarea (desktop ≥768 px). Below 768 px, all three sections stack full-width in the order tasks → properties → notes.
- Behaviour, project filter, and calendar preference match the corresponding `DayColumn` for that day.
- All events emitted by `DayColumn` are also emitted by `DayView` with identical payload shapes so `App.vue` can wire them to the same handlers with no new handler bodies.
- Layout is usable on a 360 px-wide mobile viewport, a 768 px-wide tablet viewport, and a 1280 px desktop viewport: no horizontal page scroll, no clipped controls, all tap targets ≥ 36 px.
- `pnpm test` and `pnpm build` both pass with the new component, new tests, and updated existing tests, with no `.skip` / `.only` left behind.
