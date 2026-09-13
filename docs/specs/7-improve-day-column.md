# Spec: Improve the day column (desktop + mobile)

## Goal

Make the week-view day column (`frontend/src/components/WeekView/DayColumn.vue`
and its `TaskCard` children) correct, accessible, and usable at every
breakpoint. Today the column is visually fine at "typical" widths but it has one
confirmed rendering bug, several a11y defects, sub-threshold touch targets, a
hard-coded width that forces horizontal scrolling on most desktops, and zero
feedback for the interactions it supports (drag/drop, note presence, progress).

## Current state

- `DayColumn.vue` renders header (day name + day number + `+`), a scrollable
  `.task-list` (virtualized above 50 tasks), an optional `.day-properties`
  block, and `DayNotes`. It is `flex: 0 0 160px`, `min-height: 300px`,
  `max-height: 500px`.
- `WeekView.vue` builds 7 columns per week, groups tasks into a
  `Map<date, Task[]>`, and owns the "scroll today into view" logic.
- `TaskCard.vue` owns its kebab menu (teleported, viewport-clamped) and an
  expandable notes textarea.
- Column width math: sidebar `280px` + `.week-container` padding `2 × 24px` +
  7 columns `160px` + 6 gaps `12px` = **1520px** of viewport needed to fit one
  week with the sidebar open (~1240px collapsed). Any desktop narrower than
  that — which is most of them — scrolls horizontally with no affordance
  signalling it.
- `style.spec.ts` already enforces `--space-*` tokens for every `padding` /
  `margin*` / `gap`, so all new rules in this spec must be token-based.
- `DayColumn.spec.ts` (226 lines) covers header render, `.today`, add-task,
  empty state, property rows, drop forwarding, and `open-day`.

## Priority legend

- **P0** — defect / incorrect behaviour or a hard a11y violation.
- **P1** — mobile usability blocker (touch targets, undiscoverable gestures).
- **P2** — layout & feedback polish with visible user impact.
- **P3** — structural / performance work that should not block the above.

Each numbered section below is independently shippable unless a *Depends on*
line says otherwise. Section order = the order they should be implemented.

### Section ↔ finding map

| Finding (from review) | Section | Priority |
| --- | --- | --- |
| #1 `v-memo` staleness | 1 | P0 |
| #2 nested-interactive ARIA | 2 | P0 |
| #3 stale `isToday` | 3 | P0 |
| #4 opacity contrast | 4 | P0 |
| #5 property inputs | 5 | P0 |
| #14 touch targets | 6 | P1 |
| #15 undiscoverable open-day | 7 | P1 |
| #16 no scroll affordance | 8 | P1 |
| #18 properties/notes crowd mobile | 9 | P1 |
| #19 property label truncation | 10 | P1 |
| #20 mandatory scroll-snap on mobile | 11 | P1 |
| #6 hard-coded 160px width | 12 | P2 |
| #7 `max-height: 500px` | 13 | P2 |
| #8 no drop feedback | 14 | P2 |
| #9 no progress / ordering | 15 | P2 |
| #10 empty-state noise | 16 | P2 |
| #11 no month/year context | 17 | P2 |
| #12 past days indistinguishable | 18 | P2 |
| #13 note invisible | 19 | P2 |
| #22 `VirtualList` fixed height | 20 | P3 |
| #17 no touch drag-and-drop | 21 | P3 |
| #21 emit-forwarding boilerplate | 22 | P3 |
| #23 columns too narrow at every breakpoint (user follow-up) | 23 | P1 |
| #24 progress chip removed from week view (user follow-up) | 24 | P2 |
| #25 open-day chevron removed from column header (user follow-up) | 25 | P2 |
| #26 day-column header uses full Jalali weekday names (user follow-up) | 26 | P2 |

---

# P0 — correctness and accessibility defects

## 1. Stale task cards caused by `v-memo` in the day column (P0) — item #1

**Problem (confirmed, not theoretical).** The non-virtualized list branch of
`DayColumn.vue` carries `v-memo="[task.status, projects.get(task.projectId)]`.
`projects` is a `Map` built once per `WeekView` render, so its identity is
stable across edits, and `task.status` does not change when a task is renamed.
Result: after **Edit** in the kebab menu, the card keeps showing the previous
title/description until the status or project changes.

Verified by experiment: two probe tests (rename a task; add a description)
fail with the `v-memo` line present and pass with it removed.

- **Change**: drop the `v-memo` directive. Vue's keyed diffing on
  `:key="task.id"` is sufficient at 5–20 cards per column, and the virtualizer
  already handles the pathological case.
- **Regression test** (written first, per `docs/TESTING.md`): in
  `DayColumn.spec.ts`, mount with one task, `setProps` a renamed copy with the
  same `id` and unchanged `status`/`projectId`, assert `.task-title` shows the
  new text; repeat for `.task-description`.
- **Acceptance**: both new tests pass; no other test changes; a manual edit of
  a task title in the UI is reflected immediately.

## 2. Invalid ARIA: interactive element nested inside a `role="button"` (P0) — item #2

**Problem.** `.day-header` has `role="button" tabindex="0"` and contains a real
`<button class="add-task-btn">`. A focusable interactive descendant inside a
button-role container is invalid — screen readers announce the header as one
button whose name includes "Add task", and the inner control's role is lost.

- **Change**: `.day-header` becomes a plain container (no `role`, no `tabindex`,
  no key handlers). The day-opening affordance becomes a real
  `<button>` — the same chevron button introduced in §7 — and the `+` stays a
  real button. Mouse-only whole-header click stays as a convenience handler on
  the container, without duplicating a keyboard role.
- **Keep**: the `open-day` emit name and payload, so `WeekView`/`App` wiring is
  unchanged.
- **Depends on**: none, but implement together with §7 so the markup lands once.
- **Acceptance**: no element with `role="button"` contains a `<button>`;
  header exposes an accessible name of the form "Open Monday in day view";
  existing `open-day` tests still pass (re-pointed at the new control, not
  weakened); `add-task` click does not emit `open-day`.

## 3. "Today" is computed once and never refreshes (P0) — item #3

**Problem.** `WeekView.vue` computes `isToday` from `new Date()` inside the
`weekDays` computed, and `isTodayInVisibleWeek()` reads `new Date()` directly.
A tab left open across midnight keeps the highlight on yesterday's column, and
the Today button snaps to the wrong column. Same class of staleness exists in
`utils/date.getWeekDays()`.

- **Change**: add one shared reactive clock (e.g.
  `frontend/src/composables/useTodayISO.ts`) exposing the current local ISO
  date, recomputed on a one-minute interval and on `visibilitychange` (tab
  wake). Feed it into `weekDays`, `isTodayInVisibleWeek()`, and `getWeekDays`
  (as an optional `today` parameter defaulting to today, so existing callers
  and tests are untouched).
- **Thread the value through props, don't read the clock in the leaf**:
  `DayColumn` must not own a timer; it receives `isToday` as it does today.
- **Out of scope for this section**: `JalaliDatePicker.vue` has the same
  pattern — tracked as a follow-up, not part of this task.
- **Acceptance**: with a fake-timer test that advances the clock past local
  midnight, exactly one column carries `.today` and it is the new day's;
  `isTodayInVisibleWeek()` follows the mocked clock; no component adds a
  `setInterval` outside the composable; the composable cleans up its listener
  and timer on unmount.

## 4. Opacity-based task states fail contrast (P0) — item #4

**Problem.** Completed cards use `opacity: 0.6` and cancelled `0.4` on the
whole `.task-card`, plus line-through on the title. Blended against the
background that lands at roughly 3:1 in light mode and below that for cancelled
rows in dark mode — under the 4.5:1 AA threshold for body text, and the
line-through is the *only* differentiator for cancelled items.

- **Change**: stop dimming the container. Introduce dedicated tokens in
  `style.css` (light + dark values) for completed and cancelled foreground
  colour, applied to `.task-title` / `.task-description` / project name
  instead of a container opacity. Keep the checkbox fill as the primary
  "done" signal and the strike-through as a secondary one; cancelled additionally
  keeps a distinct foreground token so it is not distinguished from completed
  by opacity alone. Empty-state icon opacity likewise moves to a token.
- **Constraint**: the two state tokens must be readable against **both**
  `--bg` (light `#FAF9F7`, dark `#1A1816`) and `--surface`.
- **Acceptance**: no `opacity` declaration remains on `.task-card.completed`,
  `.task-card.cancelled`, or `.empty-state svg`; both states still visually
  distinct from each other at a glance in dark mode; new tokens declared in
  `:root` and re-declared in the dark block, asserted by a `style.spec.ts`
  token-contract test (same pattern as the existing `--text` / `--placeholder`
  tests).

## 5. Property inputs: nameless, wrong keyboard, silently lossy (P0) — item #5

**Problem.** Each `.property-input` has no accessible name (the label is a
sibling `<span>`, not associated), no `inputmode` (mobile raises the full QWERTY
keyboard for a number field), ignores `Property.unit` (which `DayView` does
display), and coerces bad input with `parseFloat(value) || 0` — typing `abc`
into a field silently stores `0` and clears the user's data on the next render.

- **Change**, one section, three small steps:
  1. associate label and input (proper `for`/`id` pair generated from the
     property id, or `aria-label` combining name + unit),
  2. `inputmode="decimal"` and a sane `step` so mobile raises the numeric pad,
  3. keep the raw string locally so invalid input is recoverable, and emit only
     finite parsed numbers; show the unit in the row.
- **Acceptance**: the input has an accessible name containing the property name;
  `inputmode` present; entering a non-numeric value does not emit an update and
  does not blank the field; clearing the field still emits `0` (existing
  behaviour, locked by a test).

---

# P1 — mobile usability

## 6. Touch targets below the 44px minimum on mobile (P1) — item #14

**Problem.** At ≤768px: `.add-task-btn` is 28×28px, the `DayNotes` toggle is a
~22px-tall text row, the property input is 50×~24px. All under the 44×44px
minimum, and they sit inside a horizontally scrollable snap container, so
mis-taps also scroll the grid.

- **Change**: media-query bump for `--bp-md` and below — `+` and the new
  day-open button to ≥44px hit boxes, notes toggle row to ≥44px tall, property
  input height ≥40px with a wider tap area. Vertical space reclaimed by §9, so
  the column does not grow taller.
- **Note**: `width`/`height` are not scanned by the spacing lint, so literal px
  values are acceptable here; `padding`/`gap` changes must stay token-based.
- **Acceptance**: every interactive element in the column has a ≥44×44px box at
  375px and 414px viewport widths; no column height regression beyond §9's
  allowance.

## 7. Opening the day view is undiscoverable on touch (P1) — item #15

**Problem.** The only way into `DayView` is the header, which today looks like
a label, not a control.

- **Change**: render a persistent chevron/open button in the header (right of
  the day text, left of `+`), visible on mobile and revealed on hover at
  desktop widths. This button is the accessible control introduced in §2.
- **Depends on**: §2.
- **Acceptance**: an always-visible (on mobile) control exists per column whose
  accessible name includes the day; tapping it emits `open-day` with that
  column's date; tapping `+` still emits only `add-task`.

## 8. Nothing indicates the grid scrolls sideways (P1) — item #16

**Problem.** Seven 160px columns overflow on every common phone, but the only
cue is a 6px scrollbar. The user can scroll a column or two off-screen and not
realise tasks are hidden there — the reason the Today button needs its own
scroll-to-today workaround at all.

- **Change**, in two steps that can ship separately:
  1. **Edge affordance**: a right-edge fade (and left-edge once scrolled) on
     the grid, driven by scroll position, hidden when there is nothing to
     scroll to. Must not intercept drags or taps, and must respect the negative
     mobile margins on `.week-grid`.
  2. **Orientation**: surface the current day (e.g. a "Wed 14" pill) in
     `WeekNavigation` when today is inside the visible week, so the user always
     knows which day is the anchor even after scrolling today out of view.
- **Acceptance**: fade is absent when the grid fits (wide desktop), present on
  a 375px viewport, and disappears at the far-right end; `WeekNavigation`
  shows today's label when in-week and an out-of-week indicator otherwise;
  both components receive their data as props (no new state store).

## 9. Properties and notes permanently eat the mobile column (P1) — item #18

**Problem.** The `+ Day Notes` row and one row per property are always
mounted below the task list. In a 250px-tall mobile column with the 44px
targets of §6, that leaves very little room for the actual tasks.

- **Change**: on mobile only, collapse both into a single compact meta footer
  row (property sums/values + a note dot), tappable to expand the same
  controls inline. Desktop layout unchanged. Expansion state stays local to the
  column; columns are already re-keyed per date in `WeekView`, so no stale
  expansion leaks across navigation.
- **Depends on**: §19 (note indicator) for the dot semantics, §6 for sizing.
- **Acceptance**: at ≤768px, a column with 3 properties and a note shows ≤1
  collapsed row for that content; tapping reveals the inputs unchanged in
  behaviour (same emits, same save-on-blur); at ≥769px the current full layout
  is byte-identical in behaviour to today.

---

## 10. Property labels truncate to gibberish in a 160px column (P1) — item #19

**Problem.** `.property-label` is `white-space: nowrap` + `text-overflow:
ellipsis` inside a 160px column, so a property like "Deep sleep (h)" renders as
"Deep sl…" with no way to recover the name — and the numeric input is already
claiming 50px of that width.

- **Change**: give the label a `title` with the full property name (and unit),
  and let it wrap to two short lines on mobile instead of ellipsising, so the
  name is readable rather than merely hover-recoverable. The input keeps its
  width; the label gives it room by taking the row's remaining space.
- **Depends on**: §5 (label/input association) — extend the same accessible
  name to the tooltip so there is one source for the text.
- **Acceptance**: every property row exposes its full name (tooltip on
  pointer devices, wrapped text on touch); no label is cut off at 375px; the
  `§5` accessible-name assertion still holds.

## 11. Mandatory horizontal scroll-snap fights the page on mobile (P1) — item #20

**Problem.** `.week-grid` sets `scroll-snap-type: x mandatory` at every width.
On a phone, where the grid is one part of a vertically scrolling page,
mandatory snapping means every horizontal flick is forced to a column
boundary — so a diagonal swipe (the natural gesture when a column is taller
than the thumb's reach) snaps sideways when the user meant to scroll down.

- **Change**: use `x proximity` below `--bp-md` (snap still aligns when the
  user lands near a boundary, but does not force it), keep `x mandatory` at
  desktop widths where the grid is the whole page. Verify the
  `scroll-snap-align: start` declaration on `.day-column` still works for the
  Today scroll-to-position logic in `WeekView.scrollTodayIntoView()` — that
  function deliberately relies on snap points for day-aligned positioning, so
  it must keep snapping correctly under `proximity`.
- **Acceptance**: on a 375px viewport a diagonal swipe scrolls the page
  vertically without jumping columns, while a deliberate horizontal flick still
  lands day-aligned; the Today button still brings today's column fully into
  view on mobile and desktop; desktop snap behaviour unchanged.

# P2 — desktop layout, feedback, information

## 12. Hard-coded column width forces horizontal scroll on desktop (P2) — item #6

**Problem.** Per the math in *Current state*, a full week only fits without
horizontal scrolling at ≥1520px viewport (sidebar open) or ≥1240px (collapsed).
On a 1280px or 1440px laptop — the common case — the planner shows six-ish
columns and hides the rest behind an unlabelled horizontal scroll.

- **Change**: at widths above `--bp-md`, let the seven columns share the
  available space (grow/shrink with a sensible floor around 128–140px) instead
  of each demanding 160px. Horizontal scrolling remains by design below the
  floor (tablet/phone) and is now signalled by §8.
- **Acceptance**: a full seven-column week fits without horizontal scrolling at
  1440×900 with the sidebar open and at 1280×800 collapsed; still scrolls with
  snap + fade at 1024px and below; no raw px in any new `padding`/`margin`/`gap`.

## 13. Fixed `max-height: 500px` wastes vertical space (P2) — item #7

**Problem.** On a 1080p+ desktop the grid is capped at 500px while the page
area beneath is empty, so a 9-task day scrolls inside its column for no reason.
Nested vertical scroll (page + column) is also the worst combination for
trackpads.

- **Change**: tie the column max-height to the viewport (a `min()` of the
  current 500px cap and a viewport-relative budget), with the desktop cap
  raised so tall viewports get taller columns. Keep the mobile cap as is.
- **Acceptance**: columns grow past 500px on a tall desktop and stay ≤ their
  current height on a phone; the task list keeps its internal scroll (no
  unbounded growth); the page itself gains no new scrollbar.

## 14. No feedback while dragging or while a drop saves (P2) — item #8

**Problem.** `@dragover.prevent` is wired on the column but nothing highlights,
so there is no confirmation of *where* a card will land. After the drop,
`App.vue` awaits `updateTask` with no visual acknowledgement, so on a slow
network the card appears not to have moved.

- **Change**:
  1. Highlight the hovered column (border/shadow using the existing accent
     tokens) via a `dragenter`/`dragleave` **counter**, not raw enter/leave
     events — the counter is required because `dragleave` fires when the cursor
     crosses a child card and would otherwise flicker.
  2. Mark the moved card as pending while its save is in flight, cleared on
     settle. Failure surfaces through the existing `ErrorDisplay` path; the
     optimistic local value is already reconciled by `useTasks.updateTask`, and
     changing rollback behaviour is out of scope.
- **Acceptance**: only one column highlights at a time; highlight clears on
  drop, on drag-cancel, and when the cursor leaves the grid; a slow (deferred)
  drop shows a pending state on the card and clears it after resolution;
  cancelled tasks remain non-draggable.

## 15. No progress signal; completed tasks interleave with active ones (P2) — item #9

**Problem.** `3 of 5 done` is invisible. Completed cards are mixed into the
list in creation order, so the user scrolls past finished work to find what is
left — the single most common complaint pattern in this kind of grid.

- **Change**, in two shippable steps:
  1. Show a compact done/total count in the header when the day has tasks.
     **Superseded by §24 (user decision): the chip is removed entirely —
     step 1 no longer applies.**
  2. Order each column's tasks: active first, then completed, then cancelled,
     with a stable secondary key (`createdAt`, then `id`) so an unrelated edit
     never makes cards jump. Apply in `WeekView.tasksForDay` (memoized) so the
     sort runs once per data change, not once per column render.
- **Acceptance**: header count matches rendered cards including under the
  project filter; dragging a task to another column re-sorts both columns;
  toggling one task's status never reorders the other statuses' relative
  sequence; ordering is asserted in `WeekView.spec.ts` and the count in
  `DayColumn.spec.ts`.

## 16. Empty state is 150px of decoration × 7 columns (P2) — item #10

**Problem.** A 48px calendar icon plus `--space-8` padding plus
`min-height: 150px` for the words "No tasks". On a quiet week that is the
dominant visual of the whole page.

- **Change**: replace it with a quiet dashed "Add task" drop zone that is
  itself a real button emitting `add-task` for that date — turning dead space
  into the primary action, and simultaneously giving §14's drop target a visible
  boundary when the column is empty. Icon removed or reduced to a 16px inline
  glyph.
- **Depends on**: §2/§7 for the accessible-button pattern, §14 for the
  drag-over style.
- **Acceptance**: no 48px icon and no 150px dead block in an empty column;
  tapping the empty-zone emits `add-task` with the correct date; the zone is
  still a valid drop target.

## 17. No month or year context in the header (P2) — item #11

**Problem.** A column shows `1` — is that 1 March or 1 April? `Jan` appears
only in the week-range toolbar, far from the column. The Jalali month label is
worse: `monthLabelJalali` is threaded from `WeekView` into `DayColumn` and then
never rendered anywhere — a dead prop whose comment already admits it.

- **Change**: render a compact month marker in the day header where the
  calendar actually becomes ambiguous, keeping the day number visually
  dominant.
- **Format — decided: inline abbreviation beside the day number, not a
  tooltip.** Tooltips are rejected as the primary carrier because they do not
  exist on touch, and month-crossing weeks are exactly when a phone user loses
  context — the same discoverability mistake §7 and §10 correct. A `title` is
  fine as a bonus, never as the only channel.
- **Scope narrowed: mark only the mid-week rollover.** `formatWeekDisplay`
  already prefixes every week with its start month (`Mar 04-10, 2024`) and
  names both months when a week crosses (`Feb 26 - Mar 03, 2024`), so labelling
  the first column would duplicate the toolbar. The genuine gap is *which*
  column the new month starts on. Therefore: render the marker on exactly the
  column that is the 1st of a month in the active calendar (`getDate() === 1`
  Gregorian, `toJalaliYMD(...).jd === 1` Jalali) — e.g. `1 Mar`, `1 Ord` — and
  on no other column. A week that merely *starts* on the 1st is skipped, since
  the toolbar already says it.
- **Year marker** follows the same minimalism: only on the 1 January column
  (or `Far 1` of a new Jalali year), because a cross-year week already carries
  both years in the toolbar.
- **Detection computed centrally, not per column.** One helper in
  `utils/date.ts` (e.g. `monthMarkerFor(days, calendar): Map<dateISO, label>`)
  decides which column, if any, is marked; `WeekView` calls it and passes the
  resolved label down as a prop, so `DayColumn` stays free of calendar
  arithmetic. Reuse `toJalaliYMD` for the month/day and `jalaliMonthLength`
  (already exported from `utils/jalali.ts`) for month ends — do not re-derive
  either. Jalali month lengths are 31 for `jm` 1–6, 30 for `jm` 7–11, and 29
  for `jm` 12 (30 in a leap Jalali year, via `isLeapJalali`), so a Jalali
  boundary lands on a different weekday than the Gregorian 1st almost every
  week and the two checks cannot be collapsed into one. Render
  `monthLabelJalali` through the helper, retiring the dead prop's doc comment.
  New spacing must use `--space-*` (the `style.spec.ts` lint applies).
- **Acceptance**: a mid-month week is visually unchanged; a week rolling into a
  new month shows the marker on the rollover column only, in both calendar
  modes; a Jalali month boundary falling mid-week is marked on the correct
  column and not on the Gregorian 1st; the week's first column carries no
  marker; `monthLabelJalali` is either rendered or removed from the prop list,
  not left unused; the helper is unit-tested in `utils/date.test.ts` for both
  calendars, for a year-crossing week, for a week starting on the 1st, and for
  at least one Jalali boundary that is *not* a Gregorian 1st (proving the two
  calendars are evaluated independently).

## 18. Past days in the current week look identical to future days (P2) — item #12

**Problem.** Nothing in the column says whether a day has already happened, so
Monday and Friday read the same on a Wednesday — the user has to count back from
the accent ring to orient themselves.

**Change**: derive an `isPast` flag alongside `isToday` from the §3 clock and
soften the header treatment for elapsed days (secondary text token from §4 —
not another container opacity). Today stays the loudest element; future days
unchanged.

- **Depends on**: §3, §4.
- **Acceptance**: exactly the days before today in the visible week carry the
  past class; the class is absent for today and future; midnight rollover
  updates it.

## 19. A saved day note is invisible (P2) — item #13

**Problem.** The notes toggle always reads "Day Notes" whether the day has a
paragraph saved or nothing at all, so users must open it to remember.

- **Change**: show an indicator dot when the note is non-empty, and a
  single-line muted preview of the stored text when collapsed. Data is already
  available via the `dayNoteValue` prop, so this is presentation-only. This
  also supplies the note signal reused by the §9 mobile footer.
- **Acceptance**: dot + preview appear iff the trimmed note is non-empty;
  editing a note updates the indicator without a week navigation; expanded
  editing behaviour and save-on-blur are unchanged.

---

# P3 — structure and performance

## 20. `VirtualList` assumes a fixed 80px card height (P3) — item #22

**Problem.** `TASK_CARD_HEIGHT_PX = 80` is applied as both the slot's absolute
`height` and its `translateY` offset. Real cards are variable-height (2-line
description clamp, expanded notes textarea), so above the 50-task threshold
items overlap or clip — the virtualizer is actively broken for the case it
exists to serve.

- **Change**, choose one at plan time:
  1. **Measure** — per-item `ResizeObserver` writing into a height cache, with
     `itemHeight` as the initial estimate only. Correct for any content, more
     machinery, and the cache must be keyed by item id and pruned when the
     item set changes.
  2. **Constrain** — give the week-view card a deterministic height (clamp
     description to one line, keep notes collapsed and edit-in-place in
     `DayView` only). Simpler and cheaper, but it removes the inline notes
     affordance from the week grid.
- **Recommendation**: option 1, gated to the virtualized path only, so the
  ordinary 5–20-item column pays nothing.
- **Acceptance**: with >50 tasks including cards of differing heights, no
  rendered card overlaps its neighbour and total scrollable height matches the
  sum of measured heights; below the threshold, no `ResizeObserver` is created
  (existing guarantee preserved).

## 21. No way to move a task between days with touch (P3) — item #17

**Problem.** Moving between days relies on HTML5 drag-and-drop, which does not
fire on touch in any mainstream mobile browser. On a phone the only route is
kebab → **Move to…** — and the kebab is itself the item §6 raises to 44px.

- **In scope: one step only.** Surface the existing **Move to…** path more
  directly for touch — e.g. reachable from the column's own control rather than
  only from a per-card kebab — reusing the current `MoveModal` and its existing
  `move-task` path with no new data flow.
- **Deferred to its own task: pointer-event drag between columns** (long-press
  to start so vertical page scroll wins on a plain swipe, floating drag ghost,
  drop target driven by the §14 highlight). Rejected here on purpose: it has to
  contend with native touch scrolling and the snap container §11 changes, and
  it is plausibly the largest single change in this spec — nothing else in
  §1–§22 should wait behind it. Its constraints are recorded above so the
  follow-up spec can start from them.
- **Also out of scope**: a drag-and-drop library, multi-select batch move,
  reordering within a day (order within a day is defined by §15).
- **Acceptance**: on a 375px touch viewport a task can be moved to another day
  in ≤3 taps without using HTML5 drag; the existing `MoveModal` is the only
  destination UI (no parallel implementation); desktop mouse drag unchanged; no
  plain swipe accidentally triggers a move.

## 22. 13 emits re-declared and re-forwarded three times (P3) — item #21

**Problem.** `DayColumn` declares 13 emits, `WeekView` re-declares and re-wires
all 13 one-by-one, and `App.vue` binds them again — roughly 40 lines of
pure boilerplate, and `DayView` duplicates the same shape. Adding one action
means editing three (four) files in lockstep, which is how stale wiring bugs
like §1's `v-memo` survive review.

- **Change**: define one typed actions object (the day- and task-level
  operations, as functions) in a composable and expose it with `provide` from
  `App.vue`; `DayColumn`, `TaskCard`, `DayNotes`, and `DayView` `inject` it and
  call methods instead of emitting. Props that are *data* (tasks, projects,
  properties, calendar) stay as props — only the action channel changes.
- **Deliberately last, and confirmed so**: it rewrites the seam every other
  section in this spec touches, so it runs only after §1–§21 are green — doing
  it earlier would churn the tests the P0–P2 work relies on. See *Resolved
  decisions*.
- **Known cost**: the existing `wrapper.emitted(...)` assertions in
  `DayColumn.spec.ts`, `WeekView.spec.ts`, and `TaskCard.spec.ts` become
  invalid and must be re-expressed as "the injected action was called with these
  arguments" — a mechanical but wide test rewrite, accepted as part of this
  task.
- **Acceptance**: `DayColumn`/`WeekView` declare no task-level emits; behaviour
  identical at all breakpoints; no test deleted or weakened to achieve it;
  total lines of wiring reduced.


---

## 23. Day columns are too narrow at every breakpoint (P1) — user follow-up

**Problem.** On mobile/tablet the grid overflows, so every column sits
exactly at the §12 floor (`min-width: 128px`) and task titles wrap hard. On
desktop the floor binds too: at 1440×900 with the sidebar open (the default
above 1024px), 7 columns average ~148px — only ≥1632px viewports or a
manually collapsed sidebar give real width.

- **Change 1 — floor 128px → 176px** in `.day-column`. One rule covers both
  breakpoints: desktop columns share space but never shrink below 176px;
  below `--bp-md` the overflowing grid gives each column exactly 176px
  (2 full columns + a sliver of a third at 375px). No new media query.
- **Change 2 — auto-collapse the sidebar below 1632px.** A 176px floor
  needs 1632px viewport with the sidebar open (280 + 48 padding + 7×176 +
  6×12 gaps) and 1352px collapsed. `App.vue`'s mount default
  (`collapsed = width <= 1024`) becomes `collapsed = width < 1632`, so
  laptops get ≥176px columns instead of a scrolling 148px grid. The user
  can still open the sidebar; the grid then scrolls horizontally and §8's
  fades signal it. Mount-time only — no resize listener, matching the
  existing pattern.
- **§12 acceptance superseded:** "fits at 1440×900 sidebar-open /
  1280×800 collapsed" no longer holds at a 176px floor. New guarantee: fits
  at ≥1632px sidebar-open / ≥1352px collapsed; the auto-collapse default
  makes every viewport ≥1352px fit out of the box.
- **Tests:** `touch-targets.spec.ts` §12 describe re-pointed from `128px`
  to `176px` (plus an assertion that no mobile media query re-lowers the
  floor); the sidebar threshold is extracted into a pure helper in
  `utils/layout.ts` (`initialSidebarCollapsed(width)` — there is no
  App-level spec, and `App.vue` is too heavy to mount for one constant)
  and unit-tested at 1023/1024/1631/1632/1920.

**Acceptance:** 375×667 renders 176px columns with visibly less title
wrapping; 1440×900 opens sidebar-collapsed with seven ≥176px columns and no
horizontal scroll; ≥1632px opens with sidebar open and still fits; toggling
the sidebar open at 1440px re-enables the scroll fades; snap, §13 heights,
and §6 touch targets are unaffected; `pnpm test` + `pnpm build` pass.

---

## 24. Remove the done/total progress chip from the week view (P2) — user follow-up

**Problem.** §15 step 1 added a `N of N done` chip to every non-empty
column header. On an untouched day every column reads `0 of 5 done` — pure
noise across the whole week. **Decision (user): remove the chip entirely**, at
every breakpoint and every task state; §15 step 2's active-first ordering
remains the progress signal.

- **Change**: delete the `taskProgress` prop from `DayColumn`, its template
  block and CSS (including the `.day-column.past .day-progress` selector
  from §18), and the `taskProgress()` counter + `:task-progress` binding in
  `WeekView`. Removed outright, not left as a dead prop (the same rule §17
  applied to `monthLabelJalali`).
- **§15 superseded in part**: step 1 (header count) is removed; step 2
  (ordering) is untouched.
- **Tests**: the `progress chip (spec §15 step 1)` describe in
  `DayColumn.spec.ts` is rewritten as a *removal contract* — chip absent for
  `2/5`, `0/3`, `4/4` — a regression guard against re-introduction, not a
  weakening (the behaviour itself is being removed by spec).
  `useDayActions.test.ts`'s `baseProps` drops the `taskProgress` key.

**Acceptance:** no column header shows any done/total text at any breakpoint
or task state; the header is day name + number (+ month marker) only; §15
step 2 ordering still holds in `WeekView.spec.ts`; `vue-tsc`, `pnpm test`,
`pnpm build` green.

---

## 25. Remove the open-day chevron from the column header (P2) — user follow-up

**Problem.** §7 added a chevron button (`.open-day-btn`) beside `+` in each
column header so opening the day view was discoverable on touch. The
two-icon header reads as clutter. **Decision (user): remove the chevron
entirely.**

- **Change**: delete the `.open-day-btn` button + SVG from `DayColumn.vue`,
  all of its CSS (desktop hover-reveal, `:focus-visible` ring, and the §6
  mobile 44px override), and re-point `onOpenDay`'s doc comment. DayView
  entry becomes: clicking the column header (existing mouse/touch handler),
  or the header's date picker (keyboard path, unchanged).
- **A11y consequence (accepted, recorded)**: §2's "a real button carries the
  accessible `Open <day> in day view` name" contract retires with the
  chevron; keyboard users reach DayView via the header's date picker instead
  of a per-column control. The header container still carries no
  `role`/`tabindex` (§2's structural fix otherwise stands).
- **§7 superseded**: the persistent (mobile) / hover-revealed (desktop)
  chevron no longer exists. The `openDay` action wiring is unchanged —
  only its per-column trigger is gone.
- **Tests**: `DayColumn.spec.ts` — the header exposes exactly **one** button
  (add-task); the two accessible-name tests and the §7 discoverability
  describe (including its mobile-visibility CSS source check) become a
  removal contract; header-click-calls-`openDay`-once and `+`-never-opens
  tests survive. `useDayActions.test.ts` — the chevron test is removed.
  `touch-targets.spec.ts` — §6's `.open-day-btn` 44px assertion is
  re-pointed to the surviving `.add-task-btn` only.

**Acceptance:** the header shows only the `+` control; clicking the header
opens the day view exactly once; `+` adds a task and never opens day view;
keyboard entry to DayView still exists via the header's date picker;
`vue-tsc`, `pnpm test`, `pnpm build` green.

---

## 26. Day-column header uses the full Jalali weekday name (P2) — user follow-up

**Problem.** In Jalali mode the column header shows the abbreviated weekday
(`2 Shan`). The user wants the full name — **decided: the existing
`JALALI_WEEKDAY_LABELS_LONG` transliteration** (`2 Shanbe` … `Jomeh`,
`Shanbe`), the same strings `formatDayTitle` already renders, so the app
keeps one spelling and one source of truth. No label text is edited.

- **Change**: `WeekView.vue` reads the column header names from
  `JALALI_WEEKDAY_LABELS_LONG` instead of `JALALI_WEEKDAY_LABELS` (import +
  usage). Gregorian headers (`Mon`…, `weekday: 'short'`) are unchanged —
  the user asked only for the Jalali full name.
- **Scope**: week-view column headers only. `JalaliDatePicker` keeps the
  short labels (its grid columns are physically tiny — the constraint that
  motivated the abbreviations), and `formatDayTitle` already used the long
  form.
- **Tests**: `WeekView.spec.ts` — the jalali dayName test expects the long
  labels (`2 Shanbe`, `3 Shanbe`, `4 Shanbe`, `5 Shanbe`, `Jomeh`, `Shanbe`,
  `1 Shanbe` for Mon-start weeks) and is re-worded from "short" to "full";
  `jalali.test.ts` LONG-label contract already pins the strings — untouched.

**Acceptance:** in Jalali mode each column header shows the full weekday
name (`Shanbe`, not `Shan`) at every breakpoint; Gregorian headers are
byte-identical to today; the date picker grid still uses the short labels;
`vue-tsc`, `pnpm test`, `pnpm build` green.

---

## Out of scope (whole task)

- i18n / translation layer: every string in the column ("No tasks", "Day
  Notes", "Add task") stays hardcoded English, consistent with the rest of the
  app.
- Converting spacing to `rem`, or adding a second mobile token set.
- Any backend, schema, or API change — this task is presentation plus the two
  pure helpers in §3 and §15.
- `DayView` redesign (it stays a consumer of the same wiring), sidebar,
  `WeekNotes`, `WeekSummary`.
- Rollback/undo semantics for a failed drag-and-drop save.
- Touch long-press / pointer-event drag between days — §21 is
  scoped to making the existing **Move to…** path reachable on touch;
  real touch drag is a follow-up task (see §21 and *Resolved decisions*).
- The identical staleness bug in `JalaliDatePicker.vue` (§3 follow-up).

## Decisions pending from you

None — all four open questions are answered in *Resolved decisions*.

## Resolved decisions

- **§17 marker format = inline abbreviation beside the day number (option (a));
  tooltip rejected. Scoped to the mid-week month rollover only — the first
  column stays unmarked because `formatWeekDisplay` already carries it.** See §17.
- **§15 step 2 (in-column ordering) is IN**, to ship with step 1 as decided
  above. The done/total count is only actionable if the completed cards stop
  interleaving with active ones. Hard requirement recorded here: the sort key
  must be `(status bucket, createdAt, id)` so that toggling one task's status
  moves only that task and nothing else in the column reorders.

- **§21 ships the "make **Move to…** reachable on touch" step only**; the
  pointer-event drag experiment is deferred to its own task, so no other
  section waits behind it.

- **§22 (emit-forwarding refactor) stays in scope, as the very last section of
  the whole task.** You asked for it kept but moved behind the touch-drag work
  (it previously sat at #21, ahead of it). Consequence for the plan: the
  `wrapper.emitted(...)` → injected-action test rewrite happens exactly once,
  after every P0–P3 behaviour section has landed and is covered, so no section
  above has to be written twice against two different test seams. §22 is gated
  on all of §1–§21 being green.

## Acceptance criteria (task-level)

- Sections 1–5 (P0) complete with green regression tests written before the
  fixes.
- Sections 6–11 (P1) verified by hand at 375×667 and 414×896.
- Sections 12–19 (P2) verified by hand at 1280×800, 1440×900, and 1920×1080,
  with the sidebar both open and collapsed.
- Sections 20–22 (P3) implemented only after the above, in that order, with
  §22 (the emit-forwarding refactor) last and gated on §1–§21 all being green.
- Section 23 (P1, user follow-up) verified at 375×667 (column width) and
  1440×900 + 1632px (sidebar auto-collapse + no horizontal scroll), with the
  §12 "fits at 1440 sidebar-open" acceptance superseded as recorded in §23.
- Section 24 (P2, user follow-up): no done/total chip renders in any week-view
  column header at any breakpoint or task state, with the removal locked by
  the §24 removal-contract tests.
- Section 25 (P2, user follow-up): no `.open-day-btn` control exists in any
  day column header at any breakpoint; the header-click day-view entry and
  the date-picker keyboard path are locked by the §25 removal-contract tests.
- Section 26 (P2, user follow-up): Jalali column headers render the full
  weekday name from `JALALI_WEEKDAY_LABELS_LONG` (`Shanbe`…), Gregorian
  headers unchanged, `JalaliDatePicker` still short.
- `pnpm test` and `pnpm build` pass at the end of **every** phase, with no
  `.skip` / `.only`, output verified rather than assumed.
- No new `padding`, `margin*`, or `gap` declaration uses a raw `Npx` literal
  (the `style.spec.ts` lint stays green, which is the mechanism that enforces
  this).
- Nothing in this spec is observable only at one breakpoint: each section that
  adds or changes UI states its mobile/tablet/desktop behaviour explicitly and
  is checked there.
