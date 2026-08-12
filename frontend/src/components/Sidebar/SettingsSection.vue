<script setup lang="ts">
import type { WeekStartDay } from '../../types'
import { WEEKDAY_LABELS } from '../../utils/date'

/**
 * Sidebar settings panel. Currently exposes a single control (the
 * start-of-week picker); structured as its own component so adding
 * more settings later is a one-section change in the sidebar.
 */
defineProps<{
  /** Current start-of-week setting, 0=Sunday..6=Saturday. */
  weekStart: WeekStartDay
}>()

const emit = defineEmits<{
  /**
   * Emitted when the user picks a new start-of-week. The numeric
   * value matches `Date#getDay()` and `WeekStartDay`.
   */
  (e: 'change-week-start', day: WeekStartDay): void
}>()

/**
 * Build the `value` for the underlying `<select>`. Kept as a function
 * rather than a `v-model` because the parent owns the canonical state
 * (loaded from the server) and the section is purely a presenter.
 */
function onChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  const next = Number(target.value)
  if (!Number.isInteger(next) || next < 0 || next > 6) return
  emit('change-week-start', next as WeekStartDay)
}
</script>

<template>
  <div class="settings-list">
    <label class="setting-row">
      <span class="setting-label">Start of week</span>
      <select
        class="setting-select"
        :value="weekStart"
        aria-label="Start of week"
        @change="onChange"
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
  </div>
</template>

<style scoped>
.settings-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}

.setting-label {
  flex: 1;
  color: var(--text-primary);
}

.setting-select {
  padding: 6px 8px;
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
