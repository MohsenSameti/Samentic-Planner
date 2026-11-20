<script lang="ts">
import { ref } from 'vue'

let modalIdCounter = 0
const modalStack = ref<number[]>([])
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const modalRef = ref<HTMLElement | null>(null)
const instanceId = ++modalIdCounter
const openerElement = ref<HTMLElement | null>(null)

const isActive = computed<boolean>(() => {
  return modalStack.value.length > 0 && modalStack.value[modalStack.value.length - 1] === instanceId
})

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isFocusable(el: HTMLElement | null): boolean {
  if (!el || el === document.body) return false
  if (!document.contains(el)) return false
  if ('disabled' in el && (el as HTMLButtonElement).disabled) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  if (el.style.display === 'none' || el.style.visibility === 'hidden') return false
  if (el.getAttribute('tabindex') === '-1') return false
  return typeof el.focus === 'function'
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  const matches = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  return matches.filter((el) => {
    if (el.hasAttribute('disabled')) return false
    if (el.getAttribute('tabindex') === '-1') return false
    if (el.getAttribute('aria-hidden') === 'true') return false
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false
    return true
  })
}

function openModal(): void {
  if (modalStack.value.includes(instanceId)) return

  const currentActive = document.activeElement as HTMLElement | null
  if (currentActive && (!modalRef.value || !modalRef.value.contains(currentActive))) {
    openerElement.value = currentActive
  }

  modalStack.value.push(instanceId)

  void nextTick(() => {
    if (!props.show || !modalRef.value) return
    const focusable = getFocusableElements(modalRef.value)
    const target = modalRef.value.querySelector<HTMLElement>('[autofocus]') ?? focusable[0]
    if (target) {
      target.focus()
    } else {
      modalRef.value.focus()
    }
  })
}

function closeModal(): void {
  const index = modalStack.value.indexOf(instanceId)
  if (index !== -1) {
    modalStack.value.splice(index, 1)
  }

  const opener = openerElement.value
  openerElement.value = null

  if (opener && isFocusable(opener)) {
    opener.focus()
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) {
      openModal()
    } else {
      closeModal()
    }
  },
  { immediate: true },
)

function handleTab(e: KeyboardEvent): void {
  if (!modalRef.value) return

  const focusable = getFocusableElements(modalRef.value)
  if (focusable.length === 0) {
    e.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement

  if (e.shiftKey) {
    if (active === first || active === modalRef.value || !modalRef.value.contains(active)) {
      e.preventDefault()
      last?.focus()
    }
  } else {
    if (active === last || active === modalRef.value || !modalRef.value.contains(active)) {
      e.preventDefault()
      first?.focus()
    }
  }
}

/**
 * Close-on-Escape and Tab trap handler. The `show` gate and `isActive` check
 * ensure only the topmost active dialog manages focus and intercepts keyboard events.
 *
 * When open and active, Escape propagation is stopped so parent/window-level listeners
 * (such as App.vue's Day View shortcut) do not also react to this Escape.
 */
function handleKeydown(e: KeyboardEvent): void {
  if (!props.show || !isActive.value) return

  if (e.key === 'Escape') {
    e.stopPropagation()
    e.stopImmediatePropagation()
    emit('close')
    return
  }

  if (e.key === 'Tab') {
    handleTab(e)
  }
}

/**
 * Close-on-outside-interaction handler. Listens for `mousedown` rather
 * than `click` deliberately: a real user's press on the element that
 * *opens* the modal fires `mousedown` first (while the modal is still
 * closed) and only then the `click` that sets `show=true`.
 *
 * The `isActive` check ensures that when modals are nested or overlapped,
 * only the topmost active dialog handles outside clicks.
 */
function handleDocumentMouseDown(e: MouseEvent): void {
  if (!props.show || !isActive.value) return
  if (modalRef.value && !modalRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown, true)
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown, true)
  document.removeEventListener('mousedown', handleDocumentMouseDown)
  closeModal()
})
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div
      ref="modalRef"
      class="modal"
      role="dialog"
      :aria-label="title"
      :aria-modal="isActive ? 'true' : undefined"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button
          class="modal-close"
          type="button"
          :aria-label="t('Close')"
          @click="emit('close')"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="modal-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-5);
  animation: modalFadeIn 0.15s ease;
}

.modal {
  background: var(--surface);
  border-radius: 8px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
  animation: modalSlideIn 0.2s ease;
  outline: none;
}

.modal-header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-family: var(--font-heading);
}

.modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.modal-close:hover {
  color: var(--text-primary);
}

.modal-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.modal-close svg {
  width: 20px;
  height: 20px;
}

.modal-content {
  padding: var(--space-5);
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modalSlideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
