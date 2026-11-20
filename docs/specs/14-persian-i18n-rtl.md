# Spec: Persian i18n and RTL

## Goal
Add English and Persian UI support, with Persian using right-to-left layout and Vazirmatn. Language choice is saved locally.

## Current state
The app is English-only, has a sidebar calendar setting and Jalali date support, and stores dates as Gregorian ISO values. The Jalali picker enforces a rigid 280px minimum width, uses a `repeat(7, 1fr)` grid that cannot shrink below its content minimum, and renders full-length Persian weekday names (e.g. "چهارشنبه"); embedded in the task and move modals, this overflows the modal borders on narrow mobile viewports, and the modals retain large horizontal padding on small screens.

## What needs to change
- Translate user-facing application UI into Persian, including forms, dialogs, navigation, settings, and app messages; retain English.
- Add a language selector to the sidebar and persist its choice in local storage. Default to English.
- Apply RTL for Persian and LTR for English, including responsive layouts; use Vazirmatn for Persian. Keep numerals Western (not Persian digits).
- In week navigation, DayView navigation, DayColumn drill-down, Jalali date picker navigation, and the header logout button, directional icons and chevrons align with RTL reading order (Previous, Back, and Logout point right, Next and Open point left in Persian); keep English chevrons and all navigation behaviors unchanged.
- In Jalali date picker, keyboard horizontal arrow navigation matches RTL layout (ArrowLeft advances to next day, ArrowRight moves to previous day).
- Flip task card status gradient directions and week view scroll edge-fade gradients in RTL so color fades originate from inline edges, and position task action popup menus relative to `inline-start`.
- Default the calendar to Gregorian in English and Jalali in Persian. Persist an explicit manual calendar choice locally; when no manual choice exists, apply the language default on load and language change, regardless of the backend’s seeded calendar. Preserve a manual choice across reloads and language changes.
- Translate common authentication errors into Persian, including invalid-password and incorrect-current-password responses.
- Translate DayView task-count summary labels (active, done, skipped, and cancelled) and audit DayView for other untranslated user-facing strings.
- Localize Gregorian month-boundary labels for Persian.
- Localize delete confirmation messages and default project names when seeding an empty board.
- Use Western numerals in Persian validation messages.
- Localize displayed dates, weekdays, and month names for the selected language and calendar, without changing stored Gregorian ISO dates or user-entered content.
- Fit the Jalali date picker entirely inside the task create/edit and move modals on mobile viewports (320px–768px): use compact Persian weekday headers in the month grid (`ش`, `ی`, `د`, `س`, `چ`, `پ`, `ج`) while retaining full weekday names for accessibility via columnheader `aria-label` or title; allow the calendar grid columns to shrink flexibly (`minmax(0, 1fr)`); remove the rigid 280px minimum width from the picker container so it adapts to its parent (`width: 100%`, `max-width: 100%`); and scale the Year, Month, and Day inputs and navigation chevrons responsively on small screens.
- Optimize modal horizontal padding for mobile viewports (`<= 768px`) so 320px–375px screens have adequate interior room without crowding borders.

## Out of scope
- Adding languages other than English and Persian.
- Translating user-created task, project, or note content.
- Changing the native Gregorian date input behavior.
- Altering desktop or tablet date picker functionality where space is already ample.
- Modifying date conversion logic or backend date storage.

## Acceptance criteria
- A user can switch English/Persian in the sidebar; the choice survives reload.
- English renders LTR with Gregorian dates by default; Persian renders RTL with Jalali dates by default.
- With no manual calendar choice, Persian opens with Jalali even when the backend setting is Gregorian; an explicit manual calendar selection survives reloads and language changes.
- Common authentication errors appear in Persian, Gregorian month-boundary labels are localized in Persian, validation strings contain no Persian digits, and DayView summary labels follow the selected language.
- The UI uses Vazirmatn in Persian and Western numerals in both languages.
- Directional navigation chevrons and icons in week navigation, DayView navigation, DayColumn drill-down, date pickers, and the header logout button point right for Previous/Back/Logout and left for Next/Open in Persian, and retain their English directions; all buttons still navigate correctly on mobile, tablet, and desktop.
- Jalali date picker arrow keys align with RTL visually: Left arrow advances one day, Right arrow regresses one day.
- Task card status gradients fade away from the inline start border, week view scroll edge fades align with RTL reading order, and task action popup menus position relative to inline start in both RTL and LTR.
- Both languages remain usable at mobile, tablet, and desktop widths.
- On mobile viewports (320px–768px), opening the task create/edit or move modal in Jalali/Persian mode displays the date picker fully contained within the modal borders with zero horizontal overflow.
- All 7 weekday headers are visible, aligned with their columns, and screen-reader accessible with full weekday names; Year, Month, and Day inputs and navigation chevrons remain functional and correctly aligned on mobile, while desktop and tablet presentations stay intact.
