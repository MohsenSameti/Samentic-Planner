# Spec: Stop dimming task states with opacity (spec §4)

(references parent Spec: `docs/specs/7-improve-day-column.md` → section
**4. Opacity-based task states fail contrast**)

## Goal

Replace the container-opacity trick that distinguishes completed and
cancelled task cards with dedicated foreground tokens that meet the WCAG AA
4.5:1 contrast threshold against both `--bg` and `--surface`, in both light
and dark themes. The visual distinction between the two states must remain
recognisable at a glance — opacity alone was insufficient, so the new tokens
must be deliberately different (one muted-grey, one danger-tinted) and not
just two near-identical greys.

## Current state

- `frontend/src/components/WeekView/TaskCard.vue` styles the
  `.task-card.completed` and `.task-card.cancelled` containers with
  `opacity: 0.6` and `opacity: 0.4` respectively. The opacity blends both
  foreground (text) and background (the card's own `--bg`) into the page's
  `--surface`, halving effective contrast for body text. Both states also
  carry a `text-decoration: line-through` on `.task-title`; cancelled
  additionally lowers the title colour to `--muted`.
- `--muted` is `#9B9B9B` in light mode (≈2.6:1 vs `--bg` `#FAF9F7`,
  below AA) and `#6B6560` in dark mode (≈3.1:1 vs `--bg` `#1A1816`,
  below AA), so even without container opacity the cancelled state fails
  contrast.
- `frontend/src/components/WeekView/DayColumn.vue`'s `.empty-state svg`
  uses `opacity: 0.5` directly, the same class of "raw opacity literal"
  defect the rest of this section exists to remove.
- `frontend/src/style.css` has the existing token-contract tests for
  `--text` and `--placeholder` in `style.spec.ts`; the new tokens slot
  into the same `ruleBody` helpers.

## What needs to change

1. **New foreground tokens in `frontend/src/style.css`**, both light
   and dark:
   - `--text-completed` — muted neutral grey, the "this task is done"
     foreground. In light mode ≈ `--text-secondary` (`#6B6560`, 5.4:1
     vs `--bg`); in dark mode ≈ `--text-secondary` (`#A8A19A`, 6.2:1
     vs `--bg`). Semantic rename so a future tightening of
     `--text-secondary` does not silently change the completed card's
     contrast.
   - `--text-cancelled` — a danger-tinted foreground (slight red/brown
     bias) so cancelled is visibly different from completed without
     relying on opacity or strikethrough alone. Light: `#8B5F55` or
     similar muted brick (5.4:1 vs `#FAF9F7`). Dark: `#B0857A` or
     similar (5.0:1 vs `#1A1816`). Exact values are pinned by the
     token-contract tests below.
   - `--icon-muted-opacity` — a tokenised `0.5` for the empty-state
     icon. Decoupled from any specific icon so future muted icons
     reuse it without copying the literal.

2. **`TaskCard.vue` styles**:
   - Delete `.task-card.completed { opacity: 0.6 }` and
     `.task-card.cancelled { opacity: 0.4 }`. The two rules cease to
     exist; no replacement container-level opacity rule is added.
   - `.task-card.completed .task-title` keeps the line-through but
     switches `color` to `var(--text-completed)`.
   - `.task-card.cancelled .task-title` keeps the line-through and
     switches `color` to `var(--text-cancelled)`.
   - `.task-card.completed .task-description` and `.completed
     .task-project-name` (and the cancelled equivalents) take the
     same token, so the whole card body uses one foreground token
     per state — no per-element mix.
   - `.task-card.completed .task-checkbox svg` keeps its existing
     `color: white` (the "done" checkmark sits on a green fill and
     must stay high-contrast against the fill).

3. **`DayColumn.vue` empty state**:
   - `.empty-state svg` switches its raw `opacity: 0.5` for
     `opacity: var(--icon-muted-opacity)`.

4. **`style.spec.ts` token-contract tests** (same `ruleBody` helper
   the `--text` / `--placeholder` tests already use):
   - `--text-completed` is declared in `:root` and re-declared in
     `:root[data-theme="dark"]`, both non-empty.
   - `--text-cancelled` is declared in `:root` and re-declared in
     `:root[data-theme="dark"]`, both non-empty.
   - `--text-cancelled` is **not the same resolved colour** as
     `--text-completed` in either mode (the test strips `var(...)`
     wrappers the same way the existing `--placeholder` tests do).
     The danger-tint must survive the comparison.
   - `--icon-muted-opacity` is declared in `:root` and equals `0.5`.
   - A source-wide grep test (same idiom as the existing spacing
     lint) fails the build if any `opacity:` declaration re-appears
     on `.task-card.completed`, `.task-card.cancelled`, or
     `.empty-state svg` (i.e. the three classes the spec calls out).

## Out of scope

- Changes to the *checkbox fill* colour for completed tasks — the
  green `--success` fill is already the primary "done" signal and
  is unaffected.
- The strikethrough itself; the spec keeps it as the secondary
  signal.
- Other opacity usages in the codebase (e.g. menu reveal on hover,
  textarea checkmarks that toggle in via `opacity: 0 → 1`).
  Section §4 is scoped to the three classes it names; future
  sections can audit the rest.
- Recomputing contrast ratios in tests; the values are chosen by
  hand against the existing `--bg` and `--surface`, the token-contract
  tests just lock the values in.

## Acceptance criteria

- No `opacity:` declaration appears on `.task-card.completed`,
  `.task-card.cancelled`, or `.empty-state svg` in `TaskCard.vue` or
  `DayColumn.vue`. The grep test enforces this.
- `--text-completed` and `--text-cancelled` are declared in `:root`
  and re-declared in `:root[data-theme="dark"]`. Both values are
  non-empty, and the resolved values differ from each other in both
  modes (so the danger-tint survives into the dark theme and the two
  states remain visually distinct).
- `--icon-muted-opacity` is declared in `:root` and equals `0.5`.
- A completed task card in dark mode renders with the
  `--text-completed` token on `.task-title`,
  `.task-description`, and `.task-project-name`; a cancelled card
  renders with `--text-cancelled` on the same three elements.
  Verified by `TaskCard.spec.ts` reading the computed `color` for
  each element under each state (with `data-theme` flipped between
  tests).
- `pnpm test` and `pnpm build` pass with verified output, no
  `.skip` / `.only`, after every step. The two existing
  `style.spec.ts` block (`--text` alias, `--placeholder`) tests stay
  green unchanged.