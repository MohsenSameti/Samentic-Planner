<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDayActions } from '../../composables/useDayActions'

const props = defineProps<{
  date: string
  /** Current note value for this day. Used to seed the textarea. */
  initialValue: string
}>()

const actions = useDayActions()

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

/**
 * Spec §19: a trimmed "has a note" flag drives the indicator dot and
 * the single-line preview. Defined on the *trimmed* string so a note
 * that is only whitespace doesn't render as "has content" — the user
 * hasn't actually written anything useful.
 */
const hasNote = computed<boolean>(() => value.value.trim().length > 0)

/**
 * Spec §19: one-line preview of the stored text, clamped with
 * ellipsis if it would overflow. Rendered in the collapsed state so
 * the user knows what's saved without opening the editor.
 */
const previewText = computed<string>(() => {
  const trimmed = value.value.trim()
  if (trimmed.length === 0) return ''
  // Collapse internal whitespace runs so a multi-line paste becomes
  // a single line in the preview.
  return trimmed.replace(/\s+/g, ' ')
})

function handleBlur(e: FocusEvent): void {
  const target = e.target as HTMLTextAreaElement
  actions?.updateDayNote(props.date, target.value)
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
      <span class="day-notes-label">Day Notes</span>
      <!-- Spec §19: indicator dot + single-line preview when the day
           has a non-empty note. .day-notes-preview is hidden via CSS
           when the day-notes section is expanded, so the toggle stays
           compact while editing. -->
      <span
        v-if="hasNote"
        class="day-notes-indicator"
        aria-hidden="true"
      ></span>
    </div>
    <p
      v-if="hasNote && !expanded"
      class="day-notes-preview"
      :title="previewText"
    >{{ previewText }}</p>
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
  padding: var(--space-2);
  flex-shrink: 0;
}

.day-notes-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
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

/* Spec §19: small accent dot indicating the day has a saved note.
 * Rendered as a sibling of the label so screen readers (which ignore
 * `aria-hidden` on the dot) announce the label without the dot, and
 * the visual signal stays a pure decoration. The 8px size matches
 * the project's smallest visual-mark token. */
.day-notes-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

/* Spec §19: single-line muted preview of the stored note. Clamped to
 * one line + ellipsis so the toggle row stays a single line; the full
 * text is exposed via `title` for pointer devices. */
.day-notes-preview {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: var(--space-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.day-notes-content {
  display: none;
  margin-top: var(--space-2);
}

.day-notes-content.expanded {
  display: block;
}

.day-notes textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-2);
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

/* Spec §6: bump the day-notes toggle to a 44px-tall touch target on
 * mobile. At desktop the toggle is a compact ~22px row, which fails
 * the 44px minimum. Width / height are not scanned by the spacing
 * lint, so a raw px value is acceptable here. */
@media (max-width: 768px) {
  .day-notes-toggle {
    min-height: 44px;
  }
}
</style>
