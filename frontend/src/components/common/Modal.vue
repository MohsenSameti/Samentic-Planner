<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  show: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const modalRef = ref<HTMLElement | null>(null)

/**
 * Close-on-Escape handler. The `show` gate matters: the listener stays
 * registered for the lifetime of the component, but we only react when
 * the modal is actually open. Without the gate, pressing Escape in any
 * other modal's overlay would close this one too.
 */
function handleKeydown(e: KeyboardEvent): void {
  if (!props.show) return
  if (e.key === 'Escape') {
    emit('close')
  }
}

/**
 * Close-on-outside-interaction handler. Listens for `mousedown` rather
 * than `click` deliberately: a real user's press on the element that
 * *opens* the modal fires `mousedown` first (while the modal is still
 * closed) and only then the `click` that sets `show=true`. If we
 * listened for `click` here, the opening click would bubble up to
 * `document` after `show` had already flipped to `true`, and the
 * handler would immediately close the modal it just opened (the button
 * receives focus during the click, so the prop update is applied before
 * the event finishes bubbling). `mousedown` also fires on touch (as a
 * synthetic event before the tap's `click`), so this stays correct on
 * mobile. Same `show` gate reasoning as the Escape handler above.
 */
function handleDocumentMouseDown(e: MouseEvent): void {
  if (!props.show) return
  if (modalRef.value && !modalRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mousedown', handleDocumentMouseDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousedown', handleDocumentMouseDown)
})
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div ref="modalRef" class="modal" role="dialog" :aria-label="title">
      <div class="modal-header">
        <h2>{{ title }}</h2>
        <button
          class="modal-close"
          type="button"
          aria-label="Close"
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
