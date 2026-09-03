<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'

const auth = useAuth()

const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const passwordInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  passwordInput.value?.focus()
})

async function handleSubmit(): Promise<void> {
  if (submitting.value) return

  error.value = null
  submitting.value = true

  try {
    await auth.login(password.value)
    // On success, isAuthenticated flips to true and the route guard
    // re-renders the app automatically.
  } catch (err: unknown) {
    // Show inline error — do NOT touch apiError (no global toast for
    // auth failures; the LoginPage renders the error inline instead).
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = 'An unknown error occurred.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">Sign in</h1>

      <form @submit.prevent="handleSubmit">
        <div class="field">
          <label for="password" class="field-label">Password</label>
          <input
            id="password"
            ref="passwordInput"
            v-model="password"
            type="password"
            class="field-input"
            autocomplete="current-password"
            :disabled="submitting"
            autofocus
          />
        </div>

        <div v-if="error" class="error-message" role="alert">
          {{ error }}
        </div>

        <button
          type="submit"
          class="btn btn-primary submit-btn"
          :disabled="submitting"
        >
          {{ submitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-5);
  background: var(--bg);
}

.login-card {
  background: var(--surface);
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  padding: var(--space-8) var(--space-6);
  box-shadow: var(--shadow-md);
}

.login-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  color: var(--text-primary);
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
  .login-card {
    padding: var(--space-6) var(--space-5);
  }

  .login-title {
    font-size: 1.25rem;
    margin-bottom: var(--space-5);
  }
}
</style>
