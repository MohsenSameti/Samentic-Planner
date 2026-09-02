<script setup lang="ts">
import { apiError } from '../../api'

/**
 * Toast-style notification that surfaces the most recent `apiError`.
 *
 * Renders only when `apiError.value` is non-null; clicking the ×
 * dismisses it by clearing the ref. The next failed request will
 * re-pop the toast.
 *
 * Auto-dismiss is intentionally NOT implemented: a transient network
 * blip shouldn't silently fade away, and users may need to read the
 * message before acting on it.
 */
function dismissError(): void {
  apiError.value = null
}
</script>

<template>
  <Transition name="error">
    <div v-if="apiError" class="error-notification" role="alert" aria-live="assertive">
      <div class="error-content">
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span class="error-message">{{ apiError }}</span>
      </div>
      <button
        class="error-dismiss"
        type="button"
        @click="dismissError"
        aria-label="Dismiss error"
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
.error-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--danger);
  color: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
  max-width: min(420px, calc(100vw - 40px));
}

.error-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.error-content svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-message {
  /* Allow long server messages to wrap rather than overflow. */
  word-break: break-word;
  line-height: 1.4;
}

.error-dismiss {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  opacity: 0.7;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-dismiss:hover {
  opacity: 1;
}

.error-dismiss:focus-visible {
  opacity: 1;
  outline: 2px solid white;
  outline-offset: 2px;
  border-radius: 2px;
}

.error-dismiss svg {
  width: 16px;
  height: 16px;
}

/* Slide in from below on mount; reverse on leave. */
.error-enter-active,
.error-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.error-enter-from,
.error-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

/* On small screens, span the full width with a little margin so the
   close button stays reachable with one thumb. */
@media (max-width: 480px) {
  .error-notification {
    left: 20px;
    bottom: 20px;
  }
}
</style>
