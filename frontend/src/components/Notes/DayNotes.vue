<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  date: string
  /** Current note value for this day. Used to seed the textarea. */
  initialValue: string
}>()

const emit = defineEmits<{
  (e: 'update', date: string, note: string): void
}>()

/**
 * The "expanded/collapsed" toggle is intentionally local — see the
 * plan's state-ownership note: UI state belongs to the component that
 * owns the interaction, not the page-level container.
 */
const expanded = ref<boolean>(false)

/**
 * Local mirror of the note. We seed it from `initialValue` once on mount
 * and use `:key="date"` on the textarea in `DayColumn` so the component
 * is re-mounted when the user navigates to a different day. That avoids
 * needing a `watch` to re-sync.
 */
const value = ref<string>(props.initialValue)

function handleBlur(e: FocusEvent): void {
  const target = e.target as HTMLTextAreaElement
  emit('update', props.date, target.value)
}
</script>

<template>
  <div class="day-notes">
    <div
      class="day-notes-toggle"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
      @keydown.enter.prevent="expanded = !expanded"
      @keydown.space.prevent="expanded = !expanded"
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
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      Day Notes
    </div>
    <div class="day-notes-content" :class="{ expanded }">
      <textarea
        v-model="value"
        placeholder="Add notes for this day..."
        @blur="handleBlur"
      ></textarea>
    </div>
  </div>
</template>

<style scoped>
.day-notes {
  border-top: 1px solid var(--border);
  padding: 8px;
  flex-shrink: 0;
}

.day-notes-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  user-select: none;
}

.day-notes-toggle:hover {
  background: var(--bg);
}

.day-notes-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-notes-toggle svg {
  width: 14px;
  height: 14px;
}

.day-notes-content {
  display: none;
  margin-top: 8px;
}

.day-notes-content.expanded {
  display: block;
}

.day-notes textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px;
  font-size: 0.8rem;
  resize: vertical;
  min-height: 50px;
  background: var(--surface);
  font-family: inherit;
}

.day-notes textarea:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
