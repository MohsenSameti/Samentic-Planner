<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Task, Project } from '../../types'

const props = defineProps<{
  task: Task
  /** Resolved project for the badge; `null` when the task has no project. */
  project: Project | null
}>()

/**
 * Emits the *domain* actions a task card can take. UI-only state
 * (menu open/closed, notes expanded/collapsed) lives entirely inside
 * this component — callers don't need to know about it.
 */
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'move'): void
  (e: 'cancel'): void
  (e: 'restore'): void
  (e: 'delete'): void
  (e: 'toggle-status'): void
  (e: 'update-notes', notes: string): void
}>()

/* ------------------------------------------------------------------ */
/* Local state                                                          */
/* ------------------------------------------------------------------ */

const menuOpen = ref<boolean>(false)
const notesExpanded = ref<boolean>(false)
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
  cancelled: props.task.status === 'cancelled',
}))

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

function handleNotesBlur(): void {
  emit('update-notes', notes.value)
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
const menuPosition = ref<{ top: number; left: number }>({ top: 0, left: 0 })

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

  menuPosition.value = { top, left }
}

function openMenu(): void {
  computeMenuPosition()
  menuOpen.value = true
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
 * Closes the menu when pressing Escape. Stops propagation so window-level
 * view shortcuts don't also fire.
 */
function handleDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    closeMenu()
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
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
})

/* ------------------------------------------------------------------ */
/* Menu actions                                                          */
/* ------------------------------------------------------------------ */

function handleEdit(): void {
  emit('edit')
  closeMenu()
}

function handleMove(): void {
  emit('move')
  closeMenu()
}

function handleCancel(): void {
  emit('cancel')
  closeMenu()
}

function handleRestore(): void {
  emit('restore')
  closeMenu()
}

function handleDelete(): void {
  emit('delete')
  closeMenu()
}

function handleToggleNotes(): void {
  notesExpanded.value = !notesExpanded.value
  closeMenu()
}

function handleToggleStatus(): void {
  emit('toggle-status')
}
</script>

<template>
  <div
    class="task-card"
    :class="statusClass"
    :draggable="task.status !== 'cancelled'"
    @dragstart="handleDragStart"
  >
    <div class="task-main">
      <div
        class="task-checkbox"
        :class="{ checked: task.status === 'completed' }"
        role="checkbox"
        :aria-checked="task.status === 'completed'"
        tabindex="0"
        @click="handleToggleStatus"
        @keydown.enter.prevent="handleToggleStatus"
        @keydown.space.prevent="handleToggleStatus"
      >
        <svg
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
          aria-label="Task actions"
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
            :style="{ top: menuPosition.top + 'px', left: menuPosition.left + 'px' }"
            role="menu"
            @click.stop
          >
            <template v-if="task.status !== 'cancelled'">
              <div class="task-menu-item" role="menuitem" @click="handleEdit">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </div>
              <div class="task-menu-item" role="menuitem" @click="handleToggleNotes">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {{ notesExpanded ? 'Hide Notes' : 'Add Notes' }}
              </div>
              <div class="task-menu-item" role="menuitem" @click="handleMove">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="5 9 2 12 5 15" />
                  <polyline points="9 5 12 2 15 5" />
                  <polyline points="15 19 12 22 9 19" />
                  <polyline points="19 9 22 12 19 15" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="12" y1="2" x2="12" y2="22" />
                </svg>
                Move to...
              </div>
              <div class="task-menu-item danger" role="menuitem" @click="handleCancel">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Cancel
              </div>
            </template>
            <template v-else>
              <div class="task-menu-item" role="menuitem" @click="handleRestore">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Restore
              </div>
              <div class="task-menu-item danger" role="menuitem" @click="handleDelete">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </div>
            </template>
          </div>
        </Teleport>
      </div>
    </div>

    <div class="task-notes" :class="{ expanded: notesExpanded }">
      <textarea
        v-model="notes"
        placeholder="Add notes..."
        rows="2"
        @blur="handleNotesBlur"
      ></textarea>
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
  opacity: 0.6;
}

.task-card.completed .task-title {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.task-card.cancelled {
  opacity: 0.4;
}

.task-card.cancelled .task-title {
  text-decoration: line-through;
  color: var(--muted);
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

.task-checkbox svg {
  width: 12px;
  height: 12px;
  color: white;
  opacity: 0;
}

.task-checkbox.checked svg {
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.1s ease;
  user-select: none;
}

.task-menu-item:hover {
  background: var(--bg);
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

/* Always show menu icon on mobile so it stays touchable. */
@media (max-width: 768px) {
  .task-menu-btn {
    opacity: 1;
  }
}
</style>
