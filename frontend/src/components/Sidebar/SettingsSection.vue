<script setup lang="ts">
import type { Calendar, Theme, WeekStartDay } from '../../types'
import { WEEKDAY_LABELS } from '../../utils/date'

/**
 * Sidebar settings panel. Exposes three controls — the theme
 * picker, the start-of-week picker, and the calendar preference —
 * and is structured as its own component so adding more settings
 * later is a one-section change in the sidebar.
 */
defineProps<{
  /** Current theme choice (persisted in localStorage, applied to <html>). */
  theme: Theme
  /** Current start-of-week setting, 0=Sunday..6=Saturday. */
  weekStart: WeekStartDay
  /** Current calendar preference. */
  calendar: Calendar
}>()

const emit = defineEmits<{
  /**
   * Emitted when the user picks a new theme. The value is one of the
   * `Theme` literal union and is persisted in localStorage by the
   * parent (via `useTheme().setTheme`).
   */
  (e: 'change-theme', t: Theme): void
  /**
   * Emitted when the user picks a new start-of-week. The numeric
   * value matches `Date#getDay()` and `WeekStartDay`.
   */
  (e: 'change-week-start', day: WeekStartDay): void
  /**
   * Emitted when the user picks a new calendar. The value is one of
   * the `Calendar` literal union.
   */
  (e: 'change-calendar', c: Calendar): void
}>()

/**
 * `Theme` options shown in the `<select>`. Centralised as a constant
 * so the rendering and the validation stay in lockstep. Order is
 * deliberate: Light → Dark → System reads as "off, on, follow OS" in
 * the order most users will scan.
 */
const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

/**
 * `Calendar` options shown in the `<select>`. Centralised as a
 * constant so the rendering and the validation stay in lockstep.
 */
const CALENDAR_OPTIONS: ReadonlyArray<{ value: Calendar; label: string }> = [
  { value: 'gregorian', label: 'Gregorian' },
  { value: 'jalali', label: 'Jalali' },
] as const

/**
 * Controlled-`<select>` change handler for the theme picker. Same
 * validation pattern as the other two settings: only emit when the
 * picked value is a valid `Theme` literal, so a stale or
 * hand-edited DOM can't poison the parent state.
 */
function onChangeTheme(e: Event): void {
  const target = e.target as HTMLSelectElement
  const next = target.value
  if (next === 'light' || next === 'dark' || next === 'system') {
    emit('change-theme', next)
  }
}

/**
 * Build the `value` for the underlying `<select>`. Kept as a function
 * rather than a `v-model` because the parent owns the canonical state
 * (loaded from the server) and the section is purely a presenter.
 */
function onChangeWeekStart(e: Event): void {
  const target = e.target as HTMLSelectElement
  const next = Number(target.value)
  if (!Number.isInteger(next) || next < 0 || next > 6) return
  emit('change-week-start', next as WeekStartDay)
}

/**
 * Same controlled-`<select>` pattern as the week-start control. We
 * validate the picked value against the literal union before
 * emitting so a malformed option (e.g. from a hand-edited DOM) can't
 * escape into the parent.
 */
function onChangeCalendar(e: Event): void {
  const target = e.target as HTMLSelectElement
  const next = target.value
  if (next === 'gregorian' || next === 'jalali') {
    emit('change-calendar', next)
  }
  // Out-of-range values are silently ignored — the surrounding
  // `<select>` only allows the two real options, so this branch is
  // only reachable via a stale or hand-edited DOM.
}
</script>

<template>
  <div class="settings-list">
    <label class="setting-row">
      <span class="setting-label">Theme</span>
      <select
        class="setting-select"
        :value="theme"
        aria-label="Theme"
        @change="onChangeTheme"
      >
        <option
          v-for="opt in THEME_OPTIONS"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </label>
    <label class="setting-row">
      <span class="setting-label">Start of week</span>
      <select
        class="setting-select"
        :value="weekStart"
        aria-label="Start of week"
        @change="onChangeWeekStart"
      >
        <option
          v-for="(label, index) in WEEKDAY_LABELS"
          :key="index"
          :value="index"
        >
          {{ label }}
        </option>
      </select>
    </label>
    <label class="setting-row">
      <span class="setting-label">Calendar</span>
      <select
        class="setting-select"
        :value="calendar"
        aria-label="Calendar"
        @change="onChangeCalendar"
      >
        <option
          v-for="opt in CALENDAR_OPTIONS"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.settings-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
}

.setting-label {
  flex: 1;
  color: var(--text-primary);
}

.setting-select {
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-family: inherit;
  min-width: 110px;
  cursor: pointer;
}

.setting-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
