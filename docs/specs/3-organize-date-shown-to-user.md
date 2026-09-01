# Spec: Organize date shown to user

## Goal
Improve the date format shown to the user: change all user-facing date displays to a consistent `yyyy-MM-dd (shortWeekday)` format, replace English weekday labels with Persian numeric labels (`1 Shan … 5 Shan`, `Jomeh`, `Shan`) in Jalali mode, and keep Gregorian labels in English short form.

## Current state
- `frontend/src/utils/jalali.ts` exports `JALALI_WEEKDAY_LABELS` as English short names (`['Sun','Mon','Tue',…]`).
- `DatePickerPopover.vue` anchor builds the Jalali label as `"{weekday} {jd} {month} {jy}"`, e.g. `"Shanbe 15 Far 1403"`.
- `App.vue` builds `dayHeaderInfo.dayName` via `d.toLocaleDateString('en-US', { weekday: 'long' })` (English long) and passes it to `DayView`.
- `WeekView.vue` builds per-day `name` via `d.toLocaleDateString('en-US', { weekday: 'short' })` and passes it to `DayColumn` as `dayName`.
- `JalaliDatePicker.vue` uses `JALALI_WEEKDAY_LABELS` for the grid column headers.
- Two spec files reference weekday strings: `JalaliDatePicker.spec.ts`, `DatePickerPopover.spec.ts`.

## What needs to change
Both calendar modes change their date-display format in the day title; Gregorian is not left untouched.

1. **`frontend/src/utils/jalali.ts`**
   - Replace `JALALI_WEEKDAY_LABELS` (short) with the following 7 entries, **indexed by `Date#getDay()` (0=Sun … 6=Sat)**:
     `[0]` Sun → `'1 Shan'`, `[1]` Mon → `'2 Shan'`, `[2]` Tue → `'3 Shan'`, `[3]` Wed → `'4 Shan'`, `[4]` Thu → `'5 Shan'`, `[5]` Fri → `'Jomeh'`, `[6]` Sat → `'Shan'`.
   - Add `JALALI_WEEKDAY_LABELS_LONG: readonly string[]` with the same indexing: `[0]` `'1 Shanbe'`, `[1]` `'2 Shanbe'`, `[2]` `'3 Shanbe'`, `[3]` `'4 Shanbe'`, `[4]` `'5 Shanbe'`, `[5]` `'Jomeh'`, `[6]` `'Shanbe'`.

2. **`frontend/src/components/common/DatePickerPopover.vue`** (`anchorLabel` computed) — **both calendars change format**
   - Gregorian (was `"Monday, March 4, 2024"`): change to strict `YYYY-MM-DD (EnglishShortWeekday)`, e.g. `"2024-03-04 (Mon)"`. Using `toLocaleDateString('en-US', { weekday: 'short' })`.
   - Jalali (was `"Shanbe 15 Far 1403"`): change to `jy-MM-dd (LongPersianWeekday)` using `JALALI_WEEKDAY_LABELS_LONG[d.getDay()]` (Gregorian `getDay()` index), e.g. Fri 2024-03-15 → `"1403-06-25 (Jomeh)"`.

3. **`frontend/src/components/common/JalaliDatePicker.vue`** (`WEEKDAY_HEADERS` computed)
   - No change — `JALALI_WEEKDAY_LABELS` now contains the short numeric labels and is already the source for grid headers.

4. **`frontend/src/App.vue`** (`dayHeaderInfo` computed)
   - Drop the English long weekday. The title is now `yyyy-MM-dd (dayOfWeek)` formatted by the new `formatDayTitle(value, calendar)` helper in `utils/date.ts` (see #6).
   - Stop emitting `dayName`. Keep emitting `dayNum`, `dayNumJalali`, `monthLabelJalali` for the rest of `DayView`.

5. **`frontend/src/components/DayView/DayView.vue`**
   - Remove `dayName` prop. Render the new title using a new prop `title: string` (already formatted by `App.vue`).

6. **`frontend/src/utils/date.ts`**
   - Add `export function formatDayTitle(value: string, calendar: Calendar): string` that returns:
     - Gregorian: `YYYY-MM-DD (English short weekday)`
     - Jalali: `jy-MM-dd (JALALI_WEEKDAY_LABELS_LONG[getDay()])` where `getDay()` is the Gregorian `Date#getDay()` of the same instant.

7. **`frontend/src/utils/date.ts` (`formatWeekDisplay`)**
   - Pad start/end days with `String(...).padStart(2, '0')` for both Gregorian and Jalali branches.

8. **Tests** — update or add unit coverage:
   - `frontend/src/utils/date.test.ts`: add `formatDayTitle` cases (Greg + Jalali).
   - `frontend/src/utils/jalali.test.ts` (if exists; otherwise add): assert new label arrays.
   - `frontend/src/components/common/JalaliDatePicker.spec.ts`: update grid-header expectations to `1 Shan … 7 Shan`.
   - `frontend/src/components/common/DatePickerPopover.spec.ts`: update anchor-label expectations to `YYYY-MM-DD (…Long…)` form.
   - `frontend/src/components/DayView` specs and `CalendarToggle.integration.spec.ts`: update any `dayName` expectations.

8. **All call sites of `JALALI_WEEKDAY_LABELS`** must still type-check (the constant's type stays `readonly string[]`).

## Out of scope
- Changing Gregorian weekday language (stays English).
- Changing month labels (`Far`, `Ord`, … stay as-is).
- Changing the Jalali month-grid internals in `JalaliDatePicker.vue`.
- `formatWeekDisplay` output — updated to zero-padded days (`Far 01-07, 1403`, `Mar 04-10, 2024`).
- The Jalali month label `monthLabelJalali` — still computed and passed to `DayColumn`, still unused in the header (no behavior change).

## Acceptance criteria
- With `calendar === 'gregorian'`, the day-view title reads exactly `2024-03-04 (Mon)`-style.
- With `calendar === 'jalali'`, weekday Friday reads `(Jomeh)` and Saturday reads `(Shanbe)`; Sun–Thu read as `1 Shanbe … 5 Shanbe` — e.g. Fri 2024-03-15 → `"1403-06-25 (Jomeh)"`.
- Week-column header in Jalali mode shows the short labels `1 Shan … 7 Shan` instead of English.
- `JalaliDatePicker` grid headers show the same short labels.
- Week navigation format updated: Jalali `Far 01-07, 1403`; Gregorian `Mar 04-10, 2024`.
- All updated/new unit tests pass; `pnpm test` (or the project's test script) is green.
- Week navigation format updated to two-digit day pairs: `Far 01-07, 1403`; Gregorian `Mar 04-10, 2024`. Both calendars.
- `pnpm build` is green; no `any` introduced.
- Gregorian title format also changes from the old long-form (`"Monday, March 4, 2024"`) to the new strict `YYYY-MM-DD (Mon)` form.
