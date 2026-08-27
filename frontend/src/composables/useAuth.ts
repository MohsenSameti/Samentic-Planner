import { reactive, readonly, ref } from 'vue'
import { api, onUnauthorized } from '../api'

/**
 * Module-level singleton state for authentication.
 * Accessed via the useAuth() factory function.
 */

// Track the in-flight status fetch promise
const statusPromise = ref<Promise<void> | null>(null)

/** True once a session is established. */
const isAuthenticated = ref(false)

/** True when no password has been set yet. */
const setupRequired = ref(false)

/** True during the initial status fetch. */
const loading = ref(true)

/** User-friendly error message if the initial status fetch failed. */
const error = ref<string | null>(null)

/**
 * Fetch auth status and update module-level state.
 * Replaces statusPromise so any existing awaiters get the fresh result.
 */
async function fetchStatus(): Promise<void> {
  const promise = api
    .authStatus()
    .then((status) => {
      setupRequired.value = status.setupRequired
      // Adopt the server's view of the session. This is what lets a
      // returning user skip the login screen: when their cookie is
      // still valid, the server reports `authenticated: true` and we
      // flip the local flag in lockstep. The `App.vue` watcher on
      // `isAuthenticated` then triggers the initial data load.
      isAuthenticated.value = status.authenticated
      loading.value = false
      error.value = null
    })
    .catch((err: unknown) => {
      // User-friendly message for network/server errors
      if (err instanceof Error && (err.name === 'TypeError' || /fetch|network/i.test(err.message))) {
        error.value = "Couldn't reach server. Please check your connection."
      } else if (err instanceof Error) {
        error.value = err.message
      } else {
        error.value = 'An unknown error occurred.'
      }
      loading.value = false
    })

  statusPromise.value = promise
  await promise
}

/**
 * Register the onUnauthorized callback.
 * Must happen before any request fires, so 401 from the initial
 * status fetch is handled correctly.
 */
onUnauthorized(() => {
  isAuthenticated.value = false
})

// Kick off the initial status fetch immediately (not awaited)
// Consumers see loading === true until the promise resolves
fetchStatus()

/**
 * Factory function to access auth state and methods.
 * Follows the same pattern as useProjects, useTasks, etc.
 *
 * Returns a `readonly(reactive(...))` proxy so:
 * - Templates (and JS consumers) read state as **unwrapped values**
 *   (`auth.error === '...'`) without `.value`. Vue's reactive
 *   `get` trap unwraps nested Refs automatically, which is the same
 *   mechanism `<script setup>` uses at the top level — except this
 *   works through plain-object nesting too. Without this wrapper,
 *   `auth.error` in a template is the Ref object itself, and
 *   `auth.error !== null` would always be true.
 * - The readonly outer proxy enforces the readonly invariant at both
 *   runtime (any set is a no-op + warn) and at the TypeScript level
 *   (DeepReadonly type). Inner `readonly(ref)` wrappers stay as
 *   defence in depth: they keep the inner-ref-is-readonly guarantee
 *   even if a future refactor drops the outer wrapper.
 */
export function useAuth() {
  return readonly(reactive({
    /** True once a session is established. */
    isAuthenticated: readonly(isAuthenticated),

    /** True when no password has been set yet. */
    setupRequired: readonly(setupRequired),

    /** True during the initial status fetch. */
    loading: readonly(loading),

    /**
     * Non-null with a user-friendly message if the initial status
     * fetch failed (server unreachable, network error).
     */
    error: readonly(error),

    /**
     * Sign in with password.
     * @throws Error on failure (caller displays inline)
     */
    login: async (password: string): Promise<void> => {
      // Wait for any in-flight status fetch
      await statusPromise.value

      await api.login(password)
      isAuthenticated.value = true
    },

    /**
     * Sign out and clear auth state.
     * Flips both isAuthenticated and setupRequired to false.
     */
    logout: async (): Promise<void> => {
      // Wait for any in-flight status fetch
      await statusPromise.value

      await api.logout()
      isAuthenticated.value = false
      setupRequired.value = false
    },

    /**
     * Create initial password.
     * @throws Error on failure (caller displays inline)
     */
    setup: async (password: string): Promise<void> => {
      // Wait for any in-flight status fetch
      await statusPromise.value

      await api.setup(password)
      isAuthenticated.value = true
    },

    /**
     * Re-run the initial status fetch.
     * Used by the "Couldn't reach server" screen.
     */
    retryStatus: async (): Promise<void> => {
      // Abandon any in-flight status fetch
      // Replace statusPromise so awaiters get the fresh result
      loading.value = true
      error.value = null

      const promise = api
        .authStatus()
        .then((status) => {
          setupRequired.value = status.setupRequired
          // Mirror fetchStatus: adopt the server's session state on
          // retry so a transient error that wipes auth state gets
          // restored once the server is reachable again.
          isAuthenticated.value = status.authenticated
          loading.value = false
          error.value = null
        })
        .catch((err: unknown) => {
          if (err instanceof Error && (err.name === 'TypeError' || /fetch|network/i.test(err.message))) {
            error.value = "Couldn't reach server. Please check your connection."
          } else if (err instanceof Error) {
            error.value = err.message
          } else {
            error.value = 'An unknown error occurred.'
          }
          loading.value = false
        })

      statusPromise.value = promise
      await promise
    },
  }))
}
