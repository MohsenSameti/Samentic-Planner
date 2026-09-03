# Spec: Design spacing scale

## Goal
Introduce a documented, tokenized spacing scale so every `padding`, `margin`, and `gap` in the project references the same set of values. Today the codebase uses a 2-px base with off-grid steps (2, 6, 10 px) that are inconsistent with Material Design 3 and Apple HIG conventions, and the values are hard-coded in every component. This task locks the scale in so it can be enforced at CI time.

## Current state
- `frontend/src/style.css` defines color, font, and shadow tokens but no spacing tokens.
- Spacing literals appear directly in scoped CSS in `App.vue`, `components/`, and `modals/` — about 200 occurrences total.
- The value set actually in use is `{0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32}` px. Everything is a multiple of 2, but 2/6/10 are off-grid for both Material (4 dp) and Apple (4 pt / 8 pt).
- Two breakpoints encode the same "compact layout" intent inconsistently: `max-width: 768px` (5 files) and `max-width: 767px` (1 file, `DayView/DayView.vue`).
- `style.css` defines `.btn { padding: 10px 20px; }` with no mobile override, while every other component tightens at ≤768.
- `style.spec.ts` already establishes the pattern of source-level backstop tests (e.g. the `var(--text)` ban) that this work extends.

## What needs to change
- **Add a spacing scale to `:root` in `style.css`.** Numeric M3-style names: `--space-0` (0) through `--space-12` (48 px), in 4-px increments. Also `--bp-md: 768px` as the single canonical mobile breakpoint.
- **Round the off-grid values in the same pass** so the codebase lands on the new scale rather than carrying the old values forward:
  - `TaskCard.vue`: `padding: 10px 12px` → `padding: 8px 12px`; `margin-top: 2px` (3 occurrences) → `margin-top: 4px`.
  - `JalaliDatePicker.vue`: `gap: 2px` (2) → `gap: 4px`; `padding: 4px 6px` (2) → `padding: 4px 8px`.
  - `style.css` `.btn`: `padding: 10px 20px` → either `padding: 8px 16px` (if we adopt the mobile override at the same time, see below) or kept at `10/20` until step 6 lands.
- **Fix the `.btn` mobile override** in `style.css`: add `@media (max-width: 768px) { .btn { padding: 8px 16px; } }` so primary buttons participate in the same shrink-at-768 pattern as the today-button in `Header.vue`.
- **Standardize the mobile breakpoint.** Change `max-width: 767px` to `max-width: 768px` in `DayView/DayView.vue`. The 768 value also gets a `--bp-md` token so future contributors don't reinvent it.
- **Tokenize the existing spacing literals.** Replace every `padding: Npx`, `margin[-position]: Npx`, and `gap: Npx` literal in component scoped styles with `var(--space-N)` references. Roughly 200 replacements across `App.vue`, `components/`, and `modals/`. The mapping from current px to token is straightforward: `0→0, 4→1, 8→2, 12→3, 16→4, 20→5, 24→6, 32→8, 40→10, 48→12`. 2/6/10 px values are eliminated by the rounding step above; 0 stays.
- **Add a source-level lint in `style.spec.ts`** that fails if any `padding`, `margin[-position]`, or `gap` declaration in `frontend/src/components/`, `modals/`, or `App.vue` contains a raw `Npx` value. The existing `var(--text)` backstop is the template; this is the new sibling test.
- **Document the decision in `docs/SPEC.md`:** add a "Spacing" subsection under **Design Language** and a one-line update to the **Responsive Design** paragraph recording that the mobile breakpoint is 768 px and that desktop padding shrinks by one step per axis at that size.

## Out of scope
- Converting px to rem. The project has no documented base font size and a rem conversion would change every value across the codebase. Save for a separate, dedicated refactor.
- Adding a separate mobile token set (`--space-mobile-3` etc.). Mobile shrinkage stays as a media-query halving; we do not duplicate the scale.
- Extending the scale beyond 48 px. The project never uses more than 32 px today; larger values land only if a hero / marketing page appears.
- Adding a utility-class system (Tailwind, etc.). The project uses scoped CSS with a clean token layer; introducing utilities would multiply the surface area for no gain.
- Touching spacing values that are not on the 4-px grid for *semantic* reasons (e.g. icon nudges, focus-ring offsets). These are `1px` borders, `2px` outline-offsets, etc. — handled by the existing token set or by leaving the literal as-is, and explicitly out of the lint's scope.

## Acceptance criteria
- `frontend/src/style.css` declares `--space-0` through `--space-12` (with the values 0, 4, 8, 12, 16, 20, 24, 32, 40, 48 px) and `--bp-md: 768px` in `:root`.
- No `padding`, `margin[-position]`, or `gap` declaration in `App.vue`, `components/`, or `modals/` contains a raw `Npx` value; every such declaration uses a `var(--space-N)` reference.
- The off-grid `2`, `6`, and `10` px values from `TaskCard.vue` and `JalaliDatePicker.vue` are gone; their visual equivalents are `4`, `8`, and `8`/`12` respectively.
- `DayView/DayView.vue` uses `max-width: 768px` (not `767`).
- `style.css` adds a `@media (max-width: 768px) { .btn { padding: 8px 16px; } }` rule.
- `style.spec.ts` contains a new backstop test (named e.g. `'source-wide: spacing declarations use --space-* tokens'`) that greps every `*.vue` file under `frontend/src/components/`, `frontend/src/modals/`, and `frontend/src/App.vue`, extracts every `padding`, `margin`, `margin-<side>`, and `gap` declaration, and fails if any of them contain a raw `\d+px` literal. The test must pass with the post-refactor codebase and fail if a future contributor adds e.g. `padding: 13px` to any component. Border-radius, font-size, width, height, and other non-spacing properties are explicitly excluded from the check.
- `docs/SPEC.md` has a "Spacing" subsection under **Design Language** describing the 4-px base, the `--space-*` token names, the `--bp-md: 768px` breakpoint, and the rule that component styles must reference tokens rather than literals.
- `pnpm test` and `pnpm build` both pass with the new tokens, the rounded values, the lint, and the spec change, with no `.skip` / `.only` left behind.
