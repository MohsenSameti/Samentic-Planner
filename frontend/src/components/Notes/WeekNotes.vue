<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  /** ISO date (`YYYY-MM-DD`) of the Monday of the target week. */
  weekStart: string
  /** Current note value for the week. */
  initialValue: string
}>()

const emit = defineEmits<{
  (e: 'update', weekStart: string, note: string): void
}>()

/**
 * Local mirror of the note text. We re-seed when the upstream value
 * changes (e.g. the user switches to a different week and the parent
 * passes a new note string), but only when the textarea isn't focused
 * to avoid clobbering in-progress edits.
 */
const value = ref<string>(props.initialValue)

watch(
  () => props.initialValue,
  next => {
    if (document.activeElement?.tagName !== 'TEXTAREA') {
      value.value = next
    }
  },
)

watch(
  () => props.weekStart,
  () => {
    // Switching weeks: reset the local mirror and refocus nothing.
    value.value = props.initialValue
  },
)

function handleBlur(e: FocusEvent): void {
  const target = e.target as HTMLTextAreaElement
  emit('update', props.weekStart, target.value)
}
</script>

<template>
  <section class="week-notes-section">
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
      Week Notes
    </h3>
    <textarea
      v-model="value"
      placeholder="Add notes about this week..."
      @blur="handleBlur"
    ></textarea>
  </section>
</template>

<style scoped>
.week-notes-section {
  margin-top: var(--space-6);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-5);
}

.week-notes-section h3 {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.week-notes-section h3 svg {
  width: 18px;
  height: 18px;
  color: var(--accent);
}

.week-notes-section textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--space-3);
  font-size: 0.9rem;
  resize: vertical;
  min-height: 80px;
  background: var(--bg);
  font-family: inherit;
}

.week-notes-section textarea:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
