<script setup lang="ts">
import { computed } from 'vue'
import type {
  Calendar,
  Project,
  Property,
  PropertyValue,
  Task,
} from '../../types'
import TaskCard from '../WeekView/TaskCard.vue'
import DayNotes from '../Notes/DayNotes.vue'
import DatePickerPopover from '../common/DatePickerPopover.vue'

/**
 * `Property` augmented with the day's value for the summary line.
 * Built by `App.vue` and passed in ready-to-render so this
 * component stays a pure presentation layer.
 */
interface SummaryPropertyValue {
  id: string
  name: string
  unit: string
  value: number
}

/**
 * Day-summary shape. Counts are pre-aggregated by `App.vue` (single
 * pass over `tasks`) so the component doesn't repeat the work on
 * every render.
 */
interface Summary {
  active: number
  completed: number
  cancelled: number
  propertyValues: SummaryPropertyValue[]
}

const props = defineProps<{
  /** ISO date (`YYYY-MM-DD`) of the focused day. */
  date: string
  /** Formatted title: `yyyy-MM-dd (Mon)` or `1403-06-14 (2 Shanbe)`. */
  title: string
  /** Day-of-month number, Gregorian. */
  dayNum: number
  /** Jalali day-of-month when calendar is jalali; `undefined` otherwise. */
  dayNumJalali?: number
  /** Jalali month label when calendar is jalali; `undefined` otherwise. */
  monthLabelJalali?: string
  /** All tasks in the system; filtered to the focused day + project here. */
  tasks: Task[]
  /** `Project` lookup keyed by id, used by `TaskCard` for the badge. */
  projects: Map<string, Project>
  properties: Property[]
  propertyValues: PropertyValue[]
  /** Pre-resolved note text for the focused day (or '' if none). */
  dayNoteValue: string
  /** 'all' or a project id; tasks outside the selected project are hidden. */
  selectedProject: string
  /** Which calendar the UI renders. */
  calendar: Calendar
  /** Pre-aggregated counts and per-property day's values. */
  summary: Summary
}>()

/**
 * All emits here are forwarded to `App.vue`. DayView doesn't know
 * how to mutate state — it just routes user actions up.
 *
 * Day-level actions:
 * - `back-to-week` — close day view, return to week
 * - `prev-day` / `next-day` — step ±1 day
 * - `navigate-day(date)` — jump to an arbitrary day (from date picker)
 * - `add-task(date)` — open the task modal seeded with this date
 * - `update-day-note(date, note)` — save the day-note textarea
 * - `update-property-value(date, propertyId, value)` — save a property value
 * - `drop-task(event, date)` — a task was dragged onto this column
 *
 * Task-level actions (forwarded from `TaskCard`):
 * - `edit-task` / `move-task` / `toggle-task-status`
 * - `cancel-task` / `restore-task` / `delete-task`
 * - `update-task-notes`
 */
const emit = defineEmits<{
  (e: 'back-to-week'): void
  (e: 'prev-day'): void
  (e: 'next-day'): void
  (e: 'navigate-day', date: string): void
  (e: 'add-task', date: string): void
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
/* Derived state                                                        */
/* ------------------------------------------------------------------ */

/**
 * Tasks for the focused day, filtered by the active project.
 *
 * Mirrors `WeekView`'s `tasksForDay` + `filteredTasks` logic. The
 * project filter is centralised here so the template can render
 * `tasksForDay` directly without re-filtering.
 */
const tasksForDay = computed<Task[]>(() => {
  const day = props.date
  const filtered: Task[] = []
  for (const t of props.tasks) {
    if (t.date !== day) continue
    if (props.selectedProject !== 'all' && t.projectId !== props.selectedProject) continue
    filtered.push(t)
  }
  return filtered
})

/** Resolves the current value of this day's property (or 0 when unset). */
function getPropertyValue(propertyId: string): number {
  const pv = props.propertyValues.find(
    pv => pv.date === props.date && pv.propertyId === propertyId,
  )
  return pv?.value ?? 0
}

/* ------------------------------------------------------------------ */
/* Day navigation                                                       */
/* ------------------------------------------------------------------ */

function handleBack(): void {
  emit('back-to-week')
}

function handlePrev(): void {
  emit('prev-day')
}

function handleNext(): void {
  emit('next-day')
}

/**
 * Handler for the `DatePickerPopover` `update` emit. Forward as
 * `navigate-day` so `App.vue` can replace `currentDay`.
 */
function handleDatePicked(value: string): void {
  emit('navigate-day', value)
}

/* ------------------------------------------------------------------ */
/* Task actions                                                         */
/* ------------------------------------------------------------------ */

function handleAddTask(): void {
  emit('add-task', props.date)
}

function handlePropertyChange(propertyId: string, e: Event): void {
  const target = e.target as HTMLInputElement
  const value = parseFloat(target.value) || 0
  emit('update-property-value', props.date, propertyId, value)
}

/* ------------------------------------------------------------------ */
/* Drag-and-drop                                                        */
/* ------------------------------------------------------------------ */

/**
 * Handles a task being dropped on this view. The data payload is
 * the task id (set by `TaskCard#handleDragStart`); the parent
 * resolves it back to a `Task` from its `tasks` collection. We
 * forward the event + date up so App.vue owns the mutation.
 */
function handleDrop(e: DragEvent): void {
  e.preventDefault()
  emit('drop-task', e, props.date)
}

/* ------------------------------------------------------------------ */
/* TaskCard event forwarding                                            */
/* ------------------------------------------------------------------ */

function onEditTask(task: Task): void {
  emit('edit-task', task)
}

function onMoveTask(task: Task): void {
  emit('move-task', task)
}

function onToggleTaskStatus(task: Task): void {
  emit('toggle-task-status', task)
}

function onCancelTask(task: Task): void {
  emit('cancel-task', task)
}

function onRestoreTask(task: Task): void {
  emit('restore-task', task)
}

function onDeleteTask(task: Task): void {
  emit('delete-task', task)
}

function onUpdateTaskNotes(task: Task, notes: string): void {
  emit('update-task-notes', task, notes)
}
</script>

<template>
  <div class="day-view">
    <!-- Header: back button | prev chevron + (date picker) + next chevron -->
    <header class="day-view-header">
      <button
        class="day-back-btn"
        type="button"
        aria-label="Back to week"
        @click="handleBack"
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
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span class="day-back-btn-label">Week</span>
      </button>
      <div class="day-view-title-group">
        <button
          class="day-prev-btn"
          type="button"
          aria-label="Previous day"
          @click="handlePrev"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <DatePickerPopover
          class="day-view-date-picker"
          :value="date"
          :calendar="calendar"
          @update="handleDatePicked"
        />
        <span class="day-view-title" aria-hidden="true">{{ title }}</span>
        <button
          class="day-next-btn"
          type="button"
          aria-label="Next day"
          @click="handleNext"
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
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <!--
          The date picker is inline inside the title group so the
          popover anchors relative to the title element. The anchor
          itself is rendered inside the popover; we wrap it here so
          the popover content appears/disappears via v-if on the
          popover, not on the title.
        -->
      </div>
      <div class="day-view-header-spacer" aria-hidden="true"></div>
    </header>

    <!-- Summary line: counts + per-property badges for the day. -->
    <div class="day-view-summary">
      <span class="day-view-summary-counts">
        <span class="day-view-summary-count">{{ summary.active }} active</span>
        <span class="day-view-summary-sep" aria-hidden="true">·</span>
        <span class="day-view-summary-count">{{ summary.completed }} done</span>
        <span class="day-view-summary-sep" aria-hidden="true">·</span>
        <span class="day-view-summary-count">{{ summary.cancelled }} cancelled</span>
      </span>
      <span v-if="summary.propertyValues.length > 0" class="day-view-summary-properties">
        <span
          v-for="pv in summary.propertyValues"
          :key="pv.id"
          class="day-view-summary-property"
        >
          {{ pv.name }} {{ pv.value }}{{ pv.unit }}
        </span>
      </span>
    </div>

    <!-- Two-pane grid: tasks on the left, properties + notes on the right.
         Collapses to a single column below 768px. -->
    <div class="day-view-body">
      <div
        class="day-view-tasks"
        @dragover.prevent
        @drop="handleDrop"
      >
        <div class="day-view-tasks-header">
          <h3>Tasks</h3>
          <button
            class="day-add-task-btn"
            type="button"
            aria-label="Add task"
            @click="handleAddTask"
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
        <div class="day-view-tasks-list">
          <TaskCard
            v-for="task in tasksForDay"
            :key="task.id"
            :task="task"
            :project="projects.get(task.projectId) ?? null"
            @edit="onEditTask(task)"
            @move="onMoveTask(task)"
            @toggle-status="onToggleTaskStatus(task)"
            @cancel="onCancelTask(task)"
            @restore="onRestoreTask(task)"
            @delete="onDeleteTask(task)"
            @update-notes="(notes) => onUpdateTaskNotes(task, notes)"
          />
          <div v-if="tasksForDay.length === 0" class="day-view-empty">
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
            <p>No tasks for this day</p>
          </div>
        </div>
      </div>

      <div class="day-view-side">
        <div v-if="properties.length > 0" class="day-view-properties">
          <h3>Day Properties</h3>
          <div
            v-for="prop in properties"
            :key="prop.id"
            class="property-row"
          >
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

        <div class="day-view-notes">
          <h3>Day Notes</h3>
          <DayNotes
            :date="date"
            :initial-value="dayNoteValue"
            @update="(noteDate, note) => emit('update-day-note', noteDate, note)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

/* Header ------------------------------------------------------------------ */

.day-view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
}

.day-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  min-height: 36px;
}

.day-back-btn:hover {
  background: var(--bg);
  color: var(--accent);
  border-color: var(--accent);
}

.day-back-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-back-btn svg {
  width: 16px;
  height: 16px;
}

.day-view-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
  position: relative;
}

.day-prev-btn,
.day-next-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.day-prev-btn:hover,
.day-next-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.day-prev-btn:focus-visible,
.day-next-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-prev-btn svg,
.day-next-btn svg {
  width: 18px;
  height: 18px;
}

.day-view-title {
  font-family: var(--font-heading);
  font-size: 1.50rem;
  font-weight: normal;
  margin: 0;
  white-space: nowrap;
}

.day-view-header-spacer {
  width: 88px; /* mirrors day-back-btn width so the title stays centred */
}

.day-view-date-picker {
  /* Position the popover absolutely below the title; the popover
     component itself handles its positioning. Keeping the wrapper
     here ensures the popover anchors to the title row. */
  position: static;
}

/* Summary line ----------------------------------------------------------- */

.day-view-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.day-view-summary-counts {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.day-view-summary-count {
  font-family: var(--font-mono);
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
}

.day-view-summary-sep {
  color: var(--text-secondary);
  opacity: 0.5;
}

.day-view-summary-properties {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.day-view-summary-property {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 500;
}

/* Body two-pane grid ----------------------------------------------------- */

.day-view-body {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}

.day-view-tasks,
.day-view-side {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.day-view-tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.day-view-tasks-header h3,
.day-view-properties h3,
.day-view-notes h3 {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  margin: 0;
}

.day-add-task-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--accent-light);
  color: var(--accent);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.day-add-task-btn:hover {
  background: var(--accent);
  color: white;
}

.day-add-task-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.day-add-task-btn svg {
  width: 16px;
  height: 16px;
}

.day-view-tasks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 96px;
}

.day-view-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-secondary);
  text-align: center;
  min-height: 96px;
}

.day-view-empty svg {
  width: 36px;
  height: 36px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.day-view-empty p {
  font-size: 0.9rem;
  margin: 0;
}

.day-view-side {
  gap: 16px;
}

.property-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.property-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  text-align: right;
  background: var(--bg);
  color: var(--text-primary);
}

.property-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Responsive -------------------------------------------------------------- */

@media (max-width: 767px) {
  .day-view-header {
    flex-wrap: wrap;
    gap: 8px;
    min-height: auto;
  }
  .day-back-btn {
    order: 2;
  }
  .day-view-title-group {
    order: 1;
    width: 100%;
    flex: 1 0 100%;
    justify-content: center;
  }
  .day-view-header-spacer {
    display: none;
  }
  .day-back-btn-label {
    display: none;
  }
  .day-view-body {
    grid-template-columns: 1fr;
  }
  .day-view-title {
    font-size: 1.2rem;
  }
  .day-view-summary {
    font-size: 0.8rem;
    padding: 6px 10px;
  }
}
</style>
