<script setup lang="ts">
import { computed } from 'vue'
import type { Task, Project, Property, PropertyValue } from '../../types'
import TaskCard from './TaskCard.vue'
import VirtualList from '../common/VirtualList.vue'
import DayNotes from '../Notes/DayNotes.vue'

/**
 * Above this many tasks in a single day column we route the list
 * through `VirtualList`; below it we render the cards directly. The
 * threshold guards against mounting a `ResizeObserver` per day
 * column for typical planner usage (5–20 items per day), which would
 * otherwise cost more than it saves.
 */
const VIRTUAL_LIST_THRESHOLD = 50

/** Heuristic height of a single `TaskCard` — used by the virtualizer
 *  to compute scroll offset. Slightly generous so the math doesn't
 *  leave visible gaps if a card is a few px taller than usual. */
const TASK_CARD_HEIGHT_PX = 80

const props = defineProps<{
  date: string
  dayName: string
  dayNum: number
  isToday: boolean
  /** Tasks already filtered by the active project in `WeekView`. */
  tasks: Task[]
  /** `Project` lookup keyed by id, used by `TaskCard` for the badge. */
  projects: Map<string, Project>
  properties: Property[]
  propertyValues: PropertyValue[]
  /** Current day-note text (or '' if none). */
  dayNoteValue: string
  /**
   * Jalali day-of-month. Provided when the UI is in Jalali mode;
   * `undefined` for Gregorian. When present, takes precedence over
   * `dayNum` in the rendered header.
   */
  dayNumJalali?: number
  /**
   * Jalali month label (e.g. "Far"). Provided when the UI is in Jalali
   * mode; `undefined` for Gregorian. Currently unused at the header
   * (the day number is the dominant visual), but exposed so a future
   * iteration can render the month label inline.
   */
  monthLabelJalali?: string
}>()

/**
 * All emits here are *forwarded* to `App.vue` — the column itself
 * doesn't know how to mutate state, it just routes user actions up.
 *
 * Day-level actions:
 * - `add-task`            — open the task modal seeded with this date
 * - `update-day-note`     — save the day-note textarea
 * - `update-property-value` — save a numeric property value
 * - `drop-task`           — a task was dragged onto this column
 *
 * Task-level actions (forwarded from `TaskCard`):
 * - `edit-task` / `move-task` / `toggle-task-status`
 * - `cancel-task` / `restore-task` / `delete-task`
 * - `update-task-notes`
 */
const emit = defineEmits<{
  (e: 'add-task', date: string): void
  (e: 'open-day', date: string): void
  (e: 'update-day-note', date: string, note: string): void
  (e: 'update-property-value', date: string, propertyId: string, value: number): void
  (e: 'drop-task', event: DragEvent, date: string): void
  (e: 'edit-task', task: Task): void
  (e: 'move-task', task: Task): void
  (e: 'toggle-task-status', task: Task): void
  (e: 'cancel-task', task: Task): void
  (e: 'restore-task', task: Task): void
  (e: 'delete-task', task: Task): void
  (e: 'update-task-notes', task: Task, notes: string): void
}>()

/* ------------------------------------------------------------------ */
/* Property values & notes                                               */
/* ------------------------------------------------------------------ */

/** Resolves the current value of this day's property (or 0 when unset). */
function getPropertyValue(propertyId: string): number {
  const pv = props.propertyValues.find(
    pv => pv.date === props.date && pv.propertyId === propertyId,
  )
  return pv?.value ?? 0
}

function handlePropertyChange(propertyId: string, e: Event): void {
  const target = e.target as HTMLInputElement
  const value = parseFloat(target.value) || 0
  emit('update-property-value', props.date, propertyId, value)
}

/* ------------------------------------------------------------------ */
/* Drag-and-drop                                                         */
/* ------------------------------------------------------------------ */

/**
 * Handles a task being dropped on this column. The data payload is the
 * task id — the parent resolves it back to a `Task` so this component
 * doesn't need to know about the whole `tasks` collection.
 */
function handleDrop(e: DragEvent): void {
  e.preventDefault()
  emit('drop-task', e, props.date)
}

/* ------------------------------------------------------------------ */
/* Task actions forwarding                                               */
/* ------------------------------------------------------------------ */

function onAddTask(): void {
  emit('add-task', props.date)
}

/**
 * Open day view for this column's date. Wired to clicks and
 * keyboard activation (Enter / Space) on the `.day-header` element.
 * The `+` button is a sibling of the day-header and stops
 * propagation so the add-task click never bubbles up to here.
 */
function onOpenDay(): void {
  emit('open-day', props.date)
}

const taskCount = computed(() => props.tasks.length)
</script>

<template>
  <div
    class="day-column"
    :class="{ today: isToday }"
    @dragover.prevent
    @drop="handleDrop"
  >
    <div
      class="day-header"
      role="button"
      tabindex="0"
      :aria-label="`Open ${dayName} in day view`"
      @click="onOpenDay"
      @keydown.enter.prevent="onOpenDay"
      @keydown.space.prevent="onOpenDay"
    >
      <div class="day-header-text">
        <div class="day-name">{{ dayName }}</div>
        <div class="day-date">{{ dayNumJalali ?? dayNum }}</div>
      </div>
      <button
        class="add-task-btn"
        type="button"
        aria-label="Add task"
        @click.stop="onAddTask"
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>

    <div class="task-list">
      <VirtualList
        v-if="taskCount > VIRTUAL_LIST_THRESHOLD"
        :items="tasks"
        :item-height="TASK_CARD_HEIGHT_PX"
        :threshold="VIRTUAL_LIST_THRESHOLD"
        :overscan="6"
        v-slot="{ item }"
      >
        <TaskCard
          :key="(item as Task).id"
          :task="item as Task"
          :project="projects.get((item as Task).projectId) ?? null"
          @edit="emit('edit-task', item as Task)"
          @move="emit('move-task', item as Task)"
          @toggle-status="emit('toggle-task-status', item as Task)"
          @cancel="emit('cancel-task', item as Task)"
          @restore="emit('restore-task', item as Task)"
          @delete="emit('delete-task', item as Task)"
          @update-notes="(notes) => emit('update-task-notes', item as Task, notes)"
        />
      </VirtualList>

      <template v-else>
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          v-memo="[task.status, projects.get(task.projectId)]"
          :task="task"
          :project="projects.get(task.projectId) ?? null"
          @edit="emit('edit-task', task)"
          @move="emit('move-task', task)"
          @toggle-status="emit('toggle-task-status', task)"
          @cancel="emit('cancel-task', task)"
          @restore="emit('restore-task', task)"
          @delete="emit('delete-task', task)"
          @update-notes="(notes) => emit('update-task-notes', task, notes)"
        />
      </template>

      <div v-if="taskCount === 0" class="empty-state">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <p>No tasks</p>
      </div>
    </div>

    <!-- Day Properties -->
    <div v-if="properties.length > 0" class="day-properties">
      <div v-for="prop in properties" :key="prop.id" class="property-row">
        <span class="property-label">{{ prop.name }}</span>
        <input
          type="number"
          class="property-input"
          :value="getPropertyValue(prop.id) || ''"
          placeholder="0"
          @change="(e) => handlePropertyChange(prop.id, e)"
        />
      </div>
    </div>

    <!-- Day Notes -->
    <DayNotes
      :date="date"
      :initial-value="dayNoteValue"
      @update="(noteDate, note) => emit('update-day-note', noteDate, note)"
    />
  </div>
</template>

<style scoped>
.day-column {
  flex: 0 0 160px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  max-height: 500px;
  transition: border-color 0.15s ease;
  scroll-snap-align: start;
}

.day-column.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.day-header {
  padding: var(--space-3);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}

.day-header:hover {
  background: var(--bg);
}

.day-header:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.day-header-text {
  min-width: 0;
}

.day-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.day-date {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.add-task-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s ease;
}

.add-task-btn:hover {
  background: var(--accent);
  color: white;
}

.add-task-btn svg {
  width: 16px;
  height: 16px;
}

.task-list {
  flex: 1;
  padding: var(--space-2);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-secondary);
  text-align: center;
  min-height: 150px;
}

.empty-state svg {
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-3);
  opacity: 0.5;
}

.empty-state p {
  font-size: 0.9rem;
}

.day-properties {
  border-top: 1px solid var(--border);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-shrink: 0;
}

.property-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.property-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-input {
  width: 50px;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-align: right;
  background: var(--bg);
}

.property-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Day notes styles live in `components/Notes/DayNotes.vue` */
</style>
