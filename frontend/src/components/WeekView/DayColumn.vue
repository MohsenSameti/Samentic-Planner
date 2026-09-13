<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Task, Project, Property, PropertyValue } from '../../types'
import { useDayActions } from '../../composables/useDayActions'
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
  /**
   * True for days strictly before today in the visible week (spec
   * §18). Drives the softened header treatment; today stays loudest
   * and future days stay at full opacity.
   */
  isPast: boolean
  /** Tasks already filtered by the active project in `WeekView`. */
  tasks: Task[]
  /** `Project` lookup keyed by id, used by `TaskCard` for the badge. */
  projects: Map<string, Project>
  properties: Property[]
  propertyValues: PropertyValue[]
  /** Current day-note text (or '' if none). */
  dayNoteValue: string
  /** Tasks currently being saved (spec §14). Cards whose id is in
   *  the set render with a pending visual state until the parent's
   *  `updateTask` promise settles. */
  pendingTaskIds: Set<string>
  /**
   * Jalali day-of-month. Provided when the UI is in Jalali mode;
   * `undefined` for Gregorian. When present, takes precedence over
   * `dayNum` in the rendered header.
   */
  dayNumJalali?: number
  /**
   * Inline month-context marker (spec §17). Non-null on the column
   * whose day is the 1st of a new month in the active calendar.
   * `null` on every other column, including the first (the toolbar
   * already says it).
   */
  monthMarker: string | null
}>()

/**
 * Spec §22: this component used to declare 13 emits and forward them
 * one-by-one to `App.vue`. The emit boilerplate is gone; day- and
 * task-level actions are routed through the typed `DayActions`
 * surface provided by `App.vue` via `useDayActions()`. Data props
 * (`tasks`, `projects`, `properties`, …) stay as props — only the
 * action channel moves.
 */
const actions = useDayActions()

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

/**
 * Local string buffer for in-progress property edits (spec §5). The
 * native `<input type="number">` *will* silently strip a trailing
 * non-numeric character on `change`, so we mirror the user's raw
 * text into this map and only emit a finite parsed number on blur.
 * Invalid input (e.g. `12.5x`, `abc`) stays in the buffer; the next
 * render won't blank it.
 *
 * Keyed by property id and seeded from the resolved numeric value so
 * the first render of a row already has something to display when the
 * user has previously entered a value (and an empty string when they
 * haven't).
 */
const propertyBuffers = reactive<Record<string, string>>({})

function bufferFor(prop: Property): string {
  // Prefer the in-progress buffer if the user has touched this row;
  // otherwise seed from the resolved numeric value.
  if (prop.id in propertyBuffers) {
    return propertyBuffers[prop.id] ?? ''
  }
  const v = getPropertyValue(prop.id)
  return v === 0 ? '' : String(v)
}

function setBuffer(propertyId: string, value: string): void {
  propertyBuffers[propertyId] = value
}

/** Accessible-name composition (spec §5). Combines the property name
 *  with the unit in parentheses when one is set, so a screen reader
 *  hears "Hours, h" rather than just "Hours" with an unsignalled
 *  numeric box. */
function propertyAriaLabel(prop: Property): string {
  return prop.unit ? `${prop.name} (${prop.unit})` : prop.name
}

function handlePropertyChange(propertyId: string, e: Event): void {
  const target = e.target as HTMLInputElement
  const raw = target.value
  // Always keep the raw string in the buffer so the field doesn't
  // blank on a non-numeric keystroke.
  setBuffer(propertyId, raw)
  // Only emit a finite parseable number; otherwise the user is in
  // the middle of typing something we can't store yet.
  if (raw.trim() === '') {
    // Empty input is unambiguous: emit 0 (locked by §5 acceptance).
    actions?.updatePropertyValue(props.date, propertyId, 0)
    return
  }
  const parsed = Number(raw)
  if (Number.isFinite(parsed)) {
    actions?.updatePropertyValue(props.date, propertyId, parsed)
  }
  // Else: silent — the buffer keeps the user's text and the next
  // keystroke (or blur) re-parses.
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
  // Spec §14: drop cancels the hover state immediately, regardless
  // of whether the parent save succeeds or fails (the latter is
  // surfaced via ErrorDisplay, not via the hover ring).
  dragDepth.value = 0
  actions?.dropTask(e, props.date)
}

/* ------------------------------------------------------------------ */
/* Drag-and-drop affordance (spec §14)                                   */
/* ------------------------------------------------------------------ */

/**
 * Counter for `dragenter`/`dragleave` events. `dragleave` fires
 * every time the cursor crosses a child element, which would make a
 * naive `isHovered = dragenter; !dragleave` flag flicker as the
 * cursor moves over a card. Tracking the depth of nested entries
 * keeps the highlight stable until the cursor actually leaves the
 * column.
 */
const dragDepth = ref<number>(0)

function onDragEnter(): void {
  dragDepth.value++
}

function onDragLeave(): void {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

/* ------------------------------------------------------------------ */
/* Task actions forwarding                                               */
/* ------------------------------------------------------------------ */

function onAddTask(): void {
  actions?.addTask(props.date)
}

/**
 * Open day view for this column's date.
 *
 * The handler on `.day-header` is a mouse/touch convenience (clicking
 * the day text is the existing muscle memory) and deliberately carries
 * no `role`/`tabindex` — see spec §2: a focusable interactive descendant
 * (the `+`) inside a `role="button"` container is invalid ARIA. Spec
 * §25 removed the per-column chevron, so keyboard entry to the day view
 * is the header's date picker.
 */
function onOpenDay(): void {
  actions?.openDay(props.date)
}

const taskCount = computed(() => props.tasks.length)

/* ------------------------------------------------------------------ */
/* Mobile meta footer (spec §9)                                          */
/* ------------------------------------------------------------------ */

/**
 * Reactive viewport tracker. Returns `true` when the viewport width
 * is at or below the `--bp-md` token (768px). The footer is hidden
 * on desktop, so the column renders byte-identically to before the
 * §9 change.
 */
const isMobile = ref<boolean>(false)
const MOBILE_BREAKPOINT_PX = 768

function checkViewport(): void {
  if (typeof window === 'undefined') {
    isMobile.value = false
    return
  }
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT_PX
}

onMounted(() => {
  checkViewport()
  window.addEventListener('resize', checkViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkViewport)
})

/**
 * Local "expanded" state for the mobile meta footer. Spec §9 says
 * the expansion must be column-local — Vue re-keys `DayColumn` on
 * date in `WeekView`, so this ref is reset on every column
 * navigation without explicit reset logic.
 */
const mobileMetaExpanded = ref<boolean>(false)

/**
 * Summary shown inside the meta footer row. Concatenates each
 * property's resolved value + unit (e.g. "5h · 8") and appends a
 * non-empty note indicator. Used only on mobile — desktop renders
 * the existing always-mounted sections instead.
 */
const mobileMetaSummary = computed<string>(() => {
  const parts: string[] = []
  for (const prop of props.properties) {
    const v = getPropertyValue(prop.id)
    parts.push(prop.unit ? `${v}${prop.unit}` : `${v}`)
  }
  return parts.join(' · ')
})

/**
 * True iff the day has a non-empty note. Mirrors `DayNotes`’s
 * `hasNote` definition so the dot renders identically whether the
 * user looks at the always-mounted notes section or the meta row.
 */
const hasNote = computed<boolean>(() => props.dayNoteValue.trim().length > 0)
</script>

<template>
  <div
    class="day-column"
    :class="{ today: isToday, past: isPast, 'drag-hover': dragDepth > 0 }"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover.prevent
    @drop="handleDrop"
  >
    <div class="day-header" @click="onOpenDay">
      <div class="day-header-text">
        <div class="day-name">{{ dayName }}</div>
        <div class="day-date">{{ dayNumJalali ?? dayNum }}</div>
        <!-- Spec §17: inline month-context marker. Hidden when null
             (no rollover applies) so a quiet week is visually
             identical to before. -->
        <div
          v-if="monthMarker"
          class="day-month-marker"
          :title="monthMarker"
        >{{ monthMarker }}</div>
      </div>
      <div class="day-header-actions">
        <!-- Spec §25: the §7 chevron control is removed — the header
             exposes only the add-task control. Opening the day view is
             the header-click handler (mouse/touch) or the header's
             date picker (keyboard). -->
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
          :pending="pendingTaskIds.has((item as Task).id)"
        />
      </VirtualList>

      <template v-else>
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :project="projects.get(task.projectId) ?? null"
          :pending="pendingTaskIds.has(task.id)"
        />
      </template>

      <!-- Spec §16: replace the 150px decoration with a quiet dashed
           "Add task" drop zone. The button is also a valid drop
           target (drop events bubble to .day-column), turning dead
           space into the primary action and giving the §14 drag-hover
           ring a visible boundary when the column is empty. -->
      <button
        v-if="taskCount === 0"
        type="button"
        class="empty-state-add"
        :aria-label="`Add a task to ${dayName}`"
        @click="onAddTask"
      >
        <span class="empty-state-add-icon" aria-hidden="true">+</span>
        <span class="empty-state-add-text">Add task</span>
      </button>
    </div>

    <!-- Day Properties -->
    <div
      v-if="properties.length > 0"
      class="day-properties"
      v-show="!isMobile || mobileMetaExpanded"
    >
      <div v-for="prop in properties" :key="prop.id" class="property-row">
        <!-- Spec §10: full name + unit as a tooltip for pointer
             devices; the same text wraps to two short lines on
             touch widths so the name is readable, not just
             hover-recoverable. `title` does not double up with
             `aria-label` because the input (sibling, §5) carries
             the screen-reader-accessible name. -->
        <span class="property-label" :title="prop.unit ? `${prop.name} (${prop.unit})` : prop.name">{{ prop.name }}</span>
        <input
          type="number"
          class="property-input"
          :value="bufferFor(prop)"
          :aria-label="propertyAriaLabel(prop)"
          inputmode="decimal"
          placeholder="0"
          @change="(e) => handlePropertyChange(prop.id, e)"
        />
        <span v-if="prop.unit" class="property-unit" aria-hidden="true">{{ prop.unit }}</span>
      </div>
    </div>

    <!-- Day Notes -->
    <div v-show="!isMobile || mobileMetaExpanded">
      <DayNotes
        :date="date"
        :initial-value="dayNoteValue"
      />
    </div>

    <!-- Mobile meta footer (spec §9): on <=768px, properties and
         notes collapse into a single tap-to-expand row instead of
         permanently eating the column's vertical budget. Desktop
         leaves this hidden so the existing always-mounted layout is
         byte-identical. -->
    <button
      v-if="isMobile && !mobileMetaExpanded && (properties.length > 0 || hasNote)"
      type="button"
      class="meta-footer"
      :aria-label="`Show day details${properties.length > 0 ? ` (${mobileMetaSummary})` : ''}${hasNote ? ', has note' : ''}`"
      @click="mobileMetaExpanded = true"
    >
      <span v-if="properties.length > 0" class="meta-summary">{{ mobileMetaSummary }}</span>
      <span v-if="hasNote" class="meta-note-dot" aria-hidden="true"></span>
    </button>
  </div>
</template>

<style scoped>
.day-column {
  /* Spec §12, superseded by §23: stop claiming a fixed width. Above
   * --bp-md the seven columns share the available space; the 176px
   * floor keeps task titles readable everywhere. Below --bp-md the
   * grid overflows, so the floor *is* the column width (two full
   * columns + a sliver of a third at 375px). With the sidebar
   * auto-collapsed below 1632px (App.vue, §23), every viewport
   * ≥1352px fits one week without horizontal scrolling. Width is
   * not scanned by the spacing lint, so the literal px is fine. */
  flex: 1 1 0;
  min-width: 176px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  /* Spec §13: tie the desktop cap to the viewport so a 1080p
   * monitor gets a taller column instead of dead space below the
   * grid. `min(720px, calc(100vh - 200px))` = at most 720px tall
   * (a deliberate ceiling so the task list still scrolls within
   * the column) but capped to `100vh - 200px` so the column never
   * pushes the bottom of the viewport. Mobile override below
   * keeps the original 500px cap (a phone in portrait is too
   * short for a tall column to be useful). */
  max-height: min(720px, calc(100vh - 200px));
  transition: border-color 0.15s ease;
  scroll-snap-align: start;
}

@media (max-width: 768px) {
  .day-column {
    /* Spec §13: keep the mobile cap as-is. */
    max-height: 500px;
  }
}

.day-column.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

/* Spec §14: highlight the column that's the current drop target.
 * Driven by a `dragenter` / `dragleave` counter in `DayColumn.vue`
 * so the ring doesn't flicker when the cursor crosses a child card. */
.day-column.drag-hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}

/* Spec §18: past days in the current week get a softened header.
 * Today stays loudest (the .today ring above wins by specificity);
 * future days stay at the default treatment. The change is purely
 * on the text colour so layout doesn't shift across the row. The
 * `.day-progress` selector from §15 step 1 is gone — spec §24
 * removed the chip entirely. */
.day-column.past .day-name,
.day-column.past .day-date,
.day-column.past .day-month-marker {
  color: var(--text-completed);
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

.day-header-text {
  min-width: 0;
}

/* Groups the two header controls so they stay on one row and share their
 * spacing, leaving `.day-header-text` free to shrink (it owns `min-width: 0`)
 * rather than the row overflowing the 160px column. */
.day-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
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

/* Spec §17: inline month-context marker. Same size as the retired
 * `.day-progress` chip was, so a quiet header stays balanced; the
 * marker is the *primary* channel for which column is the rollover
 * (the title attribute is the secondary tooltip). */
.day-month-marker {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--accent);
  margin-top: var(--space-1);
  font-weight: 500;
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

/* Spec §6: bump the touch targets on every interactive control below
 * 768px to the 44px (or 40px for inputs) minimum. Spec §25 removed the
 * per-column chevron, so `.add-task-btn` is the header's only
 * control. Width / height are not scanned by the spacing lint, so
 * literal px values are fine.
 */
@media (max-width: 768px) {
  .add-task-btn {
    width: 44px;
    height: 44px;
  }

  .property-input {
    min-height: 40px;
    width: 60px;
  }
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

/* Spec §16: empty-state add-task drop zone. Replaces the previous
 * 150px block with a quiet dashed button that emits `add-task` on
 * click and serves as a visible drop target for §14's drag-hover.
 * Token-based padding; border / icon size in px per project
 * convention (the spacing lint doesn't scan these). */
.empty-state-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-4);
  margin-top: var(--space-2);
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  width: 100%;
  font-family: inherit;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.empty-state-add:hover,
.empty-state-add:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
}

.empty-state-add:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.empty-state-add-icon {
  font-size: 1.2rem;
  font-weight: 500;
  line-height: 1;
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
  /* Desktop: ellipsis is acceptable because the full text is
   * exposed via `title` (spec §10). At <=768px we let the label
   * wrap to two short lines so touch users can actually read the
   * full name. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .property-label {
    /* Spec §10: wrap rather than ellipsis on touch. -webkit-line-clamp
     * keeps the label to two lines max so the row doesn't grow
     * unbounded. */
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
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

/* Property unit (spec §5). Rendered next to the input so the row
 * carries the unit alongside the value without needing a tooltip.
 * `aria-hidden` on the span means the unit is already spoken as part
 * of the input's accessible name. */
.property-unit {
  font-size: 0.7rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* Mobile meta footer (spec §9). On <=768px, properties and notes
 * collapse into this single tap-to-expand row. The button is
 * hidden on desktop so the existing layout is byte-identical. */
.meta-footer {
  display: none;
  /* Token-based padding; width / border-radius raw px per project
   * convention (the spacing lint doesn't scan these). */
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  cursor: pointer;
  flex-shrink: 0;
}

.meta-summary {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The note dot reuses the same shape as `DayNotes`’s indicator so
 * the visual signal is consistent wherever the user sees it. */
.meta-note-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .meta-footer {
    display: flex;
  }
}

/* Day notes styles live in `components/Notes/DayNotes.vue` */
</style>
