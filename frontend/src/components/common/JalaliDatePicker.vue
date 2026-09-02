<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { fromLocalISODate, toLocalISODate } from '../../utils/date'
import {
  JALALI_MONTH_LABELS,
  JALALI_WEEKDAY_LABELS,
  fromJalaliYMD,
  isLeapJalali,
  jalaliMonthLength,
  toJalaliYMD,
  type JalaliYMD,
} from '../../utils/jalali'

/**
 * Self-contained Jalali month-grid picker. Emits a Gregorian ISO
 * date (`YYYY-MM-DD`) so the rest of the app never sees Jalali
 * components — only the picker itself produces them for output.
 *
 * Accessibility:
 *  - `role="application"` on the root so screen readers treat the
 *    keyboard grid as a widget rather than navigating page landmarks.
 *  - `role="grid"` on the calendar, `role="gridcell"` on each day.
 *  - `aria-label` on each cell (e.g. `"Far 1, 1403 (2024-03-20)"`).
 *  - Arrow keys move focus; `Enter` selects; `PageUp`/`PageDown`
 *    move by month; `Home`/`End` jump to start/end of the month.
 */

interface DayCell {
  /** Gregorian ISO date for this cell. Stable for `key` and storage. */
  gregIso: string
  /** Jalali day-of-month (1..31). */
  jd: number
  /** Whether this cell is in the view's month (vs. a spillover). */
  inMonth: boolean
  /** Whether this cell matches today (Gregorian). */
  isToday: boolean
  /** Whether this cell matches the currently-focused date. */
  isFocused: boolean
}

const props = defineProps<{
  /** Gregorian ISO date (`YYYY-MM-DD`). The canonical wire format. */
  value: string
  /** Optional minimum Gregorian ISO date (inclusive). */
  min?: string
  /** Optional maximum Gregorian ISO date (inclusive). */
  max?: string
}>()

const emit = defineEmits<{
  /**
   * Emitted with the new Gregorian ISO date whenever the user picks
   * a day or commits a valid year/month/day triple.
   */
  (e: 'update', value: string): void
}>()

/* ------------------------------------------------------------------ */
/* Internal view state                                                   */
/* ------------------------------------------------------------------ */

/** The Jalali month/year being viewed (not necessarily the value). */
const viewYear = ref<number>(1403)
const viewMonth = ref<number>(1)

/** Numeric input mirrors for keyboard entry. */
const inputYear = ref<string>('1403')
const inputMonth = ref<string>('1')
const inputDay = ref<string>('1')

/** The currently-focused cell, as a `Date` at local midnight.
 *  Kept as a `Date` so the keyboard handler can compare/iterate
 *  with `setDate`/`getDate` without juggling Jalali calendars. */
const focusedDate = ref<Date>(new Date())

/**
 * Initialise the view + inputs from `value`. Called on mount and
 * whenever `value` changes from outside the picker (so the picker
 * reflects the caller's intent).
 */
function syncFromValue(): void {
  const j = toJalaliYMD(props.value)
  viewYear.value = j.jy
  viewMonth.value = j.jm
  inputYear.value = String(j.jy)
  inputMonth.value = String(j.jm)
  inputDay.value = String(j.jd)
  focusedDate.value = fromLocalISODate(props.value)
}

watch(
  () => props.value,
  () => syncFromValue(),
  { immediate: true },
)

/* ------------------------------------------------------------------ */
/* Grid construction                                                     */
/* ------------------------------------------------------------------ */

/** Array of weekday labels for the column headers. */
const WEEKDAY_HEADERS = computed<string[]>(() => [...JALALI_WEEKDAY_LABELS])

/**
 * 7 columns × 6 rows of day cells for the current view month. Days
 * outside the view month render "dimmed" but are still clickable /
 * keyboard-reachable for cross-month navigation.
 */
const grid = computed<DayCell[]>(() => {
  const cells: DayCell[] = []
  const today = new Date().toDateString()
  // First cell: the Jalali day-of-week of the 1st of viewMonth.
  // Convert to Gregorian to align with Date#getDay (which is calendar-
  // agnostic at the day-of-week level).
  const firstGregIso = fromJalaliYMD(viewYear.value, viewMonth.value, 1)
  const firstDate = fromLocalISODate(firstGregIso)
  const firstWeekday = firstDate.getDay() // 0=Sun..6=Sat
  // Walk back to the Sunday of the first row.
  const gridStart = new Date(firstDate)
  gridStart.setDate(gridStart.getDate() - firstWeekday)

  // 6 rows × 7 columns = 42 cells covers every month (max 31 +
  // 6 days of pre-rollover = 37, so 42 leaves room for cross-month
  // overflow without an extra conditional).
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart)
    cellDate.setDate(cellDate.getDate() + i)
    const gregIso = toLocalISODate(cellDate)
    const j = toJalaliYMD(gregIso)
    cells.push({
      gregIso,
      jd: j.jd,
      inMonth: j.jy === viewYear.value && j.jm === viewMonth.value,
      isToday: cellDate.toDateString() === today,
      isFocused: cellDate.toDateString() === focusedDate.value.toDateString(),
    })
  }
  return cells
})

/* ------------------------------------------------------------------ */
/* Events                                                                */
/* ------------------------------------------------------------------ */

/** Pick a cell: emit the corresponding Gregorian ISO. */
function pickCell(cell: DayCell): void {
  emit('update', cell.gregIso)
  focusedDate.value = fromLocalISODate(cell.gregIso)
}

/** Move the view month by `delta` months (negative = previous). */
function shiftMonth(delta: number): void {
  let newYear = viewYear.value
  let newMonth = viewMonth.value + delta
  while (newMonth < 1) {
    newMonth += 12
    newYear -= 1
  }
  while (newMonth > 12) {
    newMonth -= 12
    newYear += 1
  }
  viewYear.value = newYear
  viewMonth.value = newMonth
  // Keep the input mirrors in sync so the user sees the navigated
  // month in the year/month/day fields.
  inputYear.value = String(newYear)
  inputMonth.value = String(newMonth)
}

/** Snap the view back to the month of the current `value` prop. */
function resetToValue(): void {
  syncFromValue()
}

/* ------------------------------------------------------------------ */
/* Keyboard navigation                                                   */
/* ------------------------------------------------------------------ */

/**
 * True when `gregIso` lies outside the optional `min`/`max` props.
 * Used to gate keyboard navigation so arrow / PageUp / Home keys
 * can't move focus (or emit an update) past the configured bounds.
 */
function isOutOfRange(gregIso: string): boolean {
  if (props.min && gregIso < props.min) return true
  if (props.max && gregIso > props.max) return true
  return false
}

/**
 * Move `focusedDate` by `days` calendar days, keeping it within the
 * same Jalali month where possible. If the step would cross the
 * month boundary, the view month advances/regresses with it.
 *
 * If the target date is out of range (per `min`/`max`), the focus
 * stays put — the keystroke is silently dropped. This matches the
 * click behaviour, where disabled cells don't pick.
 */
function focusShift(days: number): void {
  const next = new Date(focusedDate.value)
  next.setDate(next.getDate() + days)
  const iso = toLocalISODate(next)
  if (isOutOfRange(iso)) return
  focusedDate.value = next
  const j = toJalaliYMD(iso)
  if (j.jy !== viewYear.value || j.jm !== viewMonth.value) {
    viewYear.value = j.jy
    viewMonth.value = j.jm
    inputYear.value = String(j.jy)
    inputMonth.value = String(j.jm)
  }
  // Emit so the value follows the focus (Tab+Enter is one keystroke
  // shorter than focus-then-pick).
  emit('update', iso)
  // Move keyboard focus to the matching cell so the next arrow is
  // picked up by the `keydown` handler on that cell.
  nextTick(() => {
    const cell = document.querySelector<HTMLElement>(
      `[data-jalali-date="${iso}"]`,
    )
    cell?.focus()
  })
}

/** PageUp/PageDown: move by one month. Same out-of-range guard as
 *  `focusShift`. */
function focusShiftMonth(delta: number): void {
  const next = new Date(focusedDate.value)
  // Step by ~31 days so the calendar arithmetic doesn't depend on
  // month length — close enough to land in the right month for any
  // calendar month length.
  next.setDate(next.getDate() + 31 * delta)
  const iso = toLocalISODate(next)
  if (isOutOfRange(iso)) return
  focusedDate.value = next
  const j = toJalaliYMD(iso)
  viewYear.value = j.jy
  viewMonth.value = j.jm
  inputYear.value = String(j.jy)
  inputMonth.value = String(j.jm)
  emit('update', iso)
  nextTick(() => {
    const cell = document.querySelector<HTMLElement>(
      `[data-jalali-date="${iso}"]`,
    )
    cell?.focus()
  })
}

/** Home / End: jump to the start / end of the view month. */
function focusMonthEdge(edge: 'start' | 'end'): void {
  const day = edge === 'start' ? 1 : jalaliMonthLength(viewYear.value, viewMonth.value)
  const iso = fromJalaliYMD(viewYear.value, viewMonth.value, day)
  if (isOutOfRange(iso)) return
  focusedDate.value = fromLocalISODate(iso)
  emit('update', iso)
  nextTick(() => {
    const cell = document.querySelector<HTMLElement>(
      `[data-jalali-date="${iso}"]`,
    )
    cell?.focus()
  })
}

/**
 * Generic keyboard handler for the grid. Keys:
 *  - ArrowLeft / ArrowRight / ArrowUp / ArrowDown: move ±1 day, ±7 days
 *  - PageUp / PageDown: ±1 month
 *  - Home / End: start / end of view month
 *  - Enter: pick focused cell (already emitted on focus, but harmless)
 */
function onKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      focusShift(-1)
      break
    case 'ArrowRight':
      e.preventDefault()
      focusShift(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      focusShift(-7)
      break
    case 'ArrowDown':
      e.preventDefault()
      focusShift(7)
      break
    case 'PageUp':
      e.preventDefault()
      focusShiftMonth(-1)
      break
    case 'PageDown':
      e.preventDefault()
      focusShiftMonth(1)
      break
    case 'Home':
      e.preventDefault()
      focusMonthEdge('start')
      break
    case 'End':
      e.preventDefault()
      focusMonthEdge('end')
      break
    case 'Enter':
      // Already emitted on focus; prevent the default form submit.
      e.preventDefault()
      break
    default:
      break
  }
}

/* ------------------------------------------------------------------ */
/* Numeric input commit                                                  */
/* ------------------------------------------------------------------ */

/**
 * Parse the three numeric inputs into a valid Jalali date, clamping
 * out-of-range values. Emits the resulting Gregorian ISO. Called
 * on `blur` of each input.
 */
function commitInputs(): void {
  let y = parseInt(inputYear.value, 10)
  let m = parseInt(inputMonth.value, 10)
  let d = parseInt(inputDay.value, 10)
  if (!Number.isFinite(y)) y = 1403
  if (!Number.isFinite(m)) m = 1
  if (!Number.isFinite(d)) d = 1
  // Clamp year to the picker range (1..3000).
  if (y < 1) y = 1
  if (y > 3000) y = 3000
  // Clamp month into 1..12.
  if (m < 1) m = 1
  if (m > 12) m = 12
  // Clamp day to the month length.
  const monthLen = jalaliMonthLength(y, m)
  if (d < 1) d = 1
  if (d > monthLen) d = monthLen
  inputYear.value = String(y)
  inputMonth.value = String(m)
  inputDay.value = String(d)
  viewYear.value = y
  viewMonth.value = m
  const j: JalaliYMD = { jy: y, jm: m, jd: d }
  const iso = fromJalaliYMD(j.jy, j.jm, j.jd)
  focusedDate.value = fromLocalISODate(iso)
  emit('update', iso)
}

/* ------------------------------------------------------------------ */
/* aria-label helper                                                     */
/* ------------------------------------------------------------------ */

function ariaLabelFor(cell: DayCell): string {
  const j = toJalaliYMD(cell.gregIso)
  const monthLabel = JALALI_MONTH_LABELS[j.jm - 1] ?? ''
  return `${monthLabel} ${j.jd}, ${j.jy} (${cell.gregIso})`
}

/* ------------------------------------------------------------------ */
/* Min/max bounds (clicks + keyboard both consult the same guard)        */
/* ------------------------------------------------------------------ */

function isDisabled(cell: DayCell): boolean {
  return isOutOfRange(cell.gregIso)
}

/**
 * Compute the current view month label for the header button. E.g.
 * "Far 1403".
 */
const viewLabel = computed<string>(() => {
  const label = JALALI_MONTH_LABELS[viewMonth.value - 1] ?? ''
  return `${label} ${viewYear.value}`
})

/** True if the Jan 1 of the current view year is a leap year in
 *  Jalali. Currently used only to ensure the year field is correct
 *  after a leap-day navigation; displayed inline for transparency. */
const isLeapViewYear = computed<boolean>(() => isLeapJalali(viewYear.value))
</script>

<template>
  <div class="jalali-picker" role="application">
    <div class="picker-header">
      <button
        type="button"
        class="nav-btn"
        aria-label="Previous month"
        @click="shiftMonth(-1)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        class="view-label"
        :aria-label="`Current view: ${viewLabel}. Click to reset.`"
        @click="resetToValue"
      >
        {{ viewLabel }}
        <span v-if="isLeapViewYear" class="leap-badge" aria-hidden="true">leap</span>
      </button>
      <button
        type="button"
        class="nav-btn"
        aria-label="Next month"
        @click="shiftMonth(1)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>

    <div class="input-row">
      <label class="input-cell">
        <span class="input-label">Year</span>
        <input
          v-model="inputYear"
          type="number"
          min="1"
          max="3000"
          step="1"
          inputmode="numeric"
          class="num-input"
          aria-label="Jalali year"
          @blur="commitInputs"
          @keydown.enter.prevent="commitInputs"
        />
      </label>
      <label class="input-cell">
        <span class="input-label">Month</span>
        <input
          v-model="inputMonth"
          type="number"
          min="1"
          max="12"
          step="1"
          inputmode="numeric"
          class="num-input"
          aria-label="Jalali month"
          @blur="commitInputs"
          @keydown.enter.prevent="commitInputs"
        />
      </label>
      <label class="input-cell">
        <span class="input-label">Day</span>
        <input
          v-model="inputDay"
          type="number"
          min="1"
          :max="jalaliMonthLength(viewYear, viewMonth)"
          step="1"
          inputmode="numeric"
          class="num-input"
          aria-label="Jalali day"
          @blur="commitInputs"
          @keydown.enter.prevent="commitInputs"
        />
      </label>
    </div>

    <div
      class="grid"
      role="grid"
      :aria-label="`Jalali month ${viewLabel}`"
      @keydown="onKeydown"
    >
      <div class="weekday-row" role="row">
        <div
          v-for="(label, idx) in WEEKDAY_HEADERS"
          :key="idx"
          class="weekday"
          role="columnheader"
        >
          {{ label }}
        </div>
      </div>
      <div
        v-for="(cell, idx) in grid"
        :key="idx"
        class="day-cell"
        :class="{
          'out-of-month': !cell.inMonth,
          'today': cell.isToday,
          'focused': cell.isFocused,
          'disabled': isDisabled(cell),
        }"
        role="gridcell"
        tabindex="0"
        :aria-label="ariaLabelFor(cell)"
        :aria-selected="cell.isFocused"
        :data-jalali-date="cell.gregIso"
        @click="!isDisabled(cell) && pickCell(cell)"
        @keydown="onKeydown"
      >
        {{ cell.jd }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.jalali-picker {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font-family: inherit;
  color: var(--text-primary);
  min-width: 280px;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.view-label {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: var(--space-1) var(--space-2);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  text-align: center;
}

.view-label:hover {
  background: var(--bg);
}

.view-label:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.leap-badge {
  display: inline-block;
  margin-left: var(--space-2);
  font-size: 0.7rem;
  color: var(--accent);
  text-transform: uppercase;
  font-weight: 600;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  padding: 0;
}

.nav-btn:hover {
  background: var(--accent-light);
  border-color: var(--accent);
}

.nav-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.nav-btn svg {
  width: 14px;
  height: 14px;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-2);
}

.input-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.input-label {
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.num-input {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  text-align: right;
  width: 100%;
}

.num-input:focus {
  outline: none;
  border-color: var(--accent);
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-1);
  outline: none;
}

.weekday-row {
  display: contents;
}

.weekday {
  text-align: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  padding: var(--space-1) var(--space-0);
  letter-spacing: 0.5px;
}

.day-cell {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid transparent;
  user-select: none;
}

.day-cell:hover:not(.disabled) {
  background: var(--accent-light);
}

.day-cell:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.day-cell.out-of-month {
  color: var(--text-secondary);
  opacity: 0.5;
}

.day-cell.today {
  border-color: var(--accent);
}

.day-cell.focused {
  background: var(--accent);
  color: white;
}

.day-cell.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
