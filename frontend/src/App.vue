<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted, onUnmounted, watch } from 'vue'
import { api, setSuccessMessage } from './api'
import { useAuth } from './composables/useAuth'
import { useTasks } from './composables/useTasks'
import { useProjects } from './composables/useProjects'
import { useProperties } from './composables/useProperties'
import { useNotes } from './composables/useNotes'
import { useTheme } from './composables/useTheme'
import { useWeekNavigation } from './composables/useWeekNavigation'
import {
  DEFAULT_WEEK_START,
  formatDayTitle,
  formatWeekDisplay,
  fromLocalISODate,
  getWeekStart,
  toLocalISODate,
} from './utils/date'
import { JALALI_MONTH_LABELS, toJalaliYMD } from './utils/jalali'
import type { Calendar, Task, Project, Property, WeekStartDay } from './types'

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
 * The persisted calendar preference. Owned here so the week
 * navigation, the header, and the day columns can all react to a
 * single source of truth. Switching calendars is purely a display
 * concern — storage stays Gregorian ISO. Seeded with the
 * frontend's default to match the backend.
 */
const calendar = ref<Calendar>('gregorian')

/* ------------------------------------------------------------------ */
/* Composables                                                          */
/* ------------------------------------------------------------------ */

const {
  currentWeekStart,
  weekDays,
  navigateWeek,
  goToToday,
  goToTodayTrigger,
} = useWeekNavigation(weekStart, calendar)

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
  formatWeekDisplay(currentWeekStart.value, calendar.value),
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
  title: string
  dayNum: number
  dayNumJalali?: number
  monthLabelJalali?: string
}

const dayHeaderInfo = computed<DayHeaderInfo>(() => {
  const d = fromLocalISODate(currentDay.value)
  const info: DayHeaderInfo = {
    title: formatDayTitle(currentDay.value, calendar.value),
    dayNum: d.getDate(),
  }
  if (calendar.value === 'jalali') {
    const j = toJalaliYMD(currentDay.value)
    info.dayNumJalali = j.jd
    info.monthLabelJalali = JALALI_MONTH_LABELS[j.jm - 1] ?? ''
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
  const counts = { active: 0, completed: 0, cancelled: 0 }
  for (const t of tasks.value) {
    if (t.date !== currentDay.value) continue
    if (t.status === 'completed') counts.completed++
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
 * day view. The `DatePickerPopover` (when open) handles its own Esc
 * with `stopPropagation()` so this listener doesn't fire while the
 * popover is closing — pressing Esc twice is the documented flow:
 * first Esc closes the popover, second Esc closes day view.
 */
function handleDocumentKeydown(e: KeyboardEvent): void {
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
async function changeCalendar(c: Calendar): Promise<void> {
  const previous = calendar.value
  calendar.value = c
  try {
    await api.updateSettings({ weekStart: weekStart.value, calendar: c })
  } catch {
    // `api.ts` already populated `apiError`. Revert the local setting
    // so the UI matches what's on disk on the next reload.
    calendar.value = previous
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

async function onDropTask(event: DragEvent, date: string): Promise<void> {
  event.preventDefault()
  const taskId = event.dataTransfer?.getData('text/plain')
  if (!taskId) return
  const task = tasks.value.find(t => t.id === taskId)
  if (!task) return
  await updateTask(task.id, { date })
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
  deleteMessage.value =
    taskCount > 0
      ? `Delete "${project.name}"? ${taskCount} tasks will be moved to no project.`
      : `Delete "${project.name}"?`
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
  deleteMessage.value = `Delete "${property.name}"? All values will be removed.`
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
    calendar.value = state.settings.calendar

    // Seed an empty board with a default project so the user has
    // somewhere to attach the first task.
    if (projects.value.length === 0) {
      const project = await api.createProject({
        id: '',
        name: 'General',
        color: '#E74C3C',
      })
      projects.value.push(project)
    }
  } catch (err) {
    // `api.ts` already sets `apiError`; we just log for devtools.
    // eslint-disable-next-line no-console
    console.error('Failed to load data:', err)
  } finally {
    dataLoading.value = false
    // Wait until after the first paint to start pulling the
    // `WeekSummary` chunk — keeps the initial render from competing
    // with the chunk download.
    scheduleIdle(() => {
      showWeekSummary.value = true
    })
  }
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
  // Collapse sidebar on small viewports by default — most users will
  // not need it visible when they first open the app on mobile.
  sidebarCollapsed.value = window.innerWidth <= 1024
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
  setSuccessMessage('Password changed successfully.')
}
</script>

<template>
  <ErrorBoundary>
    <!-- 1. Auth check failed -->
    <div v-if="auth.error !== null" class="loading">
      <p>Couldn't reach server.</p>
      <button class="btn btn-primary" type="button" @click="auth.retryStatus()">
        Retry
      </button>
    </div>

    <!-- 2. Auth check in flight -->
    <div v-else-if="auth.loading" class="loading">
      <p>Loading…</p>
    </div>

    <!-- 3. Auth resolved, unauthenticated -->
    <div v-else-if="!auth.isAuthenticated">
      <SetupWizard v-if="auth.setupRequired" />
      <LoginPage v-else />
    </div>

    <!-- 4. Authenticated, data loading -->
    <div v-else-if="dataLoading" class="loading">
      <p>Loading…</p>
    </div>

    <!-- 5. Authenticated, data loaded -->
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
          @select-project="selectedProject = $event"
          @add-project="openProjectModal()"
          @add-property="openPropertyModal()"
          @change-theme="setTheme"
          @change-week-start="changeWeekStart"
          @change-calendar="changeCalendar"
        />

        <div
          v-if="!sidebarCollapsed"
          class="sidebar-backdrop"
          @click="closeSidebar"
        ></div>

        <main class="week-container">
          <!--
            `WeekNavigation` is only meaningful in week view; it's
            hidden in day view because day view has its own header
            (back button + prev/next-day chevrons).
          -->
          <WeekNavigation
            v-if="viewMode === 'week'"
            :week-display="weekDisplay"
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
            @add-task="openTaskModal"
            @open-day="openDayView"
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
            :title="dayHeaderInfo.title"
            :day-num="dayHeaderInfo.dayNum"
            :day-num-jalali="dayHeaderInfo.dayNumJalali"
            :month-label-jalali="dayHeaderInfo.monthLabelJalali"
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
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: calc(100vh - 73px);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1.2rem;
  color: var(--text-secondary);
}

@media (max-width: 1024px) {
  .sidebar-backdrop {
    display: block;
    height: 100dvh;
  }
}

@media (max-width: 768px) {
  .week-container {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
    height: calc(100dvh - 73px);
  }
}
</style>
