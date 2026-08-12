<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

/**
 * Vue 3 equivalent of a React error boundary. `onErrorCaptured` lets us
 * intercept errors thrown in child components (during render or in
 * lifecycle hooks) before they propagate up and break the whole app.
 *
 * Returning `false` from the handler tells Vue to stop propagating the
 * error further, which keeps the rest of the page (and Vue devtools)
 * usable.
 *
 * "Try Again" clears the local error state and re-renders the slot —
 * since the slot is reactive, this re-mounts the subtree if the
 * underlying problem is gone.
 */
const error = ref<Error | null>(null)

onErrorCaptured((err: unknown): false => {
  // Narrow unknown → Error for display. The error is also re-thrown
  // through `console.error` so devtools / Sentry-style tooling still
  // sees it.
  if (err instanceof Error) {
    error.value = err
  } else {
    error.value = new Error(typeof err === 'string' ? err : 'An unknown error occurred.')
  }
  // eslint-disable-next-line no-console
  console.error('[ErrorBoundary]', err)
  // Returning `false` halts propagation; the page stays mounted.
  return false
})

function resetError(): void {
  error.value = null
}
</script>

<template>
  <div v-if="error" class="error-boundary" role="alert">
    <div class="error-content">
      <h3>Something went wrong</h3>
      <p>{{ error.message }}</p>
      <button class="retry-btn" type="button" @click="resetError">Try Again</button>
    </div>
  </div>
  <slot v-else></slot>
</template>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 20px;
  background: var(--bg);
  border-radius: 8px;
  margin: 20px;
}

.error-content {
  text-align: center;
  color: var(--text-secondary);
  max-width: 480px;
}

.error-content h3 {
  color: var(--text);
  margin-bottom: 8px;
}

.retry-btn {
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

.retry-btn:hover {
  background: #b84700;
}

.retry-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
