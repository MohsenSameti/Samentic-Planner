# Spec: Implement dark theme

## Goal
Add a dark theme to the app so users can switch between Light, Dark, and System (follow OS). The dark palette must cover every surface the light palette covers, with no per-component one-off colors leaking in. The user picks the theme from a new control in `SettingsSection`; the choice persists in `localStorage` and is read before Vue mounts so there is no flash of the wrong theme on load.

## Current state
- `frontend/src/style.css` declares the design tokens as CSS custom properties on `:root`: `--bg`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--accent`, `--accent-light`, `--success`, `--muted`, plus the three font variables.
- Most components consume the tokens via `var(--…)` (good — they re-skin for free). A few components hard-code colors that need to become tokens:
  - `frontend/src/components/Header.vue` hard-codes `#b84700` (today-btn hover) and `rgba(0,0,0,0.12)` (settings-menu shadow).
  - `frontend/src/components/WeekView/TaskCard.vue` likely uses a raw grey for the project dot / hover.
  - `frontend/src/style.css` `.btn-primary:hover` uses `#B84700`; `.btn-danger` / `.btn-danger:hover` use `#E74C3C` / `#C0392B`; `.accent-light` is consumed by `::selection` and accent backgrounds.
- The header has no theme toggle. `SettingsSection.vue` exposes only `weekStart` and `calendar`.
- `frontend/src/main.ts` mounts the app with no theme bootstrapping. `localStorage` is not used anywhere in the frontend.
- A handful of inline `style="background: #…"` attributes may exist (e.g. on `TaskCard` for the project color dot). Those are project-specific accent colors and stay as inline styles — the project *color* picker still owns those.

### Late-discovered dark-mode regressions (added during the spec's in-progress work)

While shipping the dark theme, two regressions surfaced that the original
"hard-coded color cleanup" pass missed:

- **Header / Modal / ErrorBoundary icons render black in dark mode.**
  Five rules use `color: var(--text)` — a token that does not exist
  (only `--text-primary` and `--text-secondary` are defined). The
  property is invalid at computed-value time and the affected elements
  fall back to the browser UA `buttontext` color. With
  `color-scheme: light dark` on `:root` the *page* theme adapts, but
  some browsers still resolve the UA `buttontext` to a light-theme
  color even when the page is dark. Affected rules:
  - `Header.vue` `.logout-btn`, `.settings-btn`, `.sidebar-toggle`
  - `Modal.vue` `.modal-close:hover`
  - `ErrorBoundary.vue` `.error-content h3`
- **Placeholder text in every form input is too dim in dark mode.**
  No `::placeholder` rule exists in `style.css`, so every input /
  textarea / select falls back to the browser default
  (`#757575`-ish), which is barely visible against a dark surface.
  Affected inputs: day / week / task notes textareas, the property
  value `placeholder="0"` in the day columns, and every modal input
  (Task / Project / Property / Move).
- **Modal form inputs don't set `color`.** `TaskModal`, `ProjectModal`,
  `PropertyModal`, and `MoveModal` style their `background: var(--surface)`
  but never set `color`. They inherit body color today, which is
  `var(--text-primary)` and works, but the setup is fragile — any
  future wrapping element that sets `color` will silently change the
  input text color.
- **Native `<input type="date">` doesn't declare `color-scheme` on
  itself.** The page-level `color-scheme: light dark` covers most
  cases, but Safari and a few Chromium builds still render the
  built-in calendar icon in a light theme inside a dark page. Affected:
  `TaskModal`, `MoveModal`, and `DatePickerPopover` (the Gregorian
  `<input type="date">` path).

## What needs to change

### 1. Token system (`frontend/src/style.css`)
Add the missing tokens to the `:root` block, and define a parallel override under `:root[data-theme="dark"]` (attribute on `<html>`, set before Vue mounts):

- `--shadow-sm`, `--shadow-md` (so box-shadows track the theme instead of `rgba(0,0,0,0.12)` everywhere).
- `--hover-bg` (for icon-button hover backgrounds that currently use `var(--bg)` — in dark mode that needs to be a slightly raised tone, not the page background).
- `--danger`, `--danger-hover` (replace the hard-coded `#E74C3C` / `#C0392B`).
- `--accent-hover` (replace hard-coded `#B84700` / `#b84700`).
- Keep `--accent` the same burnt orange in both themes — it stays the brand accent.
- `--accent-light` becomes a translucent version of the accent (e.g. `rgba(211, 84, 0, 0.12)`) so it reads correctly in both themes; `::selection` continues to use it.

Dark palette values (warm-leaning, not pure black, to match the "well-worn leather" feel of the rest of the app):
- `--bg: #1A1816` (deep warm charcoal)
- `--surface: #221F1C` (raised surface)
- `--border: #3A3530` (subtle border)
- `--text-primary: #F1ECE5` (warm off-white)
- `--text-secondary: #A8A19A` (muted warm grey)
- `--accent: #E96A1A` (slightly brighter orange for contrast on dark)
- `--accent-hover: #FF7A2A`
- `--accent-light: rgba(233, 106, 26, 0.16)`
- `--success: #4FCB7E` (lighter green for contrast)
- `--muted: #6B6560`
- `--danger: #E96A5A`
- `--danger-hover: #FF7A6A`
- `--hover-bg: #2C2825` (raised hover)
- `--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4)`
- `--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5)`

Also set `color-scheme: light dark` on `:root` so native form controls (date picker, scrollbars) follow.

### 2. `prefers-color-scheme` default
When the user's choice is `system` (or no choice has been made yet), the resolved theme tracks the OS via the standard `@media (prefers-color-scheme: dark)` block. The `:root[data-theme="dark"]` override is independent of this and always wins when the attribute is set, so manual picks take precedence.

### 3. New `useTheme` composable (`frontend/src/composables/useTheme.ts`)
Owns the theme state and persistence:
- Reads `localStorage.getItem('theme')` and validates it against the `Theme` literal union (`'light' | 'dark' | 'system'`). Invalid/missing values default to `'system'`.
- Exposes a `theme` ref (the user's *choice*) and a `resolvedTheme` ref (the *actual* applied theme, `'light' | 'dark'`).
- Watches `matchMedia('(prefers-color-scheme: dark)')` when `theme === 'system'` and updates `resolvedTheme`.
- `applyTheme()` writes `document.documentElement.setAttribute('data-theme', resolvedTheme.value)`. Called once on init and whenever either ref changes.
- Exposes `setTheme(t: Theme)` which validates, writes to `localStorage`, and updates the refs.
- Exposes a synchronous `initTheme()` that runs **before** `createApp(...).mount()` so the attribute is on `<html>` before first paint.

A pure helper `resolveTheme(choice: Theme, systemPrefersDark: boolean): 'light' | 'dark'` lives in the same file (or a `theme.ts` util) and is unit-tested in isolation.

### 4. Bootstrap (`frontend/src/main.ts`)
Call `initTheme()` from `useTheme` **before** `createApp(...).mount('#app')` so the `<html data-theme="…">` attribute is present on first paint. Importing the composable is fine; it has no Vue lifecycle dependency for `initTheme`.

### 5. `SettingsSection` UI (`frontend/src/components/Sidebar/SettingsSection.vue`)
Add a third row: a `<select>` for `Theme` with options `Light` / `Dark` / `System`. The component:
- Accepts a new `theme: Theme` prop.
- Emits a new `change-theme` event with a validated `Theme` value (same controlled-`<select>` pattern as the other two settings).
- Renders above the `Start of week` row (theme is the most-touched setting).

`Sidebar.vue` passes `theme` down and re-emits `change-theme` up to `App.vue`.

`App.vue`:
- Imports `useTheme`.
- Passes the `theme` choice down to `Sidebar` and `SettingsSection` (the existing `weekStart` / `calendar` plumbing is the template).
- Wires `setTheme` to the `change-theme` event.

### 6. Component cleanup
Replace the hard-coded color references identified in the Current state with the new tokens:
- `Header.vue`: `background: #b84700` → `var(--accent-hover)`; `box-shadow: 0 4px 12px rgba(0,0,0,0.12)` → `var(--shadow-md)`.
- `style.css`: `.btn-primary:hover` `background: #B84700` → `var(--accent-hover)`; `.btn-danger` and `.btn-danger:hover` → `var(--danger)` / `var(--danger-hover)`.
- `TaskCard.vue` / any other file with a hard-coded hover background that should track the theme → `var(--hover-bg)`.
- `Sidebar.vue` `box-shadow: 4px 0 20px rgba(0,0,0,0.15)` → `var(--shadow-md)`.

A grep at the end of the task should find no `rgba(0, 0, 0, ...)` or hard-coded `#…` colour values in `.vue`/`.css` files except for inline project-color dots and font fallbacks.

### 6.1 Dark-mode regression fixes (added during in-progress work)

Fix the regressions called out in the **Late-discovered dark-mode
regressions** section above. These are not net-new features; they are
the same component-cleanup pass the spec already describes, applied to
a class of token-usage bug that the original audit missed.

- **`style.css` token block (`:root` and `:root[data-theme="dark"]`)**:
  - Add a `--text` alias that points to `--text-primary` in both
    themes. Centralising the alias means any future component that
    writes `var(--text)` (intentionally or by mistake) resolves to the
    right value in both themes.
  - Add a new `--placeholder` token. Light value: a softened
    `--text-secondary`; dark value: a slightly-lighter
    `--text-secondary` so it stays readable but still reads as
    "placeholder". Exact values: light `#A8A19A`-ish (use
    `--text-secondary`), dark `#BAB3AC`-ish (a half-step lighter than
    the dark `--text-secondary` so it pops against the dark surface).
- **`style.css` global selectors**:
  - Add a single global `::placeholder` rule that sets
    `color: var(--placeholder); opacity: 1;` so Firefox's default
    0.54 doesn't stack and dim it further.
  - Add `color-scheme: light dark;` to the existing
    `input, select, textarea { ... }` block so every form control in
    the app declares it supports both schemes (it does — the browser
    is free to render the native date-picker icon in the dark variant
    when the page is dark).
- **`Header.vue`, `Modal.vue`, `ErrorBoundary.vue`**: replace every
  `var(--text)` with `var(--text-primary)`. Even though the new
  `--text` alias would also resolve correctly, using
  `var(--text-primary)` matches the convention used by every other
  rule in the same file and keeps the diff consistent.
- **Modal form inputs** (`TaskModal.vue`, `ProjectModal.vue`,
  `PropertyModal.vue`, `MoveModal.vue`, `ChangePasswordModal.vue`):
  add an explicit `color: var(--text-primary)` to the
  `form-group input, textarea, select` (and the `form-input` class in
  ChangePasswordModal) so the input text is always
  `var(--text-primary)` regardless of what a future wrapping element
  does to `color`. `LoginPage` and `SetupWizard` already set
  `color: var(--text-primary)` on `.field-input` — leave them alone.
- **Native date inputs** (`TaskModal.vue`, `MoveModal.vue`,
  `DatePickerPopover.vue`): add `color-scheme: light dark;` to the
  input style so the built-in calendar icon adapts even on browsers
  that don't pick it up from the page-level declaration.

A grep at the end of the task should find no `var(--text)` references
anywhere in `frontend/src/**/*.{vue,css}`, exactly one `::placeholder`
rule (the new global one in `style.css`), and no
`color: #…` outside the `ProjectModal` color palette and the
default-project seed in `App.vue` (`#E74C3C`).

### 7. Tests (TDD per `docs/TESTING.md`)

- `frontend/src/composables/useTheme.test.ts`:
  - `initTheme` reads `localStorage` and validates the value; invalid/missing → `'system'`.
  - `setTheme` writes to `localStorage` and updates the `theme` ref.
  - `resolvedTheme` follows the OS preference when `theme === 'system'` (stub `matchMedia`).
  - `applyTheme` sets `documentElement.dataset.theme` (or `setAttribute`).
  - `resolveTheme(choice, systemPrefersDark)` returns the correct `'light' | 'dark'` for all six combinations.
- `frontend/src/components/Sidebar/SettingsSection.spec.ts` (new or extended):
  - Renders three rows including the theme select.
  - Emits `change-theme` with the validated value on change.
  - Invalid values from a hand-edited DOM are dropped (silent ignore).
- `frontend/src/components/Sidebar/SettingsSection.spec.ts` integration with `useTheme`: re-emit flow `SettingsSection` → `Sidebar` → `App` (skip if existing patterns make this redundant — note in the plan).
- `frontend/src/main.ts` test (or a thin wrapper): `initTheme()` is called before mount, attribute is set on `<html>`.
- Update any existing `Header.spec.ts` / `Sidebar` / `App` snapshot tests if they assert the old `#b84700` / hard-coded `rgba`.
- **Regression coverage for the late-discovered dark-mode bugs**:
  - `frontend/src/components/Header.spec.ts` (extend): the logout,
    settings, and sidebar-toggle buttons have a computed `color` that
    resolves to the dark-mode `--text-primary` (`#F1ECE5`) when
    `data-theme="dark"` is on `<html>`, not the browser UA fallback.
    Drive via `mount` + setting the attribute on
    `document.documentElement` before the assertion.
  - New `frontend/src/style.spec.ts` (or extend the existing test
    file, whichever is more conventional — check `frontend/src/test/`
    first): the resolved `getComputedStyle` of `::placeholder` on a
    plain `<input>` returns the new `--placeholder` value, and that
    value differs in light vs dark mode.
  - `frontend/src/modals/TaskModal.spec.ts` (extend): the `<input>`
    and `<textarea>` inside the modal have an explicit
    `color: var(--text-primary)` rule that resolves in both themes.

### 8. Project-color (per-task) colors stay inline
Inline `style="background: #…"` on the project dot in `TaskCard.vue` is a user-chosen project color, not a theme color. Leave these untouched — they should remain readable on both backgrounds because the project-color picker already constrains the palette to readable values.

## Out of scope
- Persisting the theme per-user on the backend. Display preference stays in `localStorage`.
- Custom user-picked accent colors / theming. The accent stays burnt orange in both themes.
- High-contrast / sepia / other alternative themes.
- Re-skinning any third-party widget that ships its own dark mode (none currently in use).
- A separate mobile-only theme or per-component theme overrides.

## Acceptance criteria
- A new "Theme" select appears in `SettingsSection` with options Light / Dark / System, defaulting to System.
- Selecting Dark immediately applies the dark palette to every visible surface (header, sidebar, week grid, task cards, modals, settings menu, notes) with no per-component hard-coded color leaking through.
- Selecting Light / System restores / tracks the OS preference.
- The chosen theme survives a hard reload (no flash of light theme on a dark-mode user).
- `prefers-color-scheme: dark` users with `theme = "system"` get the dark palette on first load.
- **In dark mode, the header's logout / settings / sidebar-toggle
  icons (and the modal close icon, and the ErrorBoundary heading) are
  the same off-white as the rest of the page text — not black.** The
  five `var(--text)` references are gone; the rules use
  `var(--text-primary)`. (Regression-fix acceptance criterion added
  during in-progress work.)
- **In dark mode, every placeholder (day / week / task notes,
  property value `0`, task / project / property / move modal
  placeholders) is visible and reads as "placeholder" — not
  invisible, not mistaken for typed content.** A single global
  `::placeholder` rule using a new `--placeholder` token covers
  every input. (Regression-fix acceptance criterion added during
  in-progress work.)
- `pnpm test` is green; new `useTheme.test.ts` and updated `SettingsSection.spec.ts` cover the behavior in `docs/TESTING.md` style.
- `pnpm build` is green; no `any` introduced.
- UI checked at mobile (≤768px), tablet (≤1024px), and desktop — the sidebar, header, and modals all read correctly in both themes.
- A grep for `rgba(0,\s*0,\s*0` and bare hex colors in `frontend/src/**/*.{vue,css}` returns no hits outside of project-color dots and font fallbacks.
- A grep for `var(--text)` returns no hits anywhere in `frontend/src/**/*.{vue,css}`.
- A grep for `::placeholder` returns exactly one hit (the new global rule in `style.css`).
