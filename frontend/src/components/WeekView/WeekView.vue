<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  Task,
  Project,
  Property,
  PropertyValue,
  DayNote,
  Calendar,
} from '../../types'
import { fromLocalISODate, monthMarkerFor, toLocalISODate } from '../../utils/date'
import { toJalaliYMD, JALALI_WEEKDAY_LABELS_LONG } from '../../utils/jalali'
import { useTodayISO } from '../../composables/useTodayISO'
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
  /**
   * Monotonic counter incremented by `useWeekNavigation` on every
   * `goToToday()` call. Watched so the today column scrolls into
   * view even when the user clicks Today from inside today's week
   * (in which case `currentWeekStart` is unchanged and the watcher
   * on that prop wouldn't fire). Initial value `0` is the
   * "no-trigger-yet" sentinel; the watcher skips it so it doesn't
   * double-scroll on mount (the `onMounted` hook handles that).
   */
  goToTodayTrigger: number
  /**
   * Set of task IDs whose `updateTask` save is currently in flight.
   * Spec §14: each `DayColumn` marks its `TaskCard`s in the set
   * with a pending state so the user gets visible feedback that
   * the drop hasn't been silently lost on a slow network.
   */
  pendingTaskIds: Set<string>
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
  /**
   * True when the calendar day is strictly before today (in local
   * time). Spec §18: past days in the current week need a visual
   * distinction so the user can orient themselves without counting
   * back from the today ring.
   */
  isPast: boolean
  dayNumJalali?: number
}

const weekDays = computed<DayCell[]>(() => {
  const days: DayCell[] = []
  const start = fromLocalISODate(props.currentWeekStart)
  // Read `todayISO` *inside* the computed body so the reactivity
  // system tracks the dependency and the computed re-runs on each
  // tick. The composable ticks once a minute and on
  // `visibilitychange`, so a tab left open across midnight re-renders
  // with the new day's `isToday`.
  const today = fromLocalISODate(todayISO.value)
  const todayKey = today.toDateString()
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const gregIso = toLocalISODate(d)
    const entry: DayCell = {
      date: gregIso,
      // Spec §26: the header uses the FULL Persian weekday name
      // (`Shanbe`, not `Shan`) — the same strings `formatDayTitle`
      // renders. Gregorian stays `weekday: 'short'`. The short labels
      // remain in use by `JalaliDatePicker`, whose grid columns are
      // too narrow for the long form.
      name: props.calendar === 'jalali'
        ? (JALALI_WEEKDAY_LABELS_LONG[d.getDay()] ?? '')
        : d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      isToday: d.toDateString() === todayKey,
      // Past = strictly before today (today itself stays loudest).
      // The comparison uses local-midnight `Date`s so a day that is
      // today in the user's timezone is never counted as past.
      isPast: d.getTime() < today.getTime(),
    }
    if (props.calendar === 'jalali') {
      const j = toJalaliYMD(gregIso)
      entry.dayNumJalali = j.jd
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
 *
 * Spec §15 step 2: each bucket is sorted by `(status bucket, createdAt,
 * id)` so completed tasks sink below active ones, cancelled sinks to
 * the bottom, and the secondary key (createdAt, then id) keeps the
 * relative order stable when a single task's status toggles. Without
 * the secondary key, toggling one task could re-shuffle every other
 * card in the column.
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
  // Sort each bucket in place. Status bucket: active < completed <
  // cancelled. Ties broken by `createdAt` (older first) then `id` for
  // a fully deterministic order.
  const statusBucket = (t: Task): number => {
    if (t.status === 'active') return 0
    if (t.status === 'completed') return 1
    return 2 // cancelled
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => {
      const sb = statusBucket(a) - statusBucket(b)
      if (sb !== 0) return sb
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
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

/**
 * Spec §17: per-day inline month marker label. Resolved centrally
 * (rather than per-column) so the helper's calendar arithmetic lives
 * in `utils/date.ts` and the column just renders whatever it gets.
 * Returns `null` when no marker applies; the column hides the badge
 * in that case.
 */
const monthMarkers = computed<Map<string, string | null>>(() => {
  return monthMarkerFor(weekDays.value, props.calendar)
})

function monthMarkerForDay(date: string): string | null {
  return monthMarkers.value.get(date) ?? null
}

/** Resolves the day's note text (or '' when none stored). */
function noteForDay(date: string): string {
  return props.dayNotes.find(d => d.date === date)?.note ?? ''
}

/* ------------------------------------------------------------------ */
/* Auto-scroll to "today" on page load                                  */
/* ------------------------------------------------------------------ */

/**
 * Shared reactive "today" clock. Driven by `useTodayISO` so a tab
 * left open across midnight re-renders the highlight on the new
 * day's column without a manual reload. Only `WeekView` reads it;
 * `DayColumn` continues to receive `isToday` as a prop, which keeps
 * the leaf free of any timer or listener.
 */
const { todayISO } = useTodayISO()

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
  // `todayISO` is local-midnight ISO; convert back to a `Date` at
  // local midnight via `fromLocalISODate` so the `>= start && < end`
  // comparison doesn't drift by ±1 day in non-UTC timezones. Reading
  // `todayISO.value` (instead of capturing at module scope) keeps the
  // dependency tracked by Vue's reactivity system.
  const now = fromLocalISODate(todayISO.value)
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
 * Returns the today's column label inside the visible week, or null
 * when today isn't in the week. Spec §8: surface the current day in
 * the toolbar so the user can re-find today's column even after
 * scrolling it out of the viewport on mobile.
 *
 * The label combines the weekday short name (matching `weekDays[].name`)
 * with the day-of-month — the same shape the column header shows —
 * so the pill and the column header read as one anchor.
 */
const currentDayLabel = computed<string | null>(() => {
  if (!isTodayInVisibleWeek()) return null
  // The week uses `weekDays` for everything else; find today's cell
  // by matching `isToday`. `props.calendar` matches because
  // `weekDays` is keyed off it.
  const today = weekDays.value.find(d => d.isToday)
  if (!today) return null
  // "Wed 03" — weekday short + zero-padded day-of-month so the label
  // is the same width whether today is "3" or "31".
  const paddedDay = String(
    today.dayNumJalali ?? today.dayNum,
  ).padStart(2, '0')
  return `${today.name} ${paddedDay}`
})

/**
 * Re-scroll whenever the parent navigates to a week containing today
 * (e.g. when the user clicks the header's "Today" button). When the

/**
 * Scroll affordance (spec §8). Position-driven visibility for the
 * left + right edge fades. `false` when the grid fits without
 * overflow, so on a wide desktop the fades stay invisible. The two
 * scroll/overflow listeners are passive so they don't fight the
 * grid's snap container.
 */
const showLeftFade = ref<boolean>(false)
const showRightFade = ref<boolean>(false)

/**
 * Recompute fade visibility from the current scroll metrics. Reads
 * `scrollLeft` and the rendered scroll dimensions off the grid
 * container; only touches refs, so it's safe to call from a
 * `scroll`/`resize` listener without coalescing.
 */
function recomputeFades(): void {
  const el = weekGridRef.value
  if (!el) {
    showLeftFade.value = false
    showRightFade.value = false
    return
  }
  // `scrollLeft` > 0 means the user has moved away from the left
  // edge, so the left edge is no longer under the gradient — show
  // a fade so they know they can scroll back.
  showLeftFade.value = el.scrollLeft > 4
  // `scrollLeft + clientWidth < scrollWidth - threshold` means there
  // is hidden content to the right. The 4px tolerance matches the
  // snap container's snap tolerance on iOS / Android, where a
  // pixel-perfect scroll can leave 1-2px un-scrolled even when the
  // snap point says "fully right".
  showRightFade.value =
    el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

let scrollListenerBound = false
function bindScrollListeners(): void {
  if (scrollListenerBound) return
  scrollListenerBound = true
  window.addEventListener('resize', recomputeFades, { passive: true })
}
function unbindScrollListeners(): void {
  if (!scrollListenerBound) return
  scrollListenerBound = false
  window.removeEventListener('resize', recomputeFades)
}

watch(weekGridRef, (el, prev) => {
  if (prev) prev.removeEventListener('scroll', recomputeFades)
  if (el) {
    el.addEventListener('scroll', recomputeFades, { passive: true })
    // Run once after mount in case the grid is initially overflowing
    // (e.g. on mobile) so the fades show up immediately rather than
    // after the first user scroll.
    nextTick().then(recomputeFades)
  }
})

onMounted(() => {
  bindScrollListeners()
  recomputeFades()
})

onBeforeUnmount(() => {
  unbindScrollListeners()
  const el = weekGridRef.value
  if (el) el.removeEventListener('scroll', recomputeFades)
})

/**
 * Expose `currentDayLabel` to the parent (App.vue) so the toolbar
 * `WeekNavigation` can render the today-orientation pill. Spec §8.
 * No other internals are exposed — the parent's existing emit
 * contract remains the only way to drive mutations.
 */
defineExpose({ currentDayLabel })

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

/**
 * Re-scroll whenever the user explicitly clicks Today, including the
 * case where they're already in today's week. The watch on
 * `currentWeekStart` above can't handle that case because Vue
 * watchers don't fire when the value is unchanged — the most common
 * manifestation is on mobile, where the seven-column grid overflows
 * horizontally and the user scrolls today offscreen, then taps the
 * toolbar's Today button expecting to be returned to today.
 *
 * The `n === 0` guard skips the initial value so mount-time scroll
 * is handled once by `onMounted` rather than twice.
 *
 * When the user clicks Today from a *different* week, this watcher
 * and the `currentWeekStart` watcher both fire — that's a duplicate
 * `scrollIntoView` call, but `scrollIntoView` is idempotent and the
 * scroll is instant (no `behavior: 'smooth'`), so there's no
 * visible flicker. Keeping both watchers means the prev/next path
 * (no Today click) still triggers the scroll without the trigger
 * having to be involved.
 */
watch(
  () => props.goToTodayTrigger,
  async (n) => {
    if (n === 0) return
    if (!isTodayInVisibleWeek()) return
    await nextTick()
    scrollTodayIntoView()
  },
)
</script>

<template>
  <div ref="weekGridRef" class="week-grid">
    <!--
      Edge fades (spec §8). Absolutely positioned overlays with a
      linear gradient so the column edges fade into the page
      background; `pointer-events: none` so they never intercept
      drag, tap, or scroll. Visibility is driven by the
      `showLeftFade` / `showRightFade` refs computed from the grid's
      current scroll position. The mobile negative margins on
      `.week-grid` (see style block) extend the fade past the
      viewport padding.
    -->
    <div
      class="grid-fade grid-fade-left"
      :class="{ visible: showLeftFade }"
      aria-hidden="true"
    ></div>
    <div
      class="grid-fade grid-fade-right"
      :class="{ visible: showRightFade }"
      aria-hidden="true"
    ></div>
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
      :month-marker="monthMarkerForDay(day.date)"
      :is-today="day.isToday"
      :is-past="day.isPast"
      :tasks="tasksForDay(day.date)"
      :projects="projectsMap"
      :properties="properties"
      :property-values="propertyValues"
      :day-note-value="noteForDay(day.date)"
      :pending-task-ids="pendingTaskIds"
    />
  </div>
</template>

<style scoped>
.week-grid {
  display: flex;
  gap: var(--space-3);
  flex-shrink: 0;
  overflow-x: auto;
  padding-bottom: var(--space-2);
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  min-height: 300px;
  margin-top: var(--space-6);
  /* Spec §8: position context for the absolute edge fades. */
  position: relative;
}

@media (max-width: 768px) {
  .week-grid {
    gap: var(--space-2);
    margin: 0 calc(-1 * var(--space-4));
    margin-top: var(--space-6);
    padding: 0 var(--space-4) var(--space-2) var(--space-4);
    min-height: 250px;
    /* Spec §11: a phone is part of a vertically-scrolling page;
     * mandatory horizontal snapping forces a diagonal swipe to
     * pick a side (it always snaps to a column boundary), so a
     * user mid-finger on a tall column sees the grid jump sideways
     * while they're trying to scroll the page down. `proximity`
     * keeps day-aligned positioning when the user *intends* a
     * horizontal flick (Today scroll-to-position still works
     * because `scroll-snap-align: start` on each column is
     * unchanged), but doesn't force it on every touch. */
    scroll-snap-type: x proximity;
  }
}

/* Edge fades (spec §8). Positioned inside the grid container so
 * they scroll with the content; the gradient extends into the
 * padding so on mobile the fade reaches the viewport edge even
 * when `.week-grid` carries negative horizontal margins. */
.grid-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 24px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 1;
}

.grid-fade.visible {
  opacity: 1;
}

.grid-fade-left {
  left: 0;
  background: linear-gradient(to right, var(--bg), transparent);
}

.grid-fade-right {
  right: 0;
  background: linear-gradient(to left, var(--bg), transparent);
}

/* On mobile the grid carries a negative margin; pull the right-edge
 * fade past the margin so the gradient reaches the viewport edge. */
@media (max-width: 768px) {
  .grid-fade-right {
    right: calc(-1 * var(--space-4));
  }
  .grid-fade-left {
    left: calc(-1 * var(--space-4));
  }
}
</style>
