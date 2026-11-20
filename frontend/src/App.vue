<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted, onUnmounted, reactive, watch } from 'vue'
import { provideDayActions } from './composables/useDayActions'
import { api, setSuccessMessage } from './api'
import { useAuth } from './composables/useAuth'
import { useTasks } from './composables/useTasks'
import { useProjects } from './composables/useProjects'
import { useProperties } from './composables/useProperties'
import { useNotes } from './composables/useNotes'
import { useTheme } from './composables/useTheme'
import { useI18n } from './composables/useI18n'
import { useWeekNavigation } from './composables/useWeekNavigation'
import { useTodayISO } from './composables/useTodayISO'
import {
  DEFAULT_WEEK_START,
  formatWeekDisplay,
  fromLocalISODate,
  getWeekStart,
  toLocalISODate,
} from './utils/date'
import { toJalaliYMD } from './utils/jalali'
import {
  clearManualCalendarOverride,
  loadManualCalendarOverride,
  resolveCalendarForLanguage,
  saveManualCalendarOverride,
} from './utils/calendarPreference'
import { initialSidebarCollapsed } from './utils/layout'
import type { Calendar, Language, Task, Project, Property, WeekStartDay } from './types'

import Header from './components/Header.vue'
import LoginPage from './components/LoginPage.vue'
import SetupWizard from './components/SetupWizard.vue'
import WeekNavigation from './components/WeekNavigation.vue'
import Sidebar from './components/Sidebar/Sidebar.vue'
import WeekView from './components/WeekView/WeekView.vue'
import DayView from './components/DayView/DayView.vue'
import WeekNotes from './components/Notes/WeekNotes.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import ErrorDisplay from './components/common/ErrorDisplay.vue'
import SuccessDisplay from './components/common/SuccessDisplay.vue'

/**
 * Modals are loaded lazily — they're rarely open, so paying their
 * compile + parse cost up-front is wasteful. `defineAsyncComponent`
 * pairs with the `manualChunks` rule in `vite.config.ts` to produce
 * a single `modals-*.js` chunk that's fetched the first time any
 * modal opens. The naming matches the static-import shape so the
 * template below doesn't need special handling.
 */
const TaskModal = defineAsyncComponent(() => import('./modals/TaskModal.vue'))
const ProjectModal = defineAsyncComponent(() => import('./modals/ProjectModal.vue'))
const PropertyModal = defineAsyncComponent(() => import('./modals/PropertyModal.vue'))
const MoveModal = defineAsyncComponent(() => import('./modals/MoveModal.vue'))
const DeleteConfirmModal = defineAsyncComponent(() => import('./modals/DeleteConfirmModal.vue'))
const ChangePasswordModal = defineAsyncComponent(
  () => import('./modals/ChangePasswordModal.vue'),
)

/* ------------------------------------------------------------------ */
/* Settings (week start, calendar)                                       */
/* ------------------------------------------------------------------ */

/**
 * The persisted start-of-week setting. Owned here because it's the
 * source of truth that the week navigation watches. `useWeekNavigation`
 * receives this ref and re-anchors `currentWeekStart` whenever the user
 * picks a different day.
 *
 * Seeded with the frontend's default so the first paint uses the same
 * convention as the backend default; the server value (loaded via
 * `api.getState()`) overwrites it once the data arrives.
 */
const weekStart = ref<WeekStartDay>(DEFAULT_WEEK_START)

/**
 * The active calendar is a display preference; dates remain stored as
 * Gregorian ISO. An explicit local manual choice takes precedence,
 * otherwise the active language supplies the default.
 */
const {
  language,
  setLanguage,
  t,
  translateText,
  formatDeleteProject,
  formatDeleteProperty,
} = useI18n()
const manualCalendarOverride = ref<Calendar | null>(loadManualCalendarOverride())
const calendar = ref<Calendar>(resolveCalendarForLanguage(language.value, manualCalendarOverride.value))

/* ------------------------------------------------------------------ */
/* Composables                                                          */
/* ------------------------------------------------------------------ */

const {
  currentWeekStart,
  weekDays,
  navigateWeek,
  goToToday,
  goToTodayTrigger,
} = useWeekNavigation(weekStart, calendar, language)
const { todayISO } = useTodayISO()

// `useProjects` / `useTasks` / `useProperties` / `useNotes` each expose a
// `load*` function, but `App.vue` uses `api.getState()` for the initial
// fetch (one round-trip instead of six) and then assigns directly into
// the refs returned by the composables. The composables are still useful
// here for the per-entity *mutations* (`addProject`, `updateTask`, etc.).
const { projects, addProject, updateProject, deleteProject } = useProjects()
const {
  tasks,
  addTask,
  updateTask,
  toggleTaskStatus,
  cancelTask,
  restoreTask,
  skipTask,
  unskipTask,
  deleteTask,
  moveTask,
} = useTasks()
const {
  properties,
  propertyValues,
  addProperty,
  updateProperty,
  deleteProperty,
  setPropertyValue,
} = useProperties()
const { dayNotes, weekNotes, setDayNote, setWeekNote } = useNotes()

/* ------------------------------------------------------------------ */
/* Theme (singleton accessed via useTheme)                              */
/* ------------------------------------------------------------------ */

/**
 * The theme composable owns its own `data-theme` attribute side-effect
 * (see `useTheme.initTheme` / `setTheme`); `App.vue` only needs the
 * `theme` ref to render the settings picker and the `setTheme` method
 * to react to the user's choice.
 */
const { theme, setTheme } = useTheme()

/* ------------------------------------------------------------------ */
/* Local UI state                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Auth state (singleton accessed via useAuth)                           */
/* ------------------------------------------------------------------ */

const auth = useAuth()

/* ------------------------------------------------------------------ */
/* Local UI state                                                       */
/* ------------------------------------------------------------------ */

const selectedProject = ref<string>('all')

const activeProject = computed<Project | undefined>(() =>
  projects.value.find(p => p.id === selectedProject.value),
)

const activeProjectName = computed<string>(() =>
  activeProject.value ? activeProject.value.name : selectedProject.value,
)

function clearProjectFilter(): void {
  selectedProject.value = 'all'
}

const sidebarCollapsed = ref<boolean>(true)

/** True while the initial data fetch is in flight (after auth resolves). */
const dataLoading = ref<boolean>(false)

/**
 * Guards the data-load watcher from re-running on subsequent
 * `isAuthenticated` flips (e.g. session-expired 401 → re-login).
 * Set to `true` **before** the async load so rapid auth flips can't
 * trigger a second load.
 */
const dataLoaded = ref<boolean>(false)

/** Board-level load error when the initial data fetch fails. */
const loadError = ref<string | null>(null)

/* ------------------------------------------------------------------ */
/* Modal state (per plan: modals & currently-edited entities live here) */
/* ------------------------------------------------------------------ */

const taskModalOpen = ref<boolean>(false)
const editingTask = ref<Task | null>(null)
const taskModalDate = ref<string>('')

const projectModalOpen = ref<boolean>(false)
const editingProject = ref<Project | null>(null)

const propertyModalOpen = ref<boolean>(false)
const editingProperty = ref<Property | null>(null)

const moveModalOpen = ref<boolean>(false)
const movingTask = ref<Task | null>(null)

const deleteModalOpen = ref<boolean>(false)
const deleteMessage = ref<string>('')

const changePasswordModalOpen = ref<boolean>(false)

/**
 * True if any modal dialog in the application is currently open.
 * Used to isolate Escape handling in day view so closing a modal
 * does not accidentally exit day view.
 */
const isAnyModalOpen = computed<boolean>(
  () =>
    taskModalOpen.value ||
    projectModalOpen.value ||
    propertyModalOpen.value ||
    moveModalOpen.value ||
    deleteModalOpen.value ||
    changePasswordModalOpen.value,
)
/**
 * The async delete action to run when the user confirms. Stored as a
 * closure rather than a discriminated union because both delete paths
 * (project / property) are simple side-effect sequences.
 */
let pendingDelete: (() => Promise<void>) | null = null

/* ------------------------------------------------------------------ */
/* Derived state                                                         */
/* ------------------------------------------------------------------ */

/**
 * Sum of every property over the seven days of the current week.
 *
 * Single-pass aggregation: we tally every property's weekly total in
 * one loop over `propertyValues`, then look up each property def's
 * `name`/`unit` from the resulting map. Cost is O(V + P) instead of
 * the previous O(V × P).
 */
const weeklyPropertySums = computed(() => {
  const dayStrs = new Set(weekDays.value.map(d => d.date))
  const sums = new Map<string, number>()
  for (const pv of propertyValues.value) {
    if (!dayStrs.has(pv.date)) continue
    sums.set(pv.propertyId, (sums.get(pv.propertyId) ?? 0) + pv.value)
  }
  return properties.value.map(prop => ({
    ...prop,
    sum: sums.get(prop.id) ?? 0,
  }))
})

/** Pre-formatted week display for the header. Honours the selected
 *  calendar — Jalali labels and day numbers when `calendar.value ===
 *  'jalali'`, Gregorian otherwise. */
const weekDisplay = computed<string>(() =>
  formatWeekDisplay(currentWeekStart.value, calendar.value, language.value),
)

/** Emphasize the displayed range when it contains today's local date. */
const isCurrentWeek = computed<boolean>(
  () =>
    currentWeekStart.value ===
    toLocalISODate(getWeekStart(fromLocalISODate(todayISO.value), weekStart.value)),
)

/** ISO dates for the visible week — used by `WeekSummary`. */
const weekDateStrings = computed<string[]>(() => weekDays.value.map(d => d.date))

/** Current week-note text for the `WeekNotes` component. */
const currentWeekNote = computed<string>(
  () => weekNotes.value.find(w => w.weekStart === currentWeekStart.value)?.note ?? '',
)

/* ------------------------------------------------------------------ */
/* Day view (single-day focus mode)                                     */
/* ------------------------------------------------------------------ */

/**
 * Which view is currently rendered in the main content area.
 * - `'week'` (default): the existing `WeekView` with 7 day columns.
 * - `'day'`: the focused single-day `DayView`.
 *
 * Not persisted across reloads — the default-on-load view is always
 * `'week'` so a returning user lands in the same layout they were
 * last editing.
 */
const viewMode = ref<'week' | 'day'>('week')

/**
 * The focused day when `viewMode === 'day'`. ISO date (`YYYY-MM-DD`).
 * Defaults to today so the first day-view entry has a sensible value
 * even before the user clicks a column header.
 */
const currentDay = ref<string>(toLocalISODate(new Date()))

/**
 * Header info for `DayView`, derived from `currentDay` and the
 * active calendar preference. Computed once per day / calendar
 * change so the title row updates without re-rendering the task
 * list / property inputs / notes.
 */
interface DayHeaderInfo {
  dayNum: number
  dayNumJalali?: number
}

const dayHeaderInfo = computed<DayHeaderInfo>(() => {
  const d = fromLocalISODate(currentDay.value)
  const info: DayHeaderInfo = {
    dayNum: d.getDate(),
  }
  if (calendar.value === 'jalali') {
    const j = toJalaliYMD(currentDay.value)
    info.dayNumJalali = j.jd
  }
  return info
})

/**
 * Pre-aggregated day summary for `DayView`'s summary line. Single
 * pass over `tasks` for status counts, single pass over
 * `propertyValues` for per-property totals. The cost is O(T + V)
 * instead of recomputing on every render of `DayView`.
 */
const daySummary = computed(() => {
  const counts = { active: 0, completed: 0, skipped: 0, cancelled: 0 }
  for (const t of tasks.value) {
    if (t.date !== currentDay.value) continue
    if (t.status === 'completed') counts.completed++
    else if (t.status === 'skipped') counts.skipped++
    else if (t.status === 'cancelled') counts.cancelled++
    else counts.active++
  }
  const valueByProp = new Map<string, number>()
  for (const pv of propertyValues.value) {
    if (pv.date !== currentDay.value) continue
    valueByProp.set(pv.propertyId, (valueByProp.get(pv.propertyId) ?? 0) + pv.value)
  }
  const propertyValuesForDay = properties.value.map(p => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    value: valueByProp.get(p.id) ?? 0,
  }))
  return { ...counts, propertyValues: propertyValuesForDay }
})

/**
 * Project lookup map for `DayView`. Same shape as `WeekView`'s so
 * the two views render `TaskCard` identically.
 */
const projectsMap = computed<Map<string, Project>>(
  () => new Map(projects.value.map(p => [p.id, p])),
)

/**
 * Day-note text for `currentDay`, pre-resolved so `DayView` doesn't
 * have to filter `dayNotes` on every render.
 */
const currentDayNote = computed<string>(
  () => dayNotes.value.find(d => d.date === currentDay.value)?.note ?? '',
)

/**
 * Open day view for a date. Called from `WeekView`'s `open-day`
 * emit (a user clicked a column header).
 */
function openDayView(date: string): void {
  currentDay.value = date
  viewMode.value = 'day'
}

/**
 * Close day view and re-anchor the week to the focused day. The
 * week anchor matters: without it the user would return to whatever
 * week they were last in (which could be weeks ago if they drilled
 * through several days), losing context.
 *
 * `getWeekStart(date, weekStart)` returns the ISO of the day-of-week
 * the user's settings consider the start of the week. We re-set
 * `currentWeekStart` to that value so the week view snaps to the
 * week containing `currentDay`.
 */
function closeDayView(): void {
  viewMode.value = 'week'
  currentWeekStart.value = toLocalISODate(
    getWeekStart(fromLocalISODate(currentDay.value), weekStart.value),
  )
}

/**
 * Shift `currentDay` by `dir` days. Uses the same `setDate` pattern
 * as `useWeekNavigation#navigateWeek` so month/year boundaries
 * wrap automatically.
 */
function navigateDay(dir: number): void {
  const d = fromLocalISODate(currentDay.value)
  d.setDate(d.getDate() + dir)
  currentDay.value = toLocalISODate(d)
}

/**
 * Jump `currentDay` directly to a picked date (from the
 * `DatePickerPopover`). Mirrors `openDayView` but for the date
 * picker path.
 */
function jumpToDay(date: string): void {
  currentDay.value = date
}

/**
 * Toolbar Today button when in day view. Jumps `currentDay` to today
 * and increments `goToTodayTrigger` so `WeekView`'s auto-scroll
 * still fires once the user returns to week view (the
 * `currentWeekStart` watcher is silent in that case, but the trigger
 * watcher is not).
 */
function goToDayToday(): void {
  currentDay.value = toLocalISODate(new Date())
  goToTodayTrigger.value++
}

/* ------------------------------------------------------------------ */
/* Today button dispatch                                                */
/* ------------------------------------------------------------------ */

/**
 * Route the Header's Today click based on the active view. In week
 * view this is the existing `goToToday()` (which sets
 * `currentWeekStart` to today's week). In day view it sets
 * `currentDay` to today instead. The Header itself stays mode-agnostic;
 * the dispatch lives here in App.vue where the view state is owned.
 */
function handleGoToday(): void {
  if (viewMode.value === 'day') {
    goToDayToday()
  } else {
    goToToday()
  }
}

/* ------------------------------------------------------------------ */
/* Esc handler                                                          */
/* ------------------------------------------------------------------ */

/**
 * Window-level `keydown` listener for Esc, mounted only while in
 * day view. The `DatePickerPopover` (when open) and `Modal` (when open)
 * handle their own Esc with `stopPropagation()` so this listener doesn't
 * fire while a modal or popover is closing — pressing Esc twice is the
 * documented flow: first Esc closes the modal/popover, second Esc closes
 * day view. We also check `isAnyModalOpen` to ensure day view is preserved.
 */
function handleDocumentKeydown(e: KeyboardEvent): void {
  if (isAnyModalOpen.value) return
  if (viewMode.value === 'day' && e.key === 'Escape') {
    closeDayView()
  }
}

/**
 * Dynamically attach/detach the Esc listener based on `viewMode`.
 * When entering day view, we add the keydown listener. When leaving,
 * we remove it. This aligns with the original design intention.
 */
watch(viewMode, (newMode) => {
  if (newMode === 'day') {
    document.addEventListener('keydown', handleDocumentKeydown)
  } else {
    document.removeEventListener('keydown', handleDocumentKeydown)
  }
})

/* ------------------------------------------------------------------ */
/* Sidebar / layout                                                      */
/* ------------------------------------------------------------------ */

function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeSidebar(): void {
  sidebarCollapsed.value = true
}

/**
 * Persist a new start-of-week setting and reflect it locally so the
 * week view re-anchors immediately. The local update happens first so
 * the UI doesn't lag behind the network round-trip; the PUT is
 * fire-and-forget — a failed write leaves the local setting in place
 * and surfaces the error through `apiError` (handled in `api.ts`).
 */
async function changeWeekStart(day: WeekStartDay): Promise<void> {
  const previous = weekStart.value
  weekStart.value = day
  try {
    await api.updateSettings({ weekStart: day, calendar: calendar.value })
  } catch {
    // `api.ts` already populated `apiError`. Revert the local setting
    // so the UI matches what's on disk on the next reload.
    weekStart.value = previous
  }
}

/**
 * Persist a new calendar preference and reflect it locally so the
 * header / day columns repaint immediately. Mirrors `changeWeekStart`:
 * local update first, then the PUT, revert on failure.
 */
async function changeLanguage(next: Language): Promise<void> {
  if (next === language.value) return
  setLanguage(next)
  const nextCalendar = resolveCalendarForLanguage(next, manualCalendarOverride.value)
  if (nextCalendar === calendar.value) return

  calendar.value = nextCalendar
  if (dataLoaded.value) {
    try {
      await api.updateSettings({ weekStart: weekStart.value, calendar: nextCalendar })
    } catch {
      // Keep the locale and calendar choice in the UI; api.ts exposes the error.
    }
  }
}

async function changeCalendar(c: Calendar): Promise<void> {
  const previousCalendar = calendar.value
  const previousOverride = manualCalendarOverride.value
  calendar.value = c
  manualCalendarOverride.value = c
  saveManualCalendarOverride(c)
  try {
    await api.updateSettings({ weekStart: weekStart.value, calendar: c })
  } catch {
    // Roll back both persisted and in-memory manual choice with the displayed value.
    calendar.value = previousCalendar
    manualCalendarOverride.value = previousOverride
    if (previousOverride === null) clearManualCalendarOverride()
    else saveManualCalendarOverride(previousOverride)
  }
}

/* ------------------------------------------------------------------ */
/* Task actions                                                          */
/* ------------------------------------------------------------------ */

function openTaskModal(date: string, task?: Task): void {
  taskModalDate.value = date
  editingTask.value = task ?? null
  taskModalOpen.value = true
}

async function saveTask(payload: {
  id?: string
  title: string
  description: string
  projectId: string
  date: string
}): Promise<void> {
  if (payload.id) {
    await updateTask(payload.id, {
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId,
      date: payload.date,
    })
  } else {
    await addTask({
      title: payload.title,
      description: payload.description,
      projectId: payload.projectId,
      date: payload.date,
    })
  }
  taskModalOpen.value = false
}

function handleEditTask(task: Task): void {
  openTaskModal(task.date, task)
}

function handleMoveTask(task: Task): void {
  movingTask.value = task
  moveModalOpen.value = true
}

async function executeMove(task: Task, date: string): Promise<void> {
  await moveTask(task, date)
  moveModalOpen.value = false
}

async function updateTaskNotes(task: Task, notes: string): Promise<void> {
  await updateTask(task.id, { notes })
}

/* ------------------------------------------------------------------ */
/* Drag-and-drop                                                         */
/* ------------------------------------------------------------------ */

/**
 * Task IDs whose `updateTask` call is currently in flight (spec §14).
 * Passed down to `WeekView` so each `DayColumn` can render its
 * `TaskCard` in a pending state — the save is slow / dropped / failed
 * until the ID leaves the set. The optimistic local value is already
 * reconciled by `useTasks.updateTask`, so this is purely presentation.
 */
const pendingTaskIds = reactive(new Set<string>())

/**
 * Spec §22: single typed seam for every day- and task-level action
 * consumed by `DayView` / `WeekView` / `DayColumn` / `DayNotes` /
 * `TaskCard`. The methods are thin wrappers around the existing
 * handlers — no business logic moves here. `provide()`ing the
 * object lets every descendant consume it via `useDayActions()`
 * instead of bouncing events up the tree.
 */
provideDayActions({
  addTask: openTaskModal,
  openDay: openDayView,
  updateDayNote,
  updatePropertyValue,
  dropTask: onDropTask,
  editTask: handleEditTask,
  moveTask: handleMoveTask,
  toggleTaskStatus: toggleTaskStatus,
  cancelTask: cancelTask,
  restoreTask: restoreTask,
  skipTask: skipTask,
  unskipTask: unskipTask,
  deleteTask: deleteTask,
  updateTaskNotes,
})

async function onDropTask(event: DragEvent, date: string): Promise<void> {
  event.preventDefault()
  const taskId = event.dataTransfer?.getData('text/plain')
  if (!taskId) return
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return
  pendingTaskIds.add(taskId)
  try {
    await updateTask(task.id, { date })
  } finally {
    pendingTaskIds.delete(taskId)
  }
}

/* ------------------------------------------------------------------ */
/* Day notes / property values                                           */
/* ------------------------------------------------------------------ */

async function updateDayNote(date: string, note: string): Promise<void> {
  await setDayNote(date, note)
}

async function updatePropertyValue(
  date: string,
  propertyId: string,
  value: number,
): Promise<void> {
  await setPropertyValue(date, propertyId, value)
}

async function updateWeekNote(_weekStart: string, note: string): Promise<void> {
  await setWeekNote(currentWeekStart.value, note)
}

/* ------------------------------------------------------------------ */
/* Project modal                                                          */
/* ------------------------------------------------------------------ */

function openProjectModal(project?: Project): void {
  editingProject.value = project ?? null
  projectModalOpen.value = true
}

async function saveProject(payload: {
  id?: string
  name: string
  color: string
}): Promise<void> {
  if (payload.id) {
    await updateProject(payload.id, { name: payload.name, color: payload.color })
  } else {
    await addProject({ name: payload.name, color: payload.color })
  }
  projectModalOpen.value = false
}

function confirmDeleteProject(project: Project): void {
  const taskCount = tasks.value.filter(t => t.projectId === project.id).length
  deleteMessage.value = formatDeleteProject(project.name, taskCount)
  pendingDelete = async () => {
    await deleteProject(project, tasks.value)
  }
  projectModalOpen.value = false
  deleteModalOpen.value = true
}

/* ------------------------------------------------------------------ */
/* Property modal                                                         */
/* ------------------------------------------------------------------ */

function openPropertyModal(property?: Property): void {
  editingProperty.value = property ?? null
  propertyModalOpen.value = true
}

async function saveProperty(payload: {
  id?: string
  name: string
  unit: string
}): Promise<void> {
  if (payload.id) {
    await updateProperty(payload.id, { name: payload.name, unit: payload.unit })
  } else {
    await addProperty({ name: payload.name, unit: payload.unit })
  }
  propertyModalOpen.value = false
}

function confirmDeleteProperty(property: Property): void {
  deleteMessage.value = formatDeleteProperty(property.name)
  pendingDelete = async () => {
    await deleteProperty(property)
  }
  propertyModalOpen.value = false
  deleteModalOpen.value = true
}

async function executeDelete(): Promise<void> {
  if (pendingDelete) {
    await pendingDelete()
    pendingDelete = null
  }
  deleteModalOpen.value = false
}

/* ------------------------------------------------------------------ */
/* Lazy-loaded components                                                 */
/* ------------------------------------------------------------------ */

/**
 * `WeekSummary` aggregates the whole week — useful, but heavy enough
 * that we don't want it to compete with the first paint. We mount it
 * lazily, after `requestIdleCallback` (or `setTimeout` on browsers
 * that lack support). The `import()` is statically analysable, so
 * Vite emits a separate chunk for `WeekSummary.vue`.
 */
const WeekSummary = defineAsyncComponent(
  () => import('./components/WeekSummary.vue'),
)
const showWeekSummary = ref<boolean>(false)

/**
 * Run `task` during a browser idle slot, falling back to a short
 * `setTimeout` for environments that lack `requestIdleCallback`
 * (Safari). The fallback is short — the goal is just to get past
 * first paint, not to hit a specific idle frame.
 */
function scheduleIdle(task: () => void): void {
  const win = window as unknown as {
    requestIdleCallback?: (cb: () => void) => void
  }
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(() => task())
  } else {
    window.setTimeout(task, 150)
  }
}

/* ------------------------------------------------------------------ */
/* Initial data load (triggered after auth resolves)                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch the full app state. Called once, after `isAuthenticated` flips
 * to `true`. Uses the same one-round-trip `api.getState()` pattern as
 * before; the `dataLoaded` guard prevents re-runs on session expiry /
 * re-login cycles.
 */
async function loadData(): Promise<void> {
  dataLoading.value = true
  loadError.value = null
  try {
    const state = await api.getState()
    projects.value = state.projects
    tasks.value = state.tasks
    properties.value = state.properties
    propertyValues.value = state.propertyValues
    dayNotes.value = state.dayNotes
    weekNotes.value = state.weekNotes
    // Adopt the persisted week-start. The composable's `watch` on
    // `weekStart` will re-anchor `currentWeekStart` automatically.
    weekStart.value = state.settings.weekStart
    const resolvedCalendar = resolveCalendarForLanguage(language.value, manualCalendarOverride.value)
    calendar.value = resolvedCalendar
    if (state.settings.calendar !== resolvedCalendar) {
      try {
        await api.updateSettings({ weekStart: weekStart.value, calendar: resolvedCalendar })
      } catch {
        // Locale-derived calendar remains active even if server sync fails.
      }
    }

    // Seed an empty board with a default project so the user has
    // somewhere to attach the first task.
    if (projects.value.length === 0) {
      const project = await api.createProject({
        id: '',
        name: t('General'),
        color: '#E74C3C',
      })
      projects.value.push(project)
    }
    dataLoaded.value = true
  } catch (err) {
    loadError.value = translateText('Could not load planner')
    dataLoaded.value = false
    // `api.ts` already sets `apiError`; we just log for devtools.
    // eslint-disable-next-line no-console
    console.error('Failed to load data:', err)
  } finally {
    dataLoading.value = false
    // Wait until after the first paint to start pulling the
    // `WeekSummary` chunk — keeps the initial render from competing
    // with the chunk download.
    if (!loadError.value) {
      scheduleIdle(() => {
        showWeekSummary.value = true
      })
    }
  }
}

/**
 * Retry loading the board data after a failed load.
 * Resets the `dataLoaded` guard and initiates a new fetch.
 */
async function retryLoad(): Promise<void> {
  dataLoaded.value = false
  await loadData()
}

/**
 * Watch `isAuthenticated` and kick off the data fetch once the user
 * is authenticated. `dataLoaded` is set **before** the async work
 * so rapid auth flips don't trigger duplicate loads.
 */
watch(
  () => auth.isAuthenticated,
  async (isAuth) => {
    if (isAuth && !dataLoaded.value) {
      dataLoaded.value = true
      await loadData()
    }
  },
  { immediate: true },
)

/* ------------------------------------------------------------------ */
/* Browser-only UI setup                                                  */
/* ------------------------------------------------------------------ */

onMounted(() => {
  // Spec §23: start with the sidebar collapsed whenever a full
  // 7-column week at the 176px column floor wouldn't fit (<1632px).
  // Below 1024px the sidebar is an overlay anyway. The user can
  // still open it — the grid then scrolls horizontally and the §8
  // edge fades signal the overflow. Mount-time only, as before.
  sidebarCollapsed.value = initialSidebarCollapsed(window.innerWidth)
  // Window-level Esc listener for day view. We'll bind it only
  // when `viewMode` is `'day'` and clean up when leaving day view.
  // The actual listener registration is handled via a watch on
  // `viewMode` below.

})

onUnmounted(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
})

async function handleLogout(): Promise<void> {
  try {
    await auth.logout()
  } catch {
    // Silent: session might already be dead on the server,
    // but the local auth state flip still triggers the route
    // guard swap back to LoginPage.
  }
}

/**
 * Open the Change Password modal in response to the Header's settings
 * menu. The change-password endpoint does NOT invalidate the session,
 * so we leave the auth state untouched — the modal just closes and
 * the success toast confirms the change.
 */
function openChangePasswordModal(): void {
  changePasswordModalOpen.value = true
}

function closeChangePasswordModal(): void {
  changePasswordModalOpen.value = false
}

/**
 * Called by the modal after a successful password change. We close
 * the modal and surface a transient success toast. The success toast
 * is owned by `SuccessDisplay.vue` watching `successMessage` in
 * `api.ts` — auto-dismisses after a few seconds.
 */
function handlePasswordChanged(): void {
  changePasswordModalOpen.value = false
  setSuccessMessage(translateText('Password changed successfully.'))
}
</script>

<template>
  <ErrorBoundary>
    <!-- 1. Auth check failed -->
    <div v-if="auth.error !== null" class="loading">
      <p>{{ t('The planner is not responding. Try again?') }}</p>
      <button class="btn btn-primary" type="button" @click="auth.retryStatus()">
        {{ t('Retry') }}
      </button>
    </div>

    <!-- 2. Auth check in flight -->
    <div v-else-if="auth.loading" class="loading">
      <p>{{ t('Opening planner…') }}</p>
    </div>

    <!-- 3. Auth resolved, unauthenticated -->
    <div v-else-if="!auth.isAuthenticated">
      <SetupWizard v-if="auth.setupRequired" />
      <LoginPage v-else />
    </div>

    <!-- 4. Authenticated, data loading -->
    <div v-else-if="dataLoading" class="loading">
      <p>{{ t('Opening planner…') }}</p>
    </div>

    <!-- 5. Board load error -->
    <div v-else-if="loadError" class="board-error" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" class="btn btn-primary retry-btn" @click="retryLoad">
        {{ t('Retry') }}
      </button>
    </div>

    <!-- 6. Authenticated, data loaded -->
    <div v-else class="app">
      <Header
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="toggleSidebar"
        @go-today="handleGoToday"
        @logout="handleLogout"
        @change-password="openChangePasswordModal"
      />

      <div class="main-container">
        <Sidebar
          :collapsed="sidebarCollapsed"
          :projects="projects"
          :properties="properties"
          :tasks="tasks"
          :selected-project="selectedProject"
          :weekly-property-sums="weeklyPropertySums"
          :theme="theme"
          :week-start="weekStart"
          :calendar="calendar"
          :language="language"
          @select-project="selectedProject = $event"
          @add-project="openProjectModal()"
          @edit-project="openProjectModal"
          @add-property="openPropertyModal()"
          @edit-property="openPropertyModal"
          @change-theme="setTheme"
          @change-week-start="changeWeekStart"
          @change-calendar="changeCalendar"
          @change-language="changeLanguage"
        />

        <div
          v-if="!sidebarCollapsed"
          class="sidebar-backdrop"
          @click="closeSidebar"
        ></div>

        <main class="week-container">
          <div
            v-if="selectedProject !== 'all'"
            class="project-filter-indicator active-filter-indicator"
          >
            <div class="filter-indicator-content">
              <span
                v-if="activeProject?.color"
                class="filter-indicator-dot"
                :style="{ backgroundColor: activeProject.color }"
                aria-hidden="true"
              ></span>
              <span class="filter-indicator-label">{{ t('Filtered by:') }}</span>
              <strong class="filter-indicator-name">{{ activeProjectName }}</strong>
            </div>
            <button
              type="button"
              class="clear-filter-btn"
              :aria-label="t('Clear filter')"
              @click="clearProjectFilter"
            >
              {{ t('Clear filter') }}
            </button>
          </div>

          <!--
            `WeekNavigation` is only meaningful in week view; it's
            hidden in day view because day view has its own header
            (back button + prev/next-day chevrons).
          -->
          <WeekNavigation
            v-if="viewMode === 'week'"
            :week-display="weekDisplay"
            :is-current-week="isCurrentWeek"
            @prev-week="navigateWeek(-1)"
            @next-week="navigateWeek(1)"
          />

          <WeekView
            v-if="viewMode === 'week'"
            :current-week-start="currentWeekStart"
            :tasks="tasks"
            :projects="projects"
            :properties="properties"
            :property-values="propertyValues"
            :day-notes="dayNotes"
            :selected-project="selectedProject"
            :calendar="calendar"
            :go-to-today-trigger="goToTodayTrigger"
            :pending-task-ids="pendingTaskIds"
          />

          <!--
            DayView is mounted only when in day view. It reuses the
            same entity-event handlers as WeekView (add-task, edit-
            task, etc.) so the data flow is identical; the
            additional emits (back-to-week, prev-day, next-day,
            navigate-day) drive App.vue's view-mode state.
          -->
          <DayView
            v-else
            :date="currentDay"
            :day-num="dayHeaderInfo.dayNum"
            :day-num-jalali="dayHeaderInfo.dayNumJalali"
            :tasks="tasks"
            :projects="projectsMap"
            :properties="properties"
            :property-values="propertyValues"
            :day-note-value="currentDayNote"
            :selected-project="selectedProject"
            :calendar="calendar"
            :summary="daySummary"
            @back-to-week="closeDayView"
            @prev-day="navigateDay(-1)"
            @next-day="navigateDay(1)"
            @navigate-day="jumpToDay"
            @add-task="openTaskModal"
            @edit-task="handleEditTask"
            @move-task="handleMoveTask"
            @toggle-task-status="toggleTaskStatus"
            @cancel-task="cancelTask"
            @restore-task="restoreTask"
            @delete-task="deleteTask"
            @update-task-notes="updateTaskNotes"
            @update-day-note="updateDayNote"
            @update-property-value="updatePropertyValue"
            @drop-task="onDropTask"
          />

          <WeekNotes
            v-if="viewMode === 'week'"
            :week-start="currentWeekStart"
            :initial-value="currentWeekNote"
            @update="updateWeekNote"
          />

          <WeekSummary
            v-if="viewMode === 'week' && showWeekSummary"
            :tasks="tasks"
            :week-date-strings="weekDateStrings"
            :properties="weeklyPropertySums"
          />
        </main>
      </div>

      <TaskModal
        :show="taskModalOpen"
        :task="editingTask"
        :projects="projects"
        :date="taskModalDate"
        :calendar="calendar"
        :default-project-id="selectedProject !== 'all' ? selectedProject : ''"
        @close="taskModalOpen = false"
        @save="saveTask"
      />

      <ProjectModal
        :show="projectModalOpen"
        :project="editingProject"
        @close="projectModalOpen = false"
        @save="saveProject"
        @delete="confirmDeleteProject"
      />

      <PropertyModal
        :show="propertyModalOpen"
        :property="editingProperty"
        @close="propertyModalOpen = false"
        @save="saveProperty"
        @delete="confirmDeleteProperty"
      />

      <MoveModal
        :show="moveModalOpen"
        :task="movingTask"
        :calendar="calendar"
        @close="moveModalOpen = false"
        @move="executeMove"
      />

      <DeleteConfirmModal
        :show="deleteModalOpen"
        :message="deleteMessage"
        @close="deleteModalOpen = false"
        @confirm="executeDelete"
      />

      <ChangePasswordModal
        :show="changePasswordModalOpen"
        @close="closeChangePasswordModal"
        @change="handlePasswordChanged"
      />
    </div>
  </ErrorBoundary>
  <ErrorDisplay />
  <SuccessDisplay />
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  height: 100dvh;
  overflow: hidden;
}

.main-container {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  z-index: 140;
}

.week-container {
  flex: 1;
  min-height: 0;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1.2rem;
  color: var(--text-secondary);
}

.board-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: var(--space-4);
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.board-error p {
  margin: var(--space-0);
  color: var(--text-primary);
}

.project-filter-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-sm);
}

.filter-indicator-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
}

.filter-indicator-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.filter-indicator-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.filter-indicator-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clear-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1) var(--space-3);
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  flex-shrink: 0;
}

.clear-filter-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent);
  background: var(--accent-light);
}

.clear-filter-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media (max-width: 1024px) {
  .sidebar-backdrop {
    display: block;
    height: 100dvh;
  }
}

@media (max-width: 768px) {
  .board-error {
    padding: var(--space-4);
  }

  .week-container {
    padding: var(--space-4);
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .project-filter-indicator {
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .clear-filter-btn {
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
  }
}
</style>
