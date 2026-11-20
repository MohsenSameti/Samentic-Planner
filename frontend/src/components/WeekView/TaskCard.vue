<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import type { Task, Project } from '../../types'
import { useDayActions } from '../../composables/useDayActions'
import { useI18n } from '../../composables/useI18n'

const props = defineProps<{
  task: Task
  /** Resolved project for the badge; `null` when the task has no project. */
  project: Project | null
  /**
   * True while the task's `updateTask` save is in flight (spec §14).
   * Drives a subtle visual state so the user knows the drag wasn't
   * silently dropped on a slow network.
   */
  pending?: boolean
}>()

/**
 * Spec §22: day- and task-level actions consumed by this card.
 * Provided once at the `App.vue` root; `null` means the component
 * is mounted in isolation (a unit test) and the action calls are
 * no-ops.
 */
const actions = useDayActions()
const { t } = useI18n()

/* ------------------------------------------------------------------ */
/* Local state                                                          */
/* ------------------------------------------------------------------ */

const menuOpen = ref<boolean>(false)
const notesExpanded = ref<boolean>(false)

type NotesSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const notesSaveStatus = ref<NotesSaveStatus>('idle')
let notesSaveSeq = 0
let notesResetTimer: ReturnType<typeof setTimeout> | null = null

const notesSaveStatusText = computed<string>(() => {
  if (notesSaveStatus.value === 'saving') return t('Saving…')
  if (notesSaveStatus.value === 'saved') return t('Saved')
  if (notesSaveStatus.value === 'error') return t('Save failed')
  return ''
})

/**
 * Local mirror of `task.notes`. We use a local ref instead of `:value`
 * so the textarea keeps its in-progress edits even when the parent
 * re-renders the task (e.g. after a status toggle). The `watch` keeps
 * it in sync with upstream changes.
 */
const notes = ref<string>(props.task.notes)

watch(
  () => props.task.notes,
  next => {
    // Avoid clobbering in-progress edits — if the user is mid-typing
    // in the notes textarea, leave their text alone and let the next
    // blur sync the value up.
    if (document.activeElement?.tagName !== 'TEXTAREA') {
      notes.value = next
    }
  },
)

const statusClass = computed(() => ({
  completed: props.task.status === 'completed',
  skipped: props.task.status === 'skipped',
  cancelled: props.task.status === 'cancelled',
  pending: Boolean(props.pending),
}))

/**
 * Three-way visual state for the checkbox:
 * - `checked` when the task is `completed` (a filled checkmark).
 * - `indeterminate` when the task is `skipped` (a dash — neither
 *   active nor completed). `aria-checked="mixed"` announces the same.
 * - off (empty box) for everything else.
 */
const checkboxState = computed<'checked' | 'indeterminate' | 'empty'>(() => {
  if (props.task.status === 'completed') return 'checked'
  if (props.task.status === 'skipped') return 'indeterminate'
  return 'empty'
})

const ariaChecked = computed<'true' | 'mixed' | 'false'>(() => {
  if (props.task.status === 'completed') return 'true'
  if (props.task.status === 'skipped') return 'mixed'
  return 'false'
})

/**
 * Accessible name for the custom checkbox (spec §3.2).
 * Exposes a task-specific, status-appropriate action label.
 */
const checkboxAriaLabel = computed<string>(() => {
  if (props.task.status === 'completed') {
    return `${t('Mark')} '${props.task.title}' ${t('incomplete')}`
  }
  return `${t('Mark')} '${props.task.title}' ${t('complete')}`
})

/** Label for the Skip / Unskip menu item. Toggles by status. */
const skipLabel = computed<string>(() =>
  props.task.status === 'skipped' ? t('Unskip') : t('Skip'),
)

/**
 * Spec §Out of scope (cross-state transitions):
 * `skipped → cancelled` and `cancelled → skipped` require going through
 * `active` first (two clicks). Cancelled is treated as a terminal state;
 * no single misclick should let a user accidentally hide a task they
 * only meant to defer. Therefore, Cancel is hidden for skipped tasks.
 */
const canCancel = computed<boolean>(
  () => props.task.status === 'active' || props.task.status === 'completed',
)

/* ------------------------------------------------------------------ */
/* Drag start                                                           */
/* ------------------------------------------------------------------ */

/**
 * Cancelled tasks shouldn't be re-positionable by drag — their position
 * is preserved as a visual record. `preventDefault()` cancels the drag.
 */
function handleDragStart(e: DragEvent): void {
  if (props.task.status === 'cancelled') {
    e.preventDefault()
    return
  }
  // The payload is just the task ID. The drop handler in `DayColumn`
  // resolves it back to a Task object from its `tasks` prop.
  e.dataTransfer?.setData('text/plain', props.task.id)
}

/* ------------------------------------------------------------------ */
/* Notes                                                                 */
/* ------------------------------------------------------------------ */

async function handleNotesBlur(): Promise<void> {
  const currentSeq = ++notesSaveSeq
  notesSaveStatus.value = 'saving'
  try {
    await actions?.updateTaskNotes(props.task, notes.value)
    if (notesSaveSeq === currentSeq) {
      notesSaveStatus.value = 'saved'
      if (notesResetTimer) clearTimeout(notesResetTimer)
      notesResetTimer = setTimeout(() => {
        if (notesSaveSeq === currentSeq) {
          notesSaveStatus.value = 'idle'
        }
      }, 2000)
    }
  } catch {
    if (notesSaveSeq === currentSeq) {
      notesSaveStatus.value = 'error'
    }
  }
}

/* ------------------------------------------------------------------ */
/* Menu positioning & dismissal                                         */
/* ------------------------------------------------------------------ */

/** Anchor for the menu (the kebab button) — populated on open. */
const menuAnchor = ref<HTMLElement | null>(null)

/** Root element of the teleported menu. */
const menuRef = ref<HTMLElement | null>(null)

/**
 * Menu position. Recomputed whenever the menu opens so we always have
 * a fresh viewport-relative box (window can resize between opens).
 */
const menuPosition = ref<{ top: number; inlineStart: number }>({ top: 0, inlineStart: 0 })

function computeMenuPosition(): void {
  if (!menuAnchor.value) return
  const rect = menuAnchor.value.getBoundingClientRect()
  const menuWidth = 160
  const menuHeight = 200

  let left = rect.right - menuWidth
  let top = rect.bottom + 4

  // Clamp to viewport edges so the menu never gets clipped (mobile/tablet/desktop).
  if (left < 8) left = 8
  if (left + menuWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - menuWidth - 8)
  }
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - 4)
  }
  if (top < 8) top = 8

  const inlineStart = document.documentElement.dir === 'rtl'
    ? window.innerWidth - (left + menuWidth)
    : left
  menuPosition.value = { top, inlineStart }
}

function getMenuItems(): HTMLButtonElement[] {
  if (!menuRef.value) return []
  return Array.from(menuRef.value.querySelectorAll<HTMLButtonElement>('.task-menu-item'))
}

function openMenu(): void {
  computeMenuPosition()
  menuOpen.value = true
  nextTick(() => {
    const items = getMenuItems()
    if (items.length > 0) {
      items[0].focus()
    }
  })
}

function closeMenu(): void {
  menuOpen.value = false
}

function toggleMenu(): void {
  if (menuOpen.value) closeMenu()
  else openMenu()
}

/**
 * Closes the menu when clicking anywhere outside it. Listener is bound
 * only while the menu is open to keep global click cost zero otherwise.
 */
function handleDocumentClick(e: MouseEvent): void {
  if (!menuOpen.value) return
  const target = e.target as Node | null
  if (!target) return
  if (menuAnchor.value?.contains(target)) return
  if (menuRef.value?.contains(target)) return
  closeMenu()
}

/**
 * Handles keyboard navigation within the menu (ArrowUp/Down, Home/End, Escape).
 * Escape closes the menu, stops propagation so window-level view shortcuts
 * don't fire, and restores focus to the menu trigger button.
 */
function handleDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    closeMenu()
    menuAnchor.value?.focus()
    return
  }

  const items = getMenuItems()
  if (items.length === 0) return

  const activeElement = document.activeElement as HTMLButtonElement | null
  const currentIndex = activeElement ? items.indexOf(activeElement) : -1

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % items.length
    items[nextIndex].focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIndex =
      currentIndex === -1 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length
    items[prevIndex].focus()
  } else if (e.key === 'Home') {
    e.preventDefault()
    items[0].focus()
  } else if (e.key === 'End') {
    e.preventDefault()
    items[items.length - 1].focus()
  }
}

watch(menuOpen, open => {
  if (open) {
    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleDocumentKeydown, true)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    // Recompute in case the viewport changed between toggles.
    computeMenuPosition()
  } else {
    document.removeEventListener('click', handleDocumentClick)
    document.removeEventListener('keydown', handleDocumentKeydown, true)
    window.removeEventListener('scroll', closeMenu, true)
    window.removeEventListener('resize', closeMenu)
  }
})

onUnmounted(() => {
  if (notesResetTimer) clearTimeout(notesResetTimer)
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
})

/* ------------------------------------------------------------------ */
/* Menu actions                                                          */
/* ------------------------------------------------------------------ */

function handleEdit(): void {
  actions?.editTask(props.task)
  closeMenu()
}

function handleMove(): void {
  actions?.moveTask(props.task)
  closeMenu()
}

function handleCancel(): void {
  if (!canCancel.value) return
  actions?.cancelTask(props.task)
  closeMenu()
}

function handleRestore(): void {
  actions?.restoreTask(props.task)
  closeMenu()
}

function handleSkip(): void {
  // Cancelled tasks cannot be skipped directly (acceptance criterion).
  // The outer template already hides this item for cancelled tasks.
  if (props.task.status === 'cancelled') return
  if (props.task.status === 'skipped') {
    actions?.unskipTask(props.task)
  } else {
    actions?.skipTask(props.task)
  }
  closeMenu()
}

function handleDelete(): void {
  actions?.deleteTask(props.task)
  closeMenu()
}

function handleToggleNotes(): void {
  notesExpanded.value = !notesExpanded.value
  closeMenu()
}

function handleToggleStatus(): void {
  actions?.toggleTaskStatus(props.task)
}
</script>

<template>
  <div
    class="task-card"
    :class="statusClass"
    :draggable="task.status !== 'cancelled'"
    :aria-busy="pending ? 'true' : undefined"
    @dragstart="handleDragStart"
  >
    <div class="task-main">
      <div
        class="task-checkbox"
        :class="{ checked: checkboxState === 'checked', indeterminate: checkboxState === 'indeterminate' }"
        role="checkbox"
        :aria-checked="ariaChecked"
        :aria-label="checkboxAriaLabel"
        tabindex="0"
        @click="handleToggleStatus"
        @keydown.enter.prevent="handleToggleStatus"
        @keydown.space.prevent="handleToggleStatus"
      >
        <svg
          v-if="checkboxState === 'checked'"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg
          v-else-if="checkboxState === 'indeterminate'"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
      </div>
      <div class="task-content">
        <div class="task-title">{{ task.title }}</div>
        <div v-if="task.description" class="task-description">{{ task.description }}</div>
        <div v-if="project" class="task-project">
          <div class="task-project-dot" :style="{ background: project.color }"></div>
          <span class="task-project-name">{{ project.name }}</span>
        </div>
      </div>
      <div class="task-menu-wrapper">
        <button
          ref="menuAnchor"
          class="task-menu-btn"
          type="button"
          :aria-label="t('Task actions')"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click.stop="toggleMenu"
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
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
        <Teleport to="body" v-if="menuOpen">
          <div
            ref="menuRef"
            class="task-menu open"
            :style="{ top: menuPosition.top + 'px', insetInlineStart: menuPosition.inlineStart + 'px' }"
            role="menu"
            @click.stop
          >
            <template v-if="task.status !== 'cancelled'">
              <button
                type="button"
                class="task-menu-item"
                role="menuitem"
                @click="handleEdit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {{ t('Edit') }}
              </button>
              <button
                type="button"
                class="task-menu-item"
                role="menuitem"
                @click="handleToggleNotes"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {{ notesExpanded ? t('Hide Notes') : t('Add Notes') }}
              </button>
              <button
                type="button"
                class="task-menu-item"
                role="menuitem"
                @click="handleMove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="5 9 2 12 5 15" />
                  <polyline points="9 5 12 2 15 5" />
                  <polyline points="15 19 12 22 9 19" />
                  <polyline points="19 9 22 12 19 15" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="12" y1="2" x2="12" y2="22" />
                </svg>
                {{ t('Move to...') }}
              </button>
              <button
                type="button"
                class="task-menu-item"
                role="menuitem"
                @click="handleSkip"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
                {{ skipLabel }}
              </button>
              <button
                v-if="canCancel"
                type="button"
                class="task-menu-item danger"
                role="menuitem"
                @click="handleCancel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {{ t('Cancel') }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="task-menu-item"
                role="menuitem"
                @click="handleRestore"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                {{ t('Restore') }}
              </button>
              <button
                type="button"
                class="task-menu-item danger"
                role="menuitem"
                @click="handleDelete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {{ t('Delete') }}
              </button>
            </template>
          </div>
        </Teleport>
      </div>
    </div>

    <div class="task-notes" :class="{ expanded: notesExpanded }">
      <textarea
        v-model="notes"
        :placeholder="t('Add notes...')"
        rows="2"
        @blur="handleNotesBlur"
      ></textarea>
      <div
        v-if="notesSaveStatus !== 'idle'"
        class="note-save-status"
        :class="notesSaveStatus"
        :role="notesSaveStatus === 'error' ? 'alert' : undefined"
        aria-live="polite"
      >
        {{ notesSaveStatusText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  background: var(--bg);
  border-radius: 6px;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  cursor: grab;
}

.task-card:active {
  cursor: grabbing;
}

.task-card.completed {
  border-inline-start: 3px solid var(--text-completed);
  background: linear-gradient(to right, var(--task-completed-bg) 0%, var(--bg) 60%);
}

.task-card.completed .task-title,
.task-card.completed .task-description,
.task-card.completed .task-project-name {
  color: var(--text-completed);
}

.task-card.completed .task-title {
  text-decoration: line-through;
}

.task-card.cancelled {
  border-inline-start: 3px solid var(--text-cancelled);
  background: linear-gradient(to right, var(--task-cancelled-bg) 0%, var(--bg) 60%);
}

.task-card.cancelled .task-title,
.task-card.cancelled .task-description,
.task-card.cancelled .task-project-name {
  color: var(--text-cancelled);
}

.task-card.cancelled .task-title {
  text-decoration: line-through;
}

/* Skipped — visible but de-emphasized. Same accessibility pattern
 * as `.completed` / `.cancelled`: foreground token + strike-through,
 * no container opacity (which used to drop text contrast below AA
 * for the completed / cancelled cases). The card stays full-opacity;
 * the visual signal is the muted foreground colour + line-through
 * on title, description, and project name (spec §9). */
.task-card.skipped {
  border-inline-start: 3px solid var(--text-skipped);
  background: linear-gradient(to right, var(--task-skipped-bg) 0%, var(--bg) 60%);
}
.task-card.skipped .task-title,
.task-card.skipped .task-description,
.task-card.skipped .task-project-name {
  color: var(--text-skipped);
  text-decoration: line-through;
}

:root[dir="rtl"] .task-card.completed {
  background: linear-gradient(to left, var(--task-completed-bg) 0%, var(--bg) 60%);
}

:root[dir="rtl"] .task-card.cancelled {
  background: linear-gradient(to left, var(--task-cancelled-bg) 0%, var(--bg) 60%);
}

:root[dir="rtl"] .task-card.skipped {
  background: linear-gradient(to left, var(--task-skipped-bg) 0%, var(--bg) 60%);
}

/* Spec §14: pending save state. A subtle dashed outline + a muted
 * cursor signal "in flight" without hiding the content or fighting
 * the cancelled/completed colour tokens. `aria-busy="true"` on the
 * root element announces the same state to assistive tech. */
.task-card.pending {
  outline: 1px dashed var(--text-secondary);
  outline-offset: -2px;
  cursor: progress;
}

.task-main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.task-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.1s ease;
  margin-top: var(--space-1);
}

.task-checkbox:hover {
  border-color: var(--success);
}

.task-checkbox:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.task-checkbox.checked {
  background: var(--success);
  border-color: var(--success);
}

/* Indeterminate (skipped) — filled background like `.checked`, but
 * renders a horizontal dash instead of a checkmark. The visual
 * rhymes with `.checked` so users learn the binary "filled vs empty"
 * affordance, while `aria-checked="mixed"` distinguishes the meaning
 * for assistive tech. */
.task-checkbox.indeterminate {
  background: var(--text-skipped);
  border-color: var(--text-skipped);
}

.task-checkbox svg {
  width: 12px;
  height: 12px;
  color: white;
  opacity: 0;
}

.task-checkbox.checked svg,
.task-checkbox.indeterminate svg {
  opacity: 1;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 0.875rem;
  font-weight: 500;
  word-break: break-word;
}

.task-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: var(--space-1);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-project {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.task-project-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.task-project-name {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.task-menu-wrapper {
  position: relative;
}

.task-menu-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s ease;
}

.task-card:hover .task-menu-btn,
.task-menu-btn:focus-visible {
  opacity: 1;
}

.task-menu-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.task-menu-btn svg {
  width: 16px;
  height: 16px;
}

.task-menu {
  position: fixed;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  padding: var(--space-2);
  min-width: 150px;
  z-index: 1000;
  display: none;
}

.task-menu.open {
  display: block;
}

.task-menu-item {
  width: 100%;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.85rem;
  text-align: start;
  color: inherit;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s ease;
  user-select: none;
}

.task-menu-item:hover,
.task-menu-item:focus,
.task-menu-item:focus-visible {
  background: var(--bg);
  outline: none;
}

.task-menu-item svg {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.task-menu-item.danger {
  color: var(--danger);
}

.task-menu-item.danger svg {
  color: var(--danger);
}

.task-notes {
  display: none;
  border-top: 1px solid var(--border);
  padding-top: var(--space-2);
  margin-top: var(--space-2);
}

.task-notes.expanded {
  display: block;
}

.task-notes textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: var(--space-2);
  font-size: 0.8rem;
  resize: vertical;
  min-height: 60px;
  background: var(--surface);
  font-family: inherit;
}

.task-notes textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.note-save-status {
  font-size: 0.75rem;
  margin-top: var(--space-1);
  color: var(--text-secondary);
}

.note-save-status.saving {
  color: var(--text-secondary);
}

.note-save-status.saved {
  color: var(--success);
}

.note-save-status.error {
  color: var(--danger);
}

/* Mobile touch hit areas (spec 13 §5.1). */
@media (max-width: 768px) {
  .task-menu-btn {
    opacity: 1;
    width: 44px;
    height: 44px;
  }

  .task-checkbox {
    position: relative;
  }

  .task-checkbox::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
