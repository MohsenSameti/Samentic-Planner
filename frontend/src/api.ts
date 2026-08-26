import { ref } from 'vue'
import type { Project, Task, Property, PropertyValue, DayNote, WeekNote, Settings, State, AuthStatus, AuthChangePasswordRequest } from './types'

const API = '/api'

/**
 * Callbacks fired when any request returns 401 Unauthorized.
 * Used by useAuth to flip isAuthenticated = false on session expiry.
 */
const unauthorizedCallbacks = new Set<() => void>()

/**
 * Register a callback to fire on 401 responses.
 * Returns an unsubscribe function.
 */
export function onUnauthorized(cb: () => void): () => void {
  unauthorizedCallbacks.add(cb)
  return () => {
    unauthorizedCallbacks.delete(cb)
  }
}

/**
 * Clear all registered unauthorized callbacks.
 * Used by tests to ensure test isolation.
 * @internal
 */
export function _clearUnauthorizedCallbacks(): void {
  unauthorizedCallbacks.clear()
}

/**
 * Most-recent user-facing error message. Components like
 * `ErrorDisplay.vue` watch this ref and surface the message as a toast.
 * Set back to `null` to dismiss.
 */
export const apiError = ref<string | null>(null)

/**
 * Most-recent user-facing success message. Components like
 * `SuccessDisplay.vue` watch this ref and surface the message as a
 * green, auto-dismissing toast. Set back to `null` to dismiss
 * immediately. Distinct from `apiError` so error/success notifications
 * don't collide.
 */
export const successMessage = ref<string | null>(null)

/** How long a success toast stays visible before auto-dismissing. */
const SUCCESS_DISMISS_MS = 3000

/**
 * Handle for the auto-dismiss timer so a rapid second call resets
 * the countdown instead of stacking multiple timers.
 */
let successDismissTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Show a transient success toast. Subsequent calls within the
 * dismiss window reset the countdown and replace the visible
 * message — there's only ever one success toast at a time.
 */
export function setSuccessMessage(message: string): void {
  successMessage.value = message
  if (successDismissTimer !== null) {
    clearTimeout(successDismissTimer)
  }
  successDismissTimer = setTimeout(() => {
    successMessage.value = null
    successDismissTimer = null
  }, SUCCESS_DISMISS_MS)
}

/**
 * Clear any visible success message and cancel the pending auto-dismiss.
 * Used by tests to ensure test isolation.
 * @internal
 */
export function _clearSuccessMessage(): void {
  if (successDismissTimer !== null) {
    clearTimeout(successDismissTimer)
    successDismissTimer = null
  }
  successMessage.value = null
}

/**
 * True while any API request is in flight. Useful for showing a global
 * "loading…" indicator. Set to `true` before each request and reset to
 * `false` in a `finally` block so it doesn't get stuck on errors.
 */
export const isLoading = ref<boolean>(false)

/** Number of retry attempts after the initial request fails. */
const MAX_RETRIES = 3
/** Delay before the next retry, in milliseconds. */
const RETRY_DELAY_MS = 1000

/**
 * Extract a user-friendly message from an unknown error value. Used as
 * a fallback when the server doesn't send a structured `{ error: ... }`
 * body (e.g. on network failures).
 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    // `fetch` rejects with a `TypeError` whose message starts with
    // "Failed to fetch" / "NetworkError" on connection problems.
    if (err.name === 'TypeError' && /fetch|network/i.test(err.message)) {
      return 'Network error. Please check your connection.'
    }
    return err.message
  }
  return 'An unknown error occurred.'
}

/**
 * Read the `error` field from a failed response body. The body might
 * not be JSON (or might be empty), so we narrow defensively rather
 * than casting to `any`.
 */
async function readServerError(res: Response): Promise<string | null> {
  try {
    const data: unknown = await res.json()
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof (data as { error: unknown }).error === 'string'
    ) {
      return (data as { error: string }).error
    }
    return null
  } catch {
    return null
  }
}

/**
 * Error thrown by `request` for non-2xx HTTP responses. Carries the
 * status code so callers (and the retry loop) can distinguish client
 * errors from transient failures.
 */
class HttpError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Core fetch wrapper. Translates non-2xx responses into thrown Errors
 * whose message is either the server-provided `error` field or a
 * generic HTTP status description. Network failures are caught here
 * and re-thrown with a friendlier message so callers don't have to
 * distinguish them.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    // Fire onUnauthorized callbacks for 401 responses
    if (res.status === 401) {
      for (const cb of unauthorizedCallbacks) {
        try {
          cb()
        } catch (e) {
          console.error('onUnauthorized callback threw', e)
        }
      }
    }
    const serverMessage = await readServerError(res)
    const message = serverMessage ?? `HTTP error! status: ${res.status}`
    throw new HttpError(message, res.status)
  }

  return (await res.json()) as T
}

/**
 * Wraps `request` with a bounded retry loop. Used for every API call so
 * a single flaky request doesn't surface an error to the user. The
 * retry budget is small (3 attempts with 1s backoff) to avoid making
 * a broken backend feel hung.
 *
 * NOTE: idempotency-wise, retrying POST/PUT/DELETE on network errors
 * can produce duplicates when the server actually completed the work
 * but the response was lost. For a single-user planner that's an
 * acceptable trade-off; if the app ever goes multi-user this should
 * be replaced with an idempotency-key strategy.
 */
async function requestWithRetry<T>(
  path: string,
  options?: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<T> {
  try {
    return await request<T>(path, options)
  } catch (err) {
    // Client errors (4xx) are deterministic — the same request will
    // fail identically on retry (wrong password, validation failure,
    // not found). Retry only network errors and 5xx.
    if (
      err instanceof HttpError &&
      err.status >= 400 &&
      err.status < 500
    ) {
      throw err
    }
    if (retries > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      return requestWithRetry<T>(path, options, retries - 1)
    }
    throw err
  }
}

/**
 * Wraps `requestWithRetry` with the shared loading/error bookkeeping.
 * Components reading `apiError` / `isLoading` see aggregate state for
 * the whole app, not per-call.
 */
async function call<T>(path: string, options?: RequestInit): Promise<T> {
  isLoading.value = true
  try {
    return await requestWithRetry<T>(path, options)
  } catch (err) {
    apiError.value = describeError(err)
    throw err
  } finally {
    isLoading.value = false
  }
}

export const api = {
  // Projects
  getProjects: () => call<Project[]>('/projects'),
  createProject: (data: Omit<Project, 'createdAt' | 'updatedAt'>) =>
    call<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: string, data: Partial<Project>) =>
    call<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    call<{ success: boolean }>('/projects/' + id, { method: 'DELETE' }),

  // Tasks
  getTasks: () => call<Task[]>('/tasks'),
  createTask: (data: Omit<Task, 'createdAt' | 'updatedAt'>) =>
    call<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) =>
    call<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: string) =>
    call<{ success: boolean }>('/tasks/' + id, { method: 'DELETE' }),

  // Properties
  getProperties: () => call<Property[]>('/properties'),
  createProperty: (data: Omit<Property, 'createdAt' | 'updatedAt'>) =>
    call<Property>('/properties', { method: 'POST', body: JSON.stringify(data) }),
  updateProperty: (id: string, data: Partial<Property>) =>
    call<Property>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProperty: (id: string) =>
    call<{ success: boolean }>('/properties/' + id, { method: 'DELETE' }),

  // Property Values
  getPropertyValues: () => call<PropertyValue[]>('/property-values'),
  setPropertyValue: (data: Omit<PropertyValue, 'id'> & { id?: string }) =>
    call<PropertyValue>('/property-values', { method: 'POST', body: JSON.stringify(data) }),

  // Day Notes
  getDayNotes: () => call<DayNote[]>('/day-notes'),
  setDayNote: (data: DayNote) =>
    call<DayNote>('/day-notes', { method: 'POST', body: JSON.stringify(data) }),

  // Week Notes
  getWeekNotes: () => call<WeekNote[]>('/week-notes'),
  setWeekNote: (data: WeekNote) =>
    call<WeekNote>('/week-notes', { method: 'POST', body: JSON.stringify(data) }),

  // Full State
  getState: () => call<State>('/state'),

  // Settings
  getSettings: () => call<Settings>('/settings'),
  updateSettings: (settings: Settings) =>
    call<Settings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Auth - these bypass apiError (errors shown inline in LoginPage/SetupWizard)
  authStatus: () => requestWithRetry<AuthStatus>('/auth/status'),
  login: (password: string) =>
    requestWithRetry<{ success: true }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    requestWithRetry<{ success: true }>('/auth/logout', { method: 'POST' }),
  setup: (password: string) =>
    requestWithRetry<{ success: true }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  changePassword: (data: AuthChangePasswordRequest) =>
    requestWithRetry<{ success: true }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
