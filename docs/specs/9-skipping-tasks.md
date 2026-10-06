# Spec: Skipped task status

## Goal
Add a fourth task status `skipped` so the user can mark a task as "not doing today" without removing it from the day. Skipped tasks stay visible (unlike `cancelled`, which is hidden) but are visually de-emphasized so the active list stays scannable. Skipped is intentionally distinct from cancelled: cancelled means "this isn't relevant" (terminal, hidden); skipped means "still on my list, just not today" (deferred, visible).

## Current state
- `Task.status` is `'active' | 'completed' | 'cancelled'` (`docs/SPEC.md:95`).
- `WeekView.vue:160-180` sorts tasks per day using a `statusBucket` function: `active(0) < completed(1) < cancelled(2)`, ties broken by `createdAt` then `id`.
- `DayView.vue` renders `tasksForDay` directly without sorting — order comes from the parent (`App.vue`).
- `DayView.vue:299-303` summary line: `N active · M done · K cancelled`.
- `WeekSummary.vue:31-36` tallies three counts (`completed`, `active`, `cancelled`) per visible week.
- `TaskCard.vue:296-344` kebab menu items (in order): Edit, Cancel, Restore, Delete. Only `cancelled` tasks hide Restore and show Cancel+Delete; active/completed show Edit+Cancel+Delete.
- `TaskCard.vue:53-54, 226, 233-235` already key off status: `.completed` / `.cancelled` CSS classes, `:draggable="task.status !== 'cancelled'"`, checkbox `:class="{ checked }"` and `aria-checked`.
- `Sidebar.vue:51-58` excludes `cancelled` from per-project counts; the comment says the count reflects "work that's actually pending."
- UI text: no i18n setup in repo; all strings (menu items, status labels) are hardcoded English consistent with the rest of the application.
- No data migration needed — extending a string union is additive.

## What needs to change
- **Shared types** (`frontend/src/types/index.ts` and the backend's `Task` type): widen `status` to `'active' | 'completed' | 'skipped' | 'cancelled'`.
- **`TaskCard.vue`**:
  - Add a `.skipped` CSS class with the agreed visual treatment: foreground token `--text-skipped` (light & dark mode AA contrast, card container opacity remains 1.0 per `no-state-opacity` accessibility rules), strike-through on the title, project name, and description. No new text label.
  - Checkbox: when `status === 'skipped'`, render the indeterminate visual state (a dash inside the box) and set `aria-checked="mixed"`. Clicking it on a skipped task transitions to `completed` (one click override, see Out of scope's interaction rules).
  - Drag stays enabled for skipped (only `cancelled` disables drag).
  - Kebab menu: add a new item labelled `Skip` (when status is `active` or `completed`) or `Unskip` (when `status === 'skipped'`), placed between Edit and Cancel/Restore. Invokes `actions.skipTask(task)` / `actions.unskipTask(task)` directly via `useDayActions`.
- **`WeekView.vue`**: extend `statusBucket` to `active(0) < completed(1) < skipped(2) < cancelled(3)`. No other change — `TaskCard` handles the visual.
- **`DayView.vue`**:
  - Sort `tasksForDay` by the same `statusBucket` order used in `WeekView` (extract to a small shared helper if convenient; otherwise duplicate the comparator). Currently `DayView` relies on parent ordering, which is undefined for the day view path.
  - Summary line: append `· N skipped` between `done` and `cancelled`.
- **`App.vue`**:
  - Provide `skipTask(task)` / `unskipTask(task)` from `useTasks()` via `provideDayActions` to handle `status: 'skipped'` / `status: 'active'` transitions directly.
  - Day-summary aggregation: include `skipped` in the per-day count passed to `DayView`.
- **`WeekSummary.vue`**: add a `skipped` tally alongside `completed`/`active`/`cancelled`. Render a fourth stat block only when the count is > 0 (keeps the row quiet for weeks with no skipped tasks).
- **`Sidebar.vue`**: **no change** — skipped tasks continue to count toward per-project totals (decision: a skipped task is still "on the project," not "not pending").
- **UI text**: add strings `Skip`, `Unskip`, `{count} skipped`, and `Skipped` in English matching existing components (no i18n catalog in repo).
- **Tests** (`*.spec.ts`, alongside components):
  - `TaskCard.spec.ts`: skipped visual class applied; checkbox shows indeterminate / `aria-checked="mixed"`; kebab menu shows Skip for active/completed and Unskip for skipped; skipping a completed task transitions to skipped; clicking the checkbox on a skipped task transitions to completed; skipped tasks are draggable.
  - `WeekView.spec.ts`: statusBucket ordering places skipped between completed and cancelled.
  - `DayView.spec.ts`: summary includes skipped count; tasks render in the agreed order.
  - `WeekSummary.spec.ts`: skipped tally is included; fourth stat block only renders when count > 0.
  - Existing tests stay green.

## Out of scope
- A dedicated skip button on the task row. Kebab menu only in v1; promote to a button only if usage data shows demand.
- A hide/show toggle for skipped tasks in the day column header. The muted styling + bottom-of-list position is the v1 noise control.
- Bulk skip from a multi-select.
- Keyboard shortcut for skip.
- Auto-cleanup of skipped tasks on past dates. Skipped is sticky, like completed and cancelled; the user manages state explicitly.
- Migration of existing data. Existing `active` / `completed` / `cancelled` rows stay as-is.
- A new backend endpoint. The existing task-update path accepts any value from the status union once the union is widened.
- Interaction rules for cross-state transitions beyond what's listed (see below). The minimum v1 behavior:
  - `active ↔ skipped` via the menu — one click each direction.
  - `completed ↔ skipped` via the appropriate control — one click each direction (skip and complete are mutually exclusive overrides).
  - `skipped → cancelled` and `cancelled → skipped` require going through `active` first (two clicks). Cancelled is treated as a terminal state; no single misclick should let a user accidentally hide a task they only meant to defer.

## Acceptance criteria
- A user can mark any `active` or `completed` task as skipped via the kebab menu's `Skip` item. The same item becomes `Unskip` on a skipped task and returns it to `active`.
- Skipped tasks render with: muted text color (`--text-skipped` AA contrast, card remains full opacity), strike-through title/description/project name, indeterminate checkbox (visual dash + `aria-checked="mixed"`).
- In both `DayView` and `WeekView`, the per-day task order is `active` → `completed` → `skipped` → `cancelled`, with ties broken by `createdAt` then `id` (same secondary key as today).
- The day summary line shows `N skipped` between `done` and `cancelled`.
- The week summary adds a fourth stat block for skipped, only when the visible week has at least one skipped task.
- Skipped tasks are draggable to another day (cancelled remains the only drag-disabled state).
- Cancelled tasks cannot be skipped directly; the menu hides `Skip` / `Unskip` on cancelled tasks.
- Skipped tasks count toward sidebar per-project totals (no `Sidebar.vue` change needed).
- All new strings use English labels (`Skip`, `Unskip`, `skipped`, `Skipped`) consistent with existing components.
- Works on mobile (≥360 px), tablet (768 px), and desktop (1280 px) per `AGENTS.md`: no horizontal page scroll, tap targets ≥ 36 px, menu still reachable on touch.
- `pnpm test` and `pnpm build` pass with the new tests; no `.skip` / `.only` left behind.
