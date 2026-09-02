<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import JalaliDatePicker from './JalaliDatePicker.vue'
import { formatDayTitle } from '../../utils/date'
import type { Calendar } from '../../types'

const props = defineProps<{
  /** Current ISO date (`YYYY-MM-DD`). Displayed in the anchor text. */
  value: string
  /** Which calendar to render inside the popover. */
  calendar: Calendar
}>()

const emit = defineEmits<{
  /** Emitted with the picked ISO date when the user picks a date. */
  (e: 'update', value: string): void
  /** Emitted when the popover should close (outside click, Esc, pick). */
  (e: 'close'): void
}>()

/* ------------------------------------------------------------------ */
/* Local state                                                          */
/* ------------------------------------------------------------------ */

const open = ref<boolean>(false)

/**
 * `true` while the user is interacting with the popover contents
 * (typing in the date input, navigating the Jalali grid). Used to
 * ignore `mousedown` events that bubble up from the popover itself
 * — otherwise clicking inside the popover would close it.
 */
const internalInteraction = ref<boolean>(false)

/** Anchor ref so the outside-click handler can ignore clicks on it. */
const anchorRef = ref<HTMLButtonElement | null>(null)

/** Popover ref for the same outside-click check. */
const popoverRef = ref<HTMLElement | null>(null)

/* ------------------------------------------------------------------ */
/* Anchor label                                                          */
/* ------------------------------------------------------------------ */

/**
 * User-facing label for the anchor button. Respects the active
 * `calendar` preference so the date shown next to the chevrons
 * matches the picker that opens: Gregorian → en-US long format
 * ("Monday, January 15, 2024"), Jalali → the equivalent Jalali
 * weekday + day + month + year. The label is derived purely from
 * `value` so the anchor always reflects the current selection.
 */
const anchorLabel = computed<string>(() => formatDayTitle(props.value, props.calendar))

/* ------------------------------------------------------------------ */
/* Toggle                                                               */
/* ------------------------------------------------------------------ */

function toggle(): void {
  if (open.value) {
    close()
  } else {
    open.value = true
    attachListeners()
  }
}

function close(): void {
  if (!open.value) return
  open.value = false
  detachListeners()
  emit('close')
}

/* ------------------------------------------------------------------ */
/* Outside click / Esc handlers                                         */
/* ------------------------------------------------------------------ */

/**
 * Document-level mousedown listener. Closes the popover when the
 * user clicks anywhere outside both the anchor and the popover
 * itself. Bound only while the popover is open — global click cost
 * is zero otherwise.
 *
 * `mousedown` (not `click`) is chosen so the close happens *before*
 * the click on the new target fires — otherwise a click on a button
 * behind the popover could land after the popover closed but
 * before the new click is dispatched, causing a UI race.
 */
function handleDocumentMousedown(e: MouseEvent): void {
  const target = e.target as Node | null
  if (!target) return
  if (anchorRef.value?.contains(target)) return
  if (popoverRef.value?.contains(target)) return
  close()
}

/**
 * Document-level keydown listener for Esc. Calls
 * `event.stopPropagation()` so the parent App.vue's window-level
 * Esc listener doesn't also fire and close day view on top of the
 * popover. Bound only while the popover is open.
 */
function handleDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}

/**
 * Attach the document listeners. Called when the popover opens.
 * Split out from the toggle for clarity (and so it can be detached
 * from the unmount path too).
 */
function attachListeners(): void {
  document.addEventListener('mousedown', handleDocumentMousedown)
  document.addEventListener('keydown', handleDocumentKeydown, true)
}

function detachListeners(): void {
  document.removeEventListener('mousedown', handleDocumentMousedown)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
}

/* ------------------------------------------------------------------ */
/* Pick handling                                                        */
/* ------------------------------------------------------------------ */

/**
 * Gregorian path. The native `<input type="date">` emits `change`
 * with the picked ISO date in `event.target.value`. The component
 * picks, emits `update`, and closes.
 */
function onGregorianChange(e: Event): void {
  const target = e.target as HTMLInputElement
  const picked = target.value
  if (!picked) return
  emit('update', picked)
  close()
}

/**
 * Jalali path. The inner JalaliDatePicker emits `update(iso)` with
 * a Gregorian ISO date. Forward to the parent and close.
 */
function onJalaliUpdate(value: string): void {
  emit('update', value)
  close()
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                            */
/* ------------------------------------------------------------------ */

watch(open, isOpen => {
  if (isOpen) {
    attachListeners()
  } else {
    detachListeners()
  }
})

onUnmounted(() => {
  // Defensive: detach in case the component unmounts while open.
  detachListeners()
})

/**
 * Suppress unused warning: `internalInteraction` is a guard flag
 * kept for clarity even though the current mousedown-target check
 * (anchor / popover contains) is sufficient. The flag is the
 * documented hook for future cases where we want to skip the
 * outside-click check entirely (e.g. during drag operations).
 */
void internalInteraction
</script>

<template>
  <div class="date-picker-popover-wrapper">
    <button
      ref="anchorRef"
      type="button"
      class="date-anchor"
      :aria-label="'Pick a date'"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ anchorLabel }}
    </button>
    <div
      v-if="open"
      ref="popoverRef"
      class="popover"
      role="dialog"
      aria-label="Pick a date"
    >
      <input
        v-if="calendar === 'gregorian'"
        class="popover-input"
        type="date"
        :value="value"
        aria-label="Pick a date"
        @change="onGregorianChange"
      />
      <JalaliDatePicker
        v-else
        :value="value"
        @update="onJalaliUpdate"
      />
    </div>
  </div>
</template>

<style scoped>
.date-picker-popover-wrapper {
  position: relative;
  display: inline-flex;
}

.date-anchor {
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-heading);
  font-size: 1.4rem;
  font-weight: normal;
  padding: var(--space-1) var(--space-2);
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
}

.date-anchor:hover {
  background: var(--bg);
}

.date-anchor:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow-md);
  z-index: 200;
  padding: var(--space-2);
}

.popover-input {
  display: block;
  font-family: inherit;
  font-size: 0.9rem;
  padding: var(--space-2) var(--space-2);
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-primary);
  /* `color-scheme: light dark` is also declared globally on
   * `input, select, textarea` in `style.css`; the duplicated
   * declaration here is intentional and harmless — it ensures the
   * native `<input type="date">` calendar icon adapts even on
   * browsers that don't pick up the page-level value. */
  color-scheme: light dark;
}

.popover-input:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
