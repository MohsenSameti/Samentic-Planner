# Spec: Redesign planner UI identity

## Goal
Replace the generic SaaS-template defaults (warm cream + burnt orange, ALL-CAPS labels, identical rounded cards, scattered hover motion, generic copy) with a deliberate, leather-planner-specific visual identity that feels substantial and ritual-oriented.

## Current state
The planner uses `#FAF9F7` / `#D35400` palette (`style.css`), ALL-CAPS sidebar section titles (`Sidebar.vue`), monospace data labels (`Sidebar.vue`, `WeekSummary.vue`), identical `border-radius: 6px` cards with `var(--shadow-sm)` (`TaskCard.vue`), scattered `will-change` hover hints (`style.css`), and functional/auth copy (`LoginPage.vue`, `App.vue`). Nothing evokes the "well-worn leather planner" concept from `docs/SPEC.md`.

## What needs to change
- Color tokens (`style.css`): replace cream/orange with leather/textile palette (`#3D3229` dark brown, `#F0EBE3` aged paper, `#1A1612` ink black, `#C5A065` aged gold accent). Update dark-mode counterparts.
- Typography (`style.css`, `Sidebar.vue`, `WeekSummary.vue`, `Header.vue`): remove ALL-CAPS (`text-transform: uppercase`) from sidebar sections, sum labels, stat labels. Remove monospace (`font-family: var(--font-mono)`) from data values. Make the "Planner" logo active (stamped/engraved visual). Set a clear type scale.
- Card design (`TaskCard.vue`, `Sidebar.vue`): vary card treatment by status through material change (not just foreground color). Cut decorative eyebrows above sections.
- Motion (`style.css`, `TaskCard.vue`): remove scattered `will-change` hints; orchestrate one deliberate entrance/reveal instead of per-card hover effects.
- Copy (`LoginPage.vue`, `App.vue`, `Header.vue`): use planner-ritual vocabulary (e.g., "Open planner", "Plan the week", "Today's focus") instead of generic auth/system language.
- Responsive layout (`App.vue`, `Sidebar.vue`): keep function, but adjust so mobile feels like opening a small book/card rather than shrinking a desktop table.

## Follow-up: Compact day navigation
- Replace the oversized, duplicated day date with one clickable date label and a small dropdown chevron in `DayView.vue` / `DatePickerPopover.vue`.
- Use the existing body font at 15–16px, medium weight. Show a short weekday, day and month in the selected calendar (e.g. `Wed, Sep 4` / `4 Sha, 14 Shahrivar`). Omit the year only when it matches the current year in that calendar; retain the full date in the accessible name and picker.
- In day navigation, use Jalali weekday abbreviations `Sha`, `1 Sha`, `2 Sha`, `3 Sha`, `4 Sha`, `5 Sha`, `Jom` (Saturday–Friday) when Jalali is selected. Keep Gregorian weekday labels, full accessible date labels and the calendar grid's existing labels unchanged.
- Keep previous/next arrows visually quiet, with at least 44px touch targets and visible keyboard focus. Preserve date picking, previous/next day, Today and return-to-week behavior.
- Keep the `Week` label on mobile. Use a compact two-row header on narrow screens, with no horizontal overflow; retain a centered navigation group on larger screens.
- Keep the existing palette, summary, task list, notes and properties unchanged. No new animation or decorative framing.

## Out of scope
- Backend API changes.
- Functional behavior changes (auth flow, drag/drop, calendar logic).
- Adding new features (new pages, new entities).
- Changing the component architecture (Vue files stay same structure).

## Acceptance criteria
- `style.css` contains the new palette tokens; no `#FAF9F7`, `#D35400`, `#B84700` remain in production styles.
- No `text-transform: uppercase` in any `.vue` production component (except calendar/date picker grids if needed for month names).
- `Sidebar.vue`, `WeekSummary.vue` no longer use `font-family: var(--font-mono)` for data labels.
- `TaskCard.vue` card styles vary materially by status; not just `text-decoration: line-through` + color swap.
- `style.css` has no scattered `will-change: transform` hints on cards/buttons; motion is reduced or orchestrated.
- `LoginPage.vue`, `App.vue` copy uses planner-ritual vocabulary.
- Day navigation renders exactly one date label, at 15–16px in the body font; the full date remains accessible and the selected calendar is respected.
- All seven Jalali day-navigation weekdays use the approved abbreviations, including after switching calendars; Gregorian navigation still uses `Sat`–`Fri`.
- Current-year labels omit the year; other-year labels include it, including around the Jalali new year. Labels update when the date/calendar changes or the current year rolls over.
- Previous/next/date-picker/back controls retain their behavior, visible focus and comfortable touch targets; `Week` stays visible on mobile.
- The navigation fits mobile/tablet/desktop without clipping the date or popover; the summary and day content are unchanged.
- `pnpm build` passes; `pnpm test` passes; mobile/tablet/desktop responsive verified.
