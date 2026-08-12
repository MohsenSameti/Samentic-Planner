import { ref } from 'vue'
import type { Project, Task, Property, PropertyValue, DayNote, WeekNote, Settings, State } from './types'

const API = '/api'

/**
 * Most-recent user-facing error message. Components like
 * `ErrorDisplay.vue` watch this ref and surface the message as a toast.
 * Set back to `null` to dismiss.
 */
export const apiError = ref<string | null>(null)

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
    const serverMessage = await readServerError(res)
    const message = serverMessage ?? `HTTP error! status: ${res.status}`
    throw new Error(message)
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
}
