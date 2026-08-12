<script setup lang="ts">
import { computed } from 'vue'
import type { Task, Project, Property, PropertyValue, DayNote } from '../../types'
import DayColumn from './DayColumn.vue'

const props = defineProps<{
  /** ISO date (`YYYY-MM-DD`) of the Monday of the displayed week. */
  currentWeekStart: string
  /** All tasks in the system. Filtered to the visible week + project here. */
  tasks: Task[]
  projects: Project[]
  properties: Property[]
  propertyValues: PropertyValue[]
  /** Per-day freeform notes; WeekView resolves the one for each column. */
  dayNotes: DayNote[]
  /** 'all' or a project id; tasks outside the selected project are hidden. */
  selectedProject: string
}>()

/**
 * Day-level emits forwarded from each `DayColumn`.
 * Task-level emits are also forwarded because they're the same shape
 * the parent needs to dispatch — keeping the API symmetric with
 * `DayColumn` means the parent can pass either level's events to the
 * same handlers.
 */
const emit = defineEmits<{
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
/* Derived state                                                         */
/* ------------------------------------------------------------------ */

/**
 * Seven `WeekDay`-shaped entries, derived once per `currentWeekStart`
 * change. Stable references mean columns don't re-render when only the
 * task collection updates.
 */
interface DayCell {
  date: string
  name: string
  dayNum: number
  isToday: boolean
}

const weekDays = computed<DayCell[]>(() => {
  const days: DayCell[] = []
  const start = new Date(props.currentWeekStart)
  const today = new Date().toDateString()
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toISOString().split('T')[0],
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === today,
    })
  }
  return days
})

/** Map for O(1) project lookup by `TaskCard`. */
const projectsMap = computed<Map<string, Project>>(
  () => new Map(props.projects.map(p => [p.id, p])),
)

/** Pre-filter tasks by the active project (memoised so columns stay stable). */
const filteredTasks = computed<Task[]>(() => {
  if (props.selectedProject === 'all') return props.tasks
  return props.tasks.filter(t => t.projectId === props.selectedProject)
})

/**
 * Returns the tasks that fall on `date` in the visible week. We pre-filter
 * by project once (above) and slice per day so each column only sees its
 * own tasks — keeps re-renders localised.
 */
function tasksForDay(date: string): Task[] {
  return filteredTasks.value.filter(t => t.date === date)
}

/** Resolves the day's note text (or '' when none stored). */
function noteForDay(date: string): string {
  return props.dayNotes.find(d => d.date === date)?.note ?? ''
}
</script>

<template>
  <div class="week-grid">
    <!--
      `DayColumn` instances are keyed by date so Vue re-mounts them on
      week changes. This guarantees the internal `dayNotesExpanded`
      state, any in-flight textarea edits, etc. are reset per day.
    -->
    <DayColumn
      v-for="day in weekDays"
      :key="day.date"
      :date="day.date"
      :day-name="day.name"
      :day-num="day.dayNum"
      :is-today="day.isToday"
      :tasks="tasksForDay(day.date)"
      :projects="projectsMap"
      :properties="properties"
      :property-values="propertyValues"
      :day-note-value="noteForDay(day.date)"
      @add-task="(date) => emit('add-task', date)"
      @update-day-note="(date, note) => emit('update-day-note', date, note)"
      @update-property-value="(date, propertyId, value) => emit('update-property-value', date, propertyId, value)"
      @drop-task="(event, date) => emit('drop-task', event, date)"
      @edit-task="(task) => emit('edit-task', task)"
      @move-task="(task) => emit('move-task', task)"
      @toggle-task-status="(task) => emit('toggle-task-status', task)"
      @cancel-task="(task) => emit('cancel-task', task)"
      @restore-task="(task) => emit('restore-task', task)"
      @delete-task="(task) => emit('delete-task', task)"
      @update-task-notes="(task, notes) => emit('update-task-notes', task, notes)"
    />
  </div>
</template>

<style scoped>
.week-grid {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  min-height: 300px;
}

@media (max-width: 768px) {
  .week-grid {
    gap: 8px;
    margin: 0 -16px;
    padding: 0 16px 8px 16px;
    min-height: 250px;
  }
}
</style>
