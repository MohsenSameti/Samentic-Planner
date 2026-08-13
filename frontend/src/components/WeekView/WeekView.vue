<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type {
  Task,
  Project,
  Property,
  PropertyValue,
  DayNote,
  Calendar,
} from '../../types'
import { fromLocalISODate, toLocalISODate } from '../../utils/date'
import { toJalaliYMD, JALALI_MONTH_LABELS } from '../../utils/jalali'
import DayColumn from './DayColumn.vue'

const props = defineProps<{
  /** ISO date (`YYYY-MM-DD`) of the first day of the displayed week. */
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
  /** Which calendar the UI renders. Affects display only — storage
   *  stays Gregorian ISO. */
  calendar: Calendar
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
 * or `calendar` change. Stable references mean columns don't
 * re-render when only the task collection updates.
 */
interface DayCell {
  date: string
  name: string
  dayNum: number
  isToday: boolean
  dayNumJalali?: number
  monthLabelJalali?: string
}

const weekDays = computed<DayCell[]>(() => {
  const days: DayCell[] = []
  const start = fromLocalISODate(props.currentWeekStart)
  const today = new Date().toDateString()
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const gregIso = toLocalISODate(d)
    const entry: DayCell = {
      date: gregIso,
      name: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === today,
    }
    if (props.calendar === 'jalali') {
      const j = toJalaliYMD(gregIso)
      entry.dayNumJalali = j.jd
      entry.monthLabelJalali = JALALI_MONTH_LABELS[j.jm - 1] ?? ''
    }
    days.push(entry)
  }
  return days
})

/** Map for O(1) project lookup by `TaskCard`. */
const projectsMap = computed<Map<string, Project>>(
  () => new Map(props.projects.map(p => [p.id, p])),
)

/**
 * Filter helper: tasks restricted to the active project.
 *
 * Implementation notes:
 * - `'all'` short-circuits to the *live* `tasks` reference. Downstream
 *   code MUST NOT mutate the result — callers should use the task
 *   composable's `addTask` / `updateTask` paths instead.
 * - The filter creates a new array only when `selectedProject !== 'all'`,
 *   so when the user has "All" selected, columns see stable references
 *   (and Vue can skip re-rendering them when unrelated state changes).
 */
const filteredTasks = computed<Task[]>(() => {
  if (props.selectedProject === 'all') return props.tasks
  return props.tasks.filter(t => t.projectId === props.selectedProject)
})

/**
 * Returns the tasks that fall on `date` in the visible week.
 *
 * We pre-group tasks into a `Map<dateISO, Task[]>` once per `filteredTasks`
 * change so each `DayColumn` reads from the map in O(1). Without the
 * memoisation each `DayColumn` invocation would re-filter all tasks,
 * turning the per-week render cost into O(days × tasks).
 */
const tasksByDate = computed<Map<string, Task[]>>(() => {
  const grouped = new Map<string, Task[]>()
  for (const task of filteredTasks.value) {
    const bucket = grouped.get(task.date)
    if (bucket) {
      bucket.push(task)
    } else {
      grouped.set(task.date, [task])
    }
  }
  return grouped
})

/**
 * Returns the tasks that fall on `date` in the visible week. Reads from
 * the pre-grouped map so each column lookup is constant-time.
 */
function tasksForDay(date: string): Task[] {
  return tasksByDate.value.get(date) ?? []
}

/** Resolves the day's note text (or '' when none stored). */
function noteForDay(date: string): string {
  return props.dayNotes.find(d => d.date === date)?.note ?? ''
}

/* ------------------------------------------------------------------ */
/* Auto-scroll to "today" on page load                                  */
/* ------------------------------------------------------------------ */

/**
 * Ref to the scrollable week-grid container. Used to query for the
 * `.day-column.today` element and call `scrollIntoView` on it, so the
 * browser does the math against the container's actual scrollable
 * width (taking mobile padding, gap, and `overflow-x` clipping into
 * account).
 */
const weekGridRef = ref<HTMLDivElement | null>(null)

/**
 * Index of a day cell from the end at which we stop trying to snap
 * today to the start of the viewport.
 *
 * When today is at index 5 or 6 (the last two days of the week),
 * snapping to `start` would push the scroll container to its maximum
 * position and leave 1-2 empty column widths of dead space on the
 * right. In that range we use `scrollIntoView({ inline: 'nearest' })`
 * so the today column is visible without that trailing gap.
 */
const SCROLL_NEAREST_THRESHOLD = 5

/**
 * True iff the current local-time "now" falls inside the displayed
 * week. Computed synchronously from `props.currentWeekStart`, so it
 * doesn't depend on the `DayColumn` v-for being rendered. That makes
 * it usable as a watch source — the watcher only fires when the week
 * prop transitions into or out of today, never on unrelated task /
 * project mutations.
 */
function isTodayInVisibleWeek(): boolean {
  const start = fromLocalISODate(props.currentWeekStart)
  // Exclusive upper bound: the next week's first day is the upper
  // boundary, so we add 7 days from start and use `<` rather than
  // building `end = start + 6` and matching a `Date#toDateString`
  // string (which is unreliable near midnight).
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const now = new Date()
  return now >= start && now < end
}

/**
 * Locate today's column inside the grid and scroll it into view.
 * Snaps today to the left edge when it has room to do so; falls back
 * to `'nearest'` for the last 1-2 days to avoid an empty viewport.
 *
 * Implementation notes:
 *
 * - We delegate to `Element#scrollIntoView` so the browser handles the
 *   container boundary, padding, and `overflow-x: hidden` clipping
 *   for us. We don't try to compute `scrollLeft` ourselves because
 *   the gap between columns differs between mobile and desktop.
 * - The grid uses `scroll-snap-type: x mandatory` and each column
 *   declares `scroll-snap-align: start`. The browser's scroll handler
 *   already snaps the column to the nearest snap point after our
 *   scroll request, so we get perfect day-aligned positioning without
 *   any additional logic.
 * - `behavior: 'auto'` (default) keeps the scroll instant on first
 *   paint. A smooth animation here would conflict with the
 *   `scroll-behavior` CSS and produce a visible jump on page load.
 */
function scrollTodayIntoView(): void {
  const container = weekGridRef.value
  if (!container) return

  // Locate today by class first, then resolve its column index. The
  // index is what drives the snap-to-start vs `'nearest'` decision,
  // so computing it separately keeps the logic clear and avoids
  // closure-mutation narrowing pitfalls (`let` variables mutated
  // inside a `forEach` callback don't track cleanly through TS).
  const todayEl = container.querySelector<HTMLElement>('.day-column.today')
  if (!todayEl) return

  const columns = container.querySelectorAll<HTMLElement>('.day-column')
  const todayIndex = Array.from(columns).indexOf(todayEl)
  if (todayIndex < 0) return

  const snapToStart = todayIndex < SCROLL_NEAREST_THRESHOLD
  todayEl.scrollIntoView({
    inline: snapToStart ? 'start' : 'nearest',
    block: 'nearest',
  })
}

/**
 * Handle the initial page-load case: scroll today into view once the
 * grid is mounted. We don't need a watch with `immediate: true` here
 * because `onMounted` fires after the first DOM render — by that
 * point, `weekGridRef.value` is set and the `.today` column exists.
 */
onMounted(() => {
  if (!isTodayInVisibleWeek()) return
  // `nextTick` waits one extra microtask so any in-flight child
  // updates from `App.vue`'s data-load path have settled before we
  // query the DOM. Mirrors the watch branch below.
  nextTick().then(scrollTodayIntoView)
})

/**
 * Re-scroll whenever the parent navigates to a week containing today
 * (e.g. when the user clicks the header's "Today" button). When the
 * parent navigates to a week that doesn't contain today, the
 * `isTodayInVisibleWeek()` guard short-circuits and we leave the
 * scroll position alone — the user is intentionally looking at a
 * different week.
 */
watch(
  () => props.currentWeekStart,
  async () => {
    if (!isTodayInVisibleWeek()) return
    await nextTick()
    scrollTodayIntoView()
  },
)
</script>

<template>
  <div ref="weekGridRef" class="week-grid">
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
      :day-num-jalali="day.dayNumJalali"
      :month-label-jalali="day.monthLabelJalali"
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
  margin-top: 24px;
}

@media (max-width: 768px) {
  .week-grid {
    gap: 8px;
    margin: 0 -16px;
    margin-top: 24px;
    padding: 0 16px 8px 16px;
    min-height: 250px;
  }
}
</style>
