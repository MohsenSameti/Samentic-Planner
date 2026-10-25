# Spec: Comprehensive UI and Accessibility Fixes

## Goal
Resolve the functional, data-integrity, keyboard-accessibility, sidebar-management, contrast, mobile-usability, and error-feedback issues identified in the browser UI audit. The audit findings are the motivation for this work; verify each against current behavior and preserve behavior that is already correct.

## Current state
The frontend has responsive day/week views, light/dark themes, modal dialogs, and existing project/property/task/note APIs. The current implementation already has some related behavior (for example, task-menu Escape/outside-click dismissal and modal edit/delete flows), but does not yet provide all the interactions and safeguards below. The relevant components and handlers are in `frontend/src`.

## What needs to change

### Section 1: Data protection and state integrity
- **Task 1.1 — Date-scoped Day View drafts** (`frontend/src/components/DayView/DayView.vue`, `frontend/src/components/Notes/DayNotes.vue`): Key the DayNotes component by its date so its local draft state is recreated when the displayed date changes. Ensure a blur/save action always writes to the date that owned that editor, never the newly displayed date. Do not add a redundant date watcher unless testing shows the keyed component is insufficient.
- **Task 1.2 — Modal Escape isolation** (`frontend/src/components/common/Modal.vue`, `frontend/src/App.vue`): When an open modal handles Escape, stop propagation so the window-level Day View shortcut does not also return to Week View.
- **Task 1.3 — Reset task creation drafts** (`frontend/src/modals/TaskModal.vue`): When the modal opens in create mode, initialize title and description as empty, including when reopening it on the same date. Preserve existing edit-mode initialization.

### Section 2: Sidebar management and project filtering
- **Task 2.1 — Project edit entry point** (`frontend/src/components/Sidebar/ProjectList.vue`, `frontend/src/components/Sidebar/Sidebar.vue`, `frontend/src/App.vue`): Provide an accessible edit/options button per project and emit/wire an edit event to the existing `openProjectModal(project)` handler. Existing modal edit, color, and delete behavior should be reused.
- **Task 2.2 — Property edit entry point** (`frontend/src/components/Sidebar/PropertiesSection.vue`, `frontend/src/components/Sidebar/Sidebar.vue`, `frontend/src/App.vue`): Provide an accessible edit button per custom property and wire it to the existing `openPropertyModal(property)` handler. Existing modal rename, unit, and delete behavior should be reused.
- **Task 2.3 — Property creation in empty state** (`frontend/src/components/Sidebar/Sidebar.vue`, `frontend/src/components/Sidebar/PropertiesSection.vue`): Keep the Custom Properties section and Add Property button visible when there are no properties. Show a concise empty-state message such as “No trackers yet.”
- **Task 2.4 — Active project filter and task defaults** (`frontend/src/App.vue`, `frontend/src/modals/TaskModal.vue`): When a project filter is active, show its name in a visible board-level indicator with an accessible Clear filter action. Use the selected project as the default for newly created tasks. Include a “No project” option, represented by the empty-string project ID supported by the current data model. Clearing the filter returns to “All Tasks.”

### Section 3: Keyboard accessibility and navigation
- **Task 3.1 — Keyboard-operable task action menu** (`frontend/src/components/WeekView/TaskCard.vue`): Use native buttons for menu items with `role="menuitem"`. Opening the menu places focus on its first available item; Up/Down navigate among items, Home/End move to the first/last item, and Escape closes the menu and restores focus to its trigger. Clicking outside closes it. Preserve the existing Escape propagation protection.
- **Task 3.2 — Task checkbox accessible name** (`frontend/src/components/WeekView/TaskCard.vue`): Give the custom checkbox a task-specific accessible name and a status-appropriate action label (for example, “Mark ‘Call Sam’ complete” or “Mark ‘Call Sam’ incomplete”).
- **Task 3.3 — Keyboard route to Day View** (`frontend/src/components/WeekView/DayColumn.vue`): Provide a dedicated, accessible Open day button in the day header so keyboard users can enter Day View without making a container with nested controls behave as one button. Enter and Space activate it.
- **Task 3.4 — Jalali picker commit and focus behavior** (`frontend/src/components/common/JalaliDatePicker.vue`, `frontend/src/components/common/DatePickerPopover.vue`): Arrow and month-navigation keys browse dates without emitting a committed update, changing the parent value, or closing the popover. Commit only on a day-cell click, Enter, or Space; the popover remains open while browsing and closes after commitment. Use roving tabindex with exactly one enabled date cell in the tab order, and prevent duplicate grid/cell key handling.
- **Task 3.5 — Modal focus management** (`frontend/src/components/common/Modal.vue`): Add `aria-modal="true"` to the active dialog. While open, keep Tab and Shift+Tab focus within it. On close, return focus to the element that opened it when that element still exists and is focusable. Ensure only the active dialog handles focus when dialogs are nested or overlapped.

### Section 4: Color contrast and theme consistency
- **Task 4.1 — Primary action contrast** (`frontend/src/style.css`): Ensure Today and primary-action button text achieves WCAG AA contrast of at least 4.5:1 against its rendered background. Ink-colored text on the existing gold accent is one acceptable approach. Verify computed foreground/background color pairs rather than relying on token names.
- **Task 4.2 — Completed/status task cards in dark mode** (`frontend/src/components/WeekView/TaskCard.vue`, `frontend/src/style.css`): Replace hardcoded light gradient starts in completed, skipped, and cancelled task cards with theme-aware colors. Verify that meaningful text on those card backgrounds has at least 4.5:1 contrast in dark mode and that status remains visually distinguishable.
- **Task 4.3 — Today orientation pill ref access** (`frontend/src/App.vue`): Read the exposed `currentDayLabel` according to Vue's component-instance ref unwrapping. Correct the template-ref TypeScript shape at the same time so it matches the value actually exposed by WeekView.
- **Task 4.4 — Current-week navigation emphasis** (`frontend/src/components/WeekNavigation.vue`, `frontend/src/App.vue`, `frontend/src/components/WeekView/WeekView.vue`): Remove the redundant Today orientation pill and its now-unused `currentDayLabel` plumbing. Emphasize the week-range text in bold when the displayed week contains today, and use normal weight for other weeks. Keep the Today button as the action for returning to the current week; do not shift the week-navigation chevrons when the emphasized state changes.

### Section 5: Mobile and touch ergonomics
- **Task 5.1 — Minimum 44×44px touch hit areas** (`frontend/src/components/WeekView/TaskCard.vue`, `frontend/src/components/Header.vue`, `frontend/src/style.css`): Ensure task checkbox, task-menu trigger, and header action controls have effective hit areas of at least 44×44 CSS pixels on touch-sized layouts. Hit-area expansion must not overlap adjacent controls in a way that makes them difficult to activate.
- **Task 5.2 — Empty-day details disclosure** (`frontend/src/components/WeekView/DayColumn.vue`): On mobile, show the day-details/notes disclosure even when a day has no properties and no note. It must have an accessible name, open the details section, and allow the user to collapse it again.
- **Task 5.3 — Narrow viewport layout** (`frontend/src/App.vue`, `frontend/src/components/Header.vue`, `frontend/src/style.css`): Replace fixed header-height subtraction (currently 73px) with a flex layout that can size to the rendered header and uses `min-height: 0` where needed for scrollable content. At 320px viewport width, header controls must wrap or consolidate without horizontal clipping. Preserve tablet and desktop behavior.

### Section 6: Load errors and autosave feedback
- **Task 6.1 — Initial board load error and retry** (`frontend/src/App.vue`): Track a failed `api.getState()` load and show a board-level “Could not load planner” message with a Retry button instead of an empty board. Retry must run the data load again despite the existing one-time `dataLoaded` guard. Keep the loading state visible during each attempt and return to the error state if a retry fails.
- **Task 6.2 — Note save status** (`frontend/src/components/Notes/DayNotes.vue`, `frontend/src/components/WeekView/TaskCard.vue`): For day-note and task-note blur saves, show a subtle inline status while a save is pending and a transient Saved status after success. On failure, show a clear failure status rather than claiming the note was saved. Do not let an older request's completion overwrite the status for a newer edit.

## Out of scope
- Backend schema alterations, new API endpoints, or database migrations; current endpoints and the empty-string project ID support these behaviors.
- Full visual re-theming or changing the serif/paper/ink aesthetic.
- Drag-and-drop support on touch/mobile devices.
- Changing the existing task status model or introducing a general-purpose notification system.

## Acceptance criteria
1. **Note date isolation:** In Day View, edit Wednesday's note, navigate to Thursday, and blur the editor. The Thursday note remains unchanged; a save initiated for Wednesday can only update Wednesday.
2. **Escape isolation:** Escape in an open modal in Day View closes the modal without leaving Day View.
3. **Task draft reset:** Save a newly created task, reopen Add Task on the same date, and verify title and description are empty. Edit mode still shows the selected task's values.
4. **Sidebar management:** Each project and property has an accessible edit control opening its corresponding existing modal. Delete remains available in edit mode. With no properties, the empty-state text and Add Property button are visible and the button opens the creation modal.
5. **Project filter:** Selecting a project shows the active filter name and a working Clear filter action. Creating a task while filtered defaults it to that project; “No project” saves an empty project ID.
6. **Keyboard menu and checkbox:** Task menu items are reachable and operable with the documented keys; Escape and outside click close the menu, and Escape returns focus to its trigger. The checkbox exposes a task-specific, status-appropriate accessible name.
7. **Day View keyboard access:** The dedicated Open day button is keyboard focusable and Enter/Space opens the corresponding date in Day View.
8. **Jalali picker:** Arrow/month browsing does not update the committed value or close the popover. Click, Enter, and Space commit once and close it. Only one enabled date cell is tabbable at a time.
9. **Modal accessibility:** The active dialog exposes `aria-modal="true"`; Tab and Shift+Tab stay within it; closing returns focus to its opener when possible.
10. **Contrast and current-week orientation:** Today/primary-action text and dark-mode task-card text meet the specified 4.5:1 contrast checks. The week-range text is bold when the displayed week contains today and normal when it does not. The redundant Today orientation pill is removed; the Today button remains available to return to the current week, and the navigation chevrons stay in stable positions.
11. **Touch and responsive layout:** At mobile sizes, specified controls have at least 44×44 CSS pixel hit areas; empty-day details open and collapse; at 320px there is no horizontal clipping from the header. Check mobile, tablet, and desktop layouts.
12. **Load retry and save feedback:** A rejected initial `getState()` renders the board error and Retry; a successful retry loads the board, while a failed retry leaves the error visible. Day-note and task-note saves display pending/success/failure status correctly, including when edits occur during an in-flight save.
13. **Verification:** `pnpm build` and `pnpm test` pass. Run `pnpm test:e2e:system` when a supported local Chromium executable is installed on `PATH`; otherwise run the documented `pnpm test:e2e` path in an environment with Playwright Chromium installed. Browser verification covers mobile, tablet, and desktop projects.
