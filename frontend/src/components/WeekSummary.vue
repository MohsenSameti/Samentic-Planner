<script setup lang="ts">
import { computed } from 'vue'
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
 * Single-pass task aggregation for the visible week.
 *
 * Builds a `Set` of the week's ISO dates once and tallies counts for
 * each status in a single loop. The result is memoised — re-renders
 * that don't change `tasks` or `weekDateStrings` read the same
 * counters instead of rescanning the entire list three times.
 */
interface WeekTaskCounts {
  completed: number
  active: number
  cancelled: number
}

const weekTaskCounts = computed<WeekTaskCounts>(() => {
  const weekDateSet = new Set(props.weekDateStrings)
  const counts: WeekTaskCounts = { completed: 0, active: 0, cancelled: 0 }
  for (const task of props.tasks) {
    if (!weekDateSet.has(task.date)) continue
    if (task.status === 'completed') counts.completed++
    else if (task.status === 'cancelled') counts.cancelled++
    else counts.active++
  }
  return counts
})

const completedCount = computed<number>(() => weekTaskCounts.value.completed)
const activeCount = computed<number>(() => weekTaskCounts.value.active)
const cancelledCount = computed<number>(() => weekTaskCounts.value.cancelled)
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
          {{ completedCount }}
        </div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">
          {{ activeCount }}
        </div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: var(--muted)">
          {{ cancelledCount }}
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
  margin-top: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-5);
}

.week-summary h3 {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.week-summary h3 svg {
  width: 18px;
  height: 18px;
  color: var(--accent);
}

.summary-stats {
  display: flex;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
