<script setup lang="ts">
import type { Task, Property } from '../types'

/** A `Property` augmented with the running sum for the visible week. */
type PropertyWithSum = Property & { sum: number }

const props = defineProps<{
  tasks: Task[]
  /** ISO date strings (`YYYY-MM-DD`) of the seven days in the visible week. */
  weekDateStrings: string[]
  properties: PropertyWithSum[]
}>()

/**
 * Count tasks in the visible week with a given status. We build a
 * `Set` of the week's ISO dates for O(1) membership checks instead of
 * calling `weekDateStrings.includes` per task — that turned out to be
 * the hot path in profiling.
 */
function weekTasksByStatus(
  tasks: Task[],
  weekDateStrings: string[],
  status: Task['status'],
): number {
  const set = new Set(weekDateStrings)
  let count = 0
  for (const t of tasks) {
    if (set.has(t.date) && t.status === status) count++
  }
  return count
}

/** Bindings exposed to the template. */
const completedCount = (): number =>
  weekTasksByStatus(props.tasks, props.weekDateStrings, 'completed')
const activeCount = (): number =>
  weekTasksByStatus(props.tasks, props.weekDateStrings, 'active')
const cancelledCount = (): number =>
  weekTasksByStatus(props.tasks, props.weekDateStrings, 'cancelled')
</script>

<template>
  <section class="week-summary">
    <h3>
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
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      Week Summary
    </h3>
    <div class="summary-stats">
      <div class="stat-item">
        <div class="stat-value" style="color: var(--success)">
          {{ completedCount() }}
        </div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">
          {{ activeCount() }}
        </div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: var(--muted)">
          {{ cancelledCount() }}
        </div>
        <div class="stat-label">Cancelled</div>
      </div>
      <div v-for="prop in properties" :key="prop.id" class="stat-item">
        <div class="stat-value" style="color: var(--accent)">{{ prop.sum }}</div>
        <div class="stat-label">{{ prop.name }} {{ prop.unit }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.week-summary {
  margin-top: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}

.week-summary h3 {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-summary h3 svg {
  width: 18px;
  height: 18px;
  color: var(--accent);
}

.summary-stats {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 500;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}
</style>
