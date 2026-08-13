<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { api } from './api'
import { useTasks } from './composables/useTasks'
import { useProjects } from './composables/useProjects'
import { useProperties } from './composables/useProperties'
import { useNotes } from './composables/useNotes'
import { useWeekNavigation } from './composables/useWeekNavigation'
import { DEFAULT_WEEK_START, formatWeekDisplay } from './utils/date'
import type { Calendar, Task, Project, Property, WeekStartDay } from './types'

import Header from './components/Header.vue'
import Sidebar from './components/Sidebar/Sidebar.vue'
import WeekView from './components/WeekView/WeekView.vue'
import WeekNotes from './components/Notes/WeekNotes.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import ErrorDisplay from './components/common/ErrorDisplay.vue'

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
/* Local UI state                                                       */
/* ------------------------------------------------------------------ */

const selectedProject = ref<string>('all')
const sidebarCollapsed = ref<boolean>(true)
const loading = ref<boolean>(true)

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
/* Initial data load                                                      */
/* ------------------------------------------------------------------ */

onMounted(async () => {
  // Collapse sidebar on small viewports by default — most users will
  // not need it visible when they first open the app on mobile.
  sidebarCollapsed.value = window.innerWidth <= 1024

  try {
    // One round-trip instead of six — `getState` returns the entire
    // graph in a single payload.
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
    loading.value = false
    // Wait until after the first paint to start pulling the
    // `WeekSummary` chunk — keeps the initial render from competing
    // with the chunk download.
    scheduleIdle(() => {
      showWeekSummary.value = true
    })
  }
})
</script>

<template>
  <ErrorBoundary>
    <div v-if="!loading" class="app">
      <Header
        :week-display="weekDisplay"
        :sidebar-collapsed="sidebarCollapsed"
        @toggle-sidebar="toggleSidebar"
        @prev-week="navigateWeek(-1)"
        @next-week="navigateWeek(1)"
        @go-today="goToToday"
      />

      <div class="main-container">
        <Sidebar
          :collapsed="sidebarCollapsed"
          :projects="projects"
          :properties="properties"
          :tasks="tasks"
          :selected-project="selectedProject"
          :weekly-property-sums="weeklyPropertySums"
          :week-start="weekStart"
          :calendar="calendar"
          @select-project="selectedProject = $event"
          @add-project="openProjectModal()"
          @add-property="openPropertyModal()"
          @change-week-start="changeWeekStart"
          @change-calendar="changeCalendar"
        />

        <div
          v-if="!sidebarCollapsed"
          class="sidebar-backdrop"
          @click="closeSidebar"
        ></div>

        <main class="week-container">
          <WeekView
            :current-week-start="currentWeekStart"
            :tasks="tasks"
            :projects="projects"
            :properties="properties"
            :property-values="propertyValues"
            :day-notes="dayNotes"
            :selected-project="selectedProject"
            :calendar="calendar"
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
            :week-start="currentWeekStart"
            :initial-value="currentWeekNote"
            @update="updateWeekNote"
          />

          <WeekSummary
            v-if="showWeekSummary"
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
    </div>

    <div v-else class="loading">
      <p>Loading...</p>
    </div>
  </ErrorBoundary>
  <ErrorDisplay />
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
  background: rgba(0, 0, 0, 0.5);
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
