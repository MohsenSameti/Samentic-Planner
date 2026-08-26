<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import Modal from '../components/common/Modal.vue'
import { api } from '../api'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  /**
   * Fired on a successful password change. Parent should close the
   * modal and show the success toast — the modal itself does not
   * touch the toast directly to keep concerns separated.
   */
  (e: 'change'): void
}>()

const currentPassword = ref<string>('')
const newPassword = ref<string>('')
const confirmPassword = ref<string>('')
const submitting = ref<boolean>(false)
const error = ref<string | null>(null)

/** Template ref for the "current password" field — focused when the modal opens. */
const currentInput = ref<HTMLInputElement | null>(null)

/**
 * Soft client-side validation hint. `null` when valid. Mirrors the
 * pattern in `SetupWizard.vue` so the UI feels consistent across the
 * two password forms.
 */
const validationError = computed<string | null>(() => {
  if (newPassword.value.length > 0 && newPassword.value.length < 8) {
    return 'New password must be at least 8 characters.'
  }
  if (
    confirmPassword.value.length > 0 &&
    newPassword.value !== confirmPassword.value
  ) {
    return 'Passwords do not match.'
  }
  return null
})

/**
 * Submit gate. All four conditions must hold:
 * - current password is non-empty (backend requires it)
 * - new password is ≥ 8 chars (matches `SetupSchema`)
 * - confirm matches new (would otherwise be rejected server-side too)
 * - not currently submitting (avoid double-submit)
 */
const canSubmit = computed<boolean>(() => {
  return (
    currentPassword.value.length > 0 &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmPassword.value &&
    !submitting.value
  )
})

/**
 * Reset internal form state when the modal closes. Without this, a
 * subsequent open would show the previous attempt's values — bad on a
 * password form in particular (old passwords lingering on screen).
 */
watch(
  () => props.show,
  (isOpen) => {
    if (!isOpen) {
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      error.value = null
      submitting.value = false
    }
  },
)

/**
 * Focus the "current password" field when the modal opens. The
 * `await nextTick()` ensures the input is mounted in the DOM (the
 * modal contents are unmounted while `show` is false).
 */
watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      currentInput.value?.focus()
    }
  },
)

/**
 * Clear the loud error when the user starts editing again, so the
 * form doesn't keep shouting at them after they've fixed the input.
 */
function clearError(): void {
  if (error.value !== null) {
    error.value = null
  }
}

async function handleSubmit(): Promise<void> {
  // The submit button is disabled when `canSubmit` is false, but Enter
  // can still fire the handler from inside the password inputs.
  if (!canSubmit.value) return

  error.value = null
  submitting.value = true

  try {
    await api.changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    // Let the parent close the modal + show the toast. The modal's
    // `show` watcher resets internal state on close.
    emit('change')
  } catch (err: unknown) {
    // Auth errors surface inline — do NOT touch `apiError` (the
    // global toast would flash on top of the inline message).
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
  <Modal
    :show="show"
    title="Change password"
    @close="emit('close')"
  >
    <form class="change-password-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="current-password">Current password</label>
        <input
          id="current-password"
          ref="currentInput"
          v-model="currentPassword"
          type="password"
          class="form-input"
          autocomplete="current-password"
          :disabled="submitting"
          @input="clearError"
        />
      </div>

      <div class="form-group">
        <label for="new-password">New password</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          class="form-input"
          autocomplete="new-password"
          :disabled="submitting"
          @input="clearError"
        />
      </div>

      <div class="form-group">
        <label for="confirm-new-password">Confirm new password</label>
        <input
          id="confirm-new-password"
          v-model="confirmPassword"
          type="password"
          class="form-input"
          autocomplete="new-password"
          :disabled="submitting"
          @input="clearError"
        />
      </div>

      <!-- Soft validation hint (length / mismatch). -->
      <div v-if="validationError && !error" class="validation-hint">
        {{ validationError }}
      </div>

      <!-- Loud error: server-rejected submit (wrong current password, etc). -->
      <div v-if="error" class="error-message" role="alert">
        {{ error }}
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="submitting"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="!canSubmit"
        >
          {{ submitting ? 'Changing password…' : 'Change password' }}
        </button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.change-password-form {
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--surface);
  font-family: inherit;
  color: var(--text-primary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.form-input:disabled {
  background: var(--bg);
  cursor: not-allowed;
  opacity: 0.7;
}

.validation-hint {
  padding: 8px 12px;
  background: var(--bg);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-bottom: 16px;
}

.error-message {
  padding: 10px 12px;
  background: #fdf2ec;
  border: 1px solid #f0c4a8;
  border-radius: 6px;
  color: #b84700;
  font-size: 0.875rem;
  margin-bottom: 16px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.modal-actions .btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
