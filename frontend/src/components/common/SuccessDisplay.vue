<script setup lang="ts">
import { successMessage } from '../../api'

/**
 * Toast-style notification that surfaces the most recent
 * `successMessage`. Mirrors `ErrorDisplay.vue` but with a green
 * theme and an auto-dismiss timer owned by the `api` module
 * (the ref simply becomes `null` after 3 s).
 *
 * Renders only when `successMessage.value` is non-null; clicking the
 * × dismisses it early by clearing the ref. The next successful
 * operation will re-pop the toast.
 *
 * ARIA: `role="status"` + `aria-live="polite"` — success is
 * informational, not assertive, so screen readers won't interrupt
 * the user to announce it.
 */
function dismissSuccess(): void {
  successMessage.value = null
}
</script>

<template>
  <Transition name="success">
    <div
      v-if="successMessage"
      class="success-notification"
      role="status"
      aria-live="polite"
    >
      <div class="success-content">
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
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span class="success-message">{{ successMessage }}</span>
      </div>
      <button
        class="success-dismiss"
        type="button"
        @click="dismissSuccess"
        aria-label="Dismiss notification"
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
  </Transition>
</template>

<style scoped>
.success-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--success);
  color: white;
  padding: var(--space-4) var(--space-5);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  z-index: 1000;
  max-width: min(420px, calc(100vw - 40px));
}

.success-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.success-content svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.success-message {
  /* Allow long server messages to wrap rather than overflow. */
  word-break: break-word;
  line-height: 1.4;
}

.success-dismiss {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: var(--space-1);
  opacity: 0.7;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-dismiss:hover {
  opacity: 1;
}

.success-dismiss:focus-visible {
  opacity: 1;
  outline: 2px solid white;
  outline-offset: 2px;
  border-radius: 2px;
}

.success-dismiss svg {
  width: 16px;
  height: 16px;
}

/* Slide in from below on mount; reverse on leave. */
.success-enter-active,
.success-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.success-enter-from,
.success-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

/* On small screens, span the full width with a little margin so the
   close button stays reachable with one thumb. */
@media (max-width: 480px) {
  .success-notification {
    left: 20px;
    bottom: 20px;
  }
}
</style>
