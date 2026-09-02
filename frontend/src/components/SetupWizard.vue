<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const auth = useAuth()

const password = ref('')
const confirmPassword = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

/**
 * Client-side validation error message, or null if valid.
 */
const validationError = computed<string | null>(() => {
  if (password.value.length > 0 && password.value.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (confirmPassword.value.length > 0 && password.value !== confirmPassword.value) {
    return 'Passwords do not match.'
  }
  return null
})

/**
 * Whether the form can be submitted.
 * Requires password ≥ 8 chars and both fields match (implied: both non-empty).
 */
const canSubmit = computed<boolean>(() => {
  return (
    password.value.length >= 8 &&
    password.value === confirmPassword.value &&
    !submitting.value
  )
})

async function handleSubmit(): Promise<void> {
  if (submitting.value) return

  // Client-side validation: the submit button is disabled when
  // canSubmit is false, but Enter-key can still fire the handler.
  // The validationError computed already shows the soft hint — just
  // return without swapping it to the louder error style.
  if (!canSubmit.value) return

  error.value = null
  submitting.value = true

  try {
    await auth.setup(password.value)
    // On success, isAuthenticated flips to true and the route guard
    // re-renders the app automatically.
  } catch (err: unknown) {
    // Show inline error — do NOT touch apiError (no global toast for
    // auth failures; the SetupWizard renders the error inline instead).
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'An unknown error occurred.'
    }
  } finally {
    submitting.value = false
  }
}

/**
 * Clear error when user starts typing again.
 */
function clearError(): void {
  if (error.value !== null) {
    error.value = null
  }
}
</script>

<template>
  <div class="setup-wizard">
    <div class="setup-card">
      <h1 class="setup-title">Create your password</h1>
      <p class="setup-subtitle">Choose a strong password to secure your planner.</p>

      <form @submit.prevent="handleSubmit">
        <div class="field">
          <label for="password" class="field-label">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="field-input"
            autocomplete="new-password"
            :disabled="submitting"
            autofocus
            @input="clearError"
          />
        </div>

        <div class="field">
          <label for="confirm-password" class="field-label">Confirm password</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            class="field-input"
            autocomplete="new-password"
            :disabled="submitting"
            @input="clearError"
          />
        </div>

        <!-- Client-side validation hint -->
        <div v-if="validationError && !error" class="validation-hint">
          {{ validationError }}
        </div>

        <div v-if="error" class="error-message" role="alert">
          {{ error }}
        </div>

        <button
          type="submit"
          class="btn btn-primary submit-btn"
          :disabled="!canSubmit"
        >
          {{ submitting ? 'Creating password…' : 'Create password' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.setup-wizard {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-5);
  background: var(--bg);
}

.setup-card {
  background: var(--surface);
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  padding: var(--space-8) var(--space-6);
  box-shadow: var(--shadow-md);
}

.setup-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
  text-align: center;
}

.setup-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: var(--space-6);
  text-align: center;
}

.field {
  margin-bottom: var(--space-4);
}

.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.field-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 1rem;
  color: var(--text-primary);
  background: var(--surface);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.field-input:disabled {
  background: var(--bg);
  cursor: not-allowed;
  opacity: 0.7;
}

.validation-hint {
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-bottom: var(--space-4);
}

.error-message {
  padding: var(--space-2) var(--space-3);
  background: var(--accent-light);
  border: 1px solid var(--accent);
  border-radius: 6px;
  color: var(--accent);
  font-size: 0.875rem;
  margin-bottom: var(--space-4);
}

.submit-btn {
  width: 100%;
  padding: var(--space-3);
  font-size: 1rem;
  margin-top: var(--space-1);
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .setup-card {
    padding: var(--space-6) var(--space-5);
  }

  .setup-title {
    font-size: 1.25rem;
    margin-bottom: var(--space-2);
  }

  .setup-subtitle {
    margin-bottom: var(--space-5);
  }
}
</style>
