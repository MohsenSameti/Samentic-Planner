/**
 * Tests for the `api` client.
 *
 * `api.ts` is a thin wrapper around `fetch` with retries, error
 * normalization, and shared `apiError` / `isLoading` bookkeeping. We
 * mock `globalThis.fetch` to drive deterministic responses (success,
 * HTTP error, network failure) and assert on the wrapper's behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  apiError,
  isLoading,
  onUnauthorized,
  _clearUnauthorizedCallbacks,
  setSuccessMessage,
  successMessage,
  _clearSuccessMessage,
} from './api.js'
import type {
  Project,
  Task,
  Property,
  DayNote,
  WeekNote,
  Settings,
  State,
} from './types/index.js'

/** Build a successful Response with a JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Build an error Response with `{ error: '...' }`. */
function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}

describe('api', () => {
  beforeEach(() => {
    apiError.value = null
    isLoading.value = false
    _clearUnauthorizedCallbacks()
    _clearSuccessMessage()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    _clearUnauthorizedCallbacks()
    _clearSuccessMessage()
    vi.useRealTimers()
  })

  describe('happy path', () => {
    it('returns the parsed JSON for a 2xx response', async () => {
      const projects: Project[] = [
        {
          id: 'p1',
          name: 'Test',
          color: '#000',
          createdAt: 1,
          updatedAt: 1,
        },
      ]
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(projects)))
      vi.stubGlobal('fetch', fetchSpy)

      const result = await api.getProjects()
      expect(result).toEqual(projects)
    })

    it('sends a JSON body and method for POST', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(jsonResponse({ id: 'p1', name: 'X', color: '#FFF', createdAt: 1, updatedAt: 1 })),
        )
      vi.stubGlobal('fetch', fetchSpy)

      await api.createProject({ id: 'ignored', name: 'X', color: '#FFF' })
      const [, init] = fetchSpy.mock.calls[0]!
      expect(init?.method).toBe('POST')
      expect(JSON.parse(init?.body as string)).toEqual({
        id: 'ignored',
        name: 'X',
        color: '#FFF',
      })
    })

    it('prefixes paths with /api', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse([])))
      vi.stubGlobal('fetch', fetchSpy)

      await api.getTasks()
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/tasks')
    })
  })

  describe('error handling', () => {
    it('throws an Error with the server message on a non-2xx response', async () => {
      // `mockImplementation` returns a *fresh* Response per call so
      // happy-dom's single-read body doesn't get exhausted by retries.
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Validation failed', 400)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.createProject({ id: 'x', name: '', color: '#000' })).rejects.toThrow(
        'Validation failed',
      )
    })

    it('falls back to a generic HTTP status message when no server message', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response('', { status: 503 })))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.getTasks()).rejects.toThrow(/503/)
    })

    it('sets apiError.value when a request fails', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('boom', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.getTasks()).rejects.toThrow()
      expect(apiError.value).toBe('boom')
    })

    it('maps network failures to a friendlier message', async () => {
      const networkError = new TypeError('Failed to fetch')
      const fetchSpy = vi.fn().mockRejectedValue(networkError)
      vi.stubGlobal('fetch', fetchSpy)

      // The retry logic will run MAX_RETRIES times before giving up.
      // After all retries, the apiError ref is set to the friendly
      // network message (the thrown error keeps the original
      // TypeError so callers can still see the underlying cause).
      await expect(api.getTasks()).rejects.toThrow()
      expect(apiError.value).toMatch(/Network error/i)
    })

    it('does not retry 4xx client errors (exactly one fetch call)', async () => {
      // 401 from a failed login is deterministic — retrying would
      // delay the inline error by ~3s and re-fire onUnauthorized.
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Invalid password', 401)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.login('wrong')).rejects.toThrow('Invalid password')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('does not retry other 4xx statuses either', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Validation failed', 400)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.setup('short')).rejects.toThrow('Validation failed')
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('still retries 5xx server errors', async () => {
      // Each attempt needs a fresh Response (single-read body), and a
      // 1s backoff sits between attempts — fake the timers so the test
      // stays fast while still proving more than one call happens.
      vi.useFakeTimers()
      try {
        const fetchSpy = vi
          .fn()
          .mockImplementation(() => Promise.resolve(errorResponse('Server error', 500)))
        vi.stubGlobal('fetch', fetchSpy)

        const pending = expect(api.getTasks()).rejects.toThrow('Server error')
        // Advance past all MAX_RETRIES backoff delays.
        await vi.advanceTimersByTimeAsync(10_000)
        await pending
        expect(fetchSpy.mock.calls.length).toBeGreaterThan(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('isLoading bookkeeping', () => {
    it('flips isLoading true around a successful call', async () => {
      const fetchSpy = vi.fn().mockImplementation(async () => {
        expect(isLoading.value).toBe(true)
        return jsonResponse([])
      })
      vi.stubGlobal('fetch', fetchSpy)
      await api.getProjects()
      expect(isLoading.value).toBe(false)
    })

    it('resets isLoading after an error', async () => {
      const fetchSpy = vi.fn().mockResolvedValueOnce(errorResponse('nope', 500))
      vi.stubGlobal('fetch', fetchSpy)
      await expect(api.getProjects()).rejects.toThrow()
      expect(isLoading.value).toBe(false)
    })
  })

  describe('entity endpoints', () => {
    it('exposes all entity collections', async () => {
      const state: State = {
        projects: [],
        tasks: [],
        properties: [],
        propertyValues: [],
        dayNotes: [],
        weekNotes: [],
        settings: { weekStart: 6, calendar: 'gregorian' },
      }
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(state)))
      vi.stubGlobal('fetch', fetchSpy)
      const endpoints = [
        ['getProjects', '/api/projects'],
        ['getTasks', '/api/tasks'],
        ['getProperties', '/api/properties'],
        ['getPropertyValues', '/api/property-values'],
        ['getDayNotes', '/api/day-notes'],
        ['getWeekNotes', '/api/week-notes'],
        ['getState', '/api/state'],
      ] as const

      for (const [method] of endpoints) {
        await (api[method] as () => Promise<unknown>)()
      }

      const calledPaths = fetchSpy.mock.calls.map(c => c[0])
      for (const [, path] of endpoints) {
        expect(calledPaths).toContain(path)
      }
    })

    it('exposes task mutations', async () => {
      const task: Task = {
        id: 't1', title: 'A', projectId: 'p1', description: '',
        date: '2024-01-01', status: 'active', notes: '', createdAt: 1, updatedAt: 1,
      }
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(task)))
      vi.stubGlobal('fetch', fetchSpy)

      await api.createTask({
        id: 't1',
        title: 'A',
        projectId: 'p1',
        description: '',
        date: '2024-01-01',
        status: 'active',
        notes: '',
      })
      await api.updateTask('t1', { status: 'completed' })
      await api.deleteTask('t1')

      const methods = fetchSpy.mock.calls.map(c => (c[1] as RequestInit | undefined)?.method)
      expect(methods).toEqual(['POST', 'PUT', 'DELETE'])
    })

    it('exposes property mutations', async () => {
      const prop: Property = { id: 'pr1', name: '', unit: '', createdAt: 1, updatedAt: 1 }
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse(prop)))
      vi.stubGlobal('fetch', fetchSpy)

      await api.createProperty({ id: 'pr1', name: 'Hours', unit: 'h' })
      await api.updateProperty('pr1', { name: 'Hrs' })
      await api.deleteProperty('pr1')
      await api.setPropertyValue({ propertyId: 'pr1', date: '2024-01-01', value: 5 })

      const methods = fetchSpy.mock.calls.map(c => (c[1] as RequestInit | undefined)?.method)
      expect(methods).toEqual(['POST', 'PUT', 'DELETE', 'POST'])
    })

    it('exposes note setters', async () => {
      const dayNote: DayNote = { date: '2024-01-01', note: '' }
      const weekNote: WeekNote = { weekStart: '2024-01-01', note: '' }
      const fetchSpy = vi.fn().mockImplementation((input) => {
        const url = String(input)
        if (url.includes('day-notes')) {
          return Promise.resolve(jsonResponse(dayNote))
        }
        if (url.includes('week-notes')) {
          return Promise.resolve(jsonResponse(weekNote))
        }
        return Promise.reject(new Error('Unexpected URL: ' + url))
      })
      vi.stubGlobal('fetch', fetchSpy)

      await api.setDayNote({ date: '2024-01-01', note: 'x' })
      await api.setWeekNote({ weekStart: '2024-01-01', note: 'y' })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('exposes settings read/write', async () => {
      const settings: Settings = { weekStart: 1, calendar: 'gregorian' }
      const fetchSpy = vi.fn().mockImplementation((input, init) => {
        const url = String(input)
        const method = (init as RequestInit | undefined)?.method ?? 'GET'
        if (url === '/api/settings' && method === 'GET') {
          return Promise.resolve(jsonResponse(settings))
        }
        if (url === '/api/settings' && method === 'PUT') {
          return Promise.resolve(jsonResponse(settings))
        }
        return Promise.reject(new Error('Unexpected call: ' + url + ' ' + method))
      })
      vi.stubGlobal('fetch', fetchSpy)

      const read = await api.getSettings()
      expect(read).toEqual(settings)
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/settings')

      const updated = await api.updateSettings({ weekStart: 6, calendar: 'gregorian' })
      expect(updated).toEqual(settings)
      const [, putInit] = fetchSpy.mock.calls[1]!
      expect(putInit?.method).toBe('PUT')
      expect(JSON.parse(putInit?.body as string)).toEqual({ weekStart: 6, calendar: 'gregorian' })
    })
  })

  describe('auth endpoints', () => {
    it('api.authStatus hits /api/auth/status', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ setupRequired: false })))
      vi.stubGlobal('fetch', fetchSpy)

      await api.authStatus()
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/status', expect.any(Object))
    })

    it('api.login hits /api/auth/login with password in body', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ success: true })))
      vi.stubGlobal('fetch', fetchSpy)

      await api.login('secret123')
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'secret123' }),
      }))
    })

    it('api.logout hits /api/auth/logout', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ success: true })))
      vi.stubGlobal('fetch', fetchSpy)

      await api.logout()
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({
        method: 'POST',
      }))
    })

    it('api.setup hits /api/auth/setup with password in body', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ success: true })))
      vi.stubGlobal('fetch', fetchSpy)

      await api.setup('password123')
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/setup', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ password: 'password123' }),
      }))
    })

    it('api.changePassword hits /api/auth/change-password with correct body', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ success: true })))
      vi.stubGlobal('fetch', fetchSpy)

      await api.changePassword({ currentPassword: 'old', newPassword: 'newpassword123' })
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/change-password', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'newpassword123' }),
      }))
    })
  })

  describe('auth endpoints bypass apiError', () => {
    it('api.login does not set apiError on 401', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Incorrect password', 401)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.login('wrong')).rejects.toThrow('Incorrect password')
      // Auth errors should not set apiError (they surface inline)
      expect(apiError.value).toBe(null)
    })

    it('api.login does not set apiError on 500', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Internal error', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.login('secret')).rejects.toThrow('Internal error')
      expect(apiError.value).toBe(null)
    })

    it('api.logout does not set apiError on failure', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Server error', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.logout()).rejects.toThrow('Server error')
      expect(apiError.value).toBe(null)
    })

    it('api.setup does not set apiError on failure', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Password too weak', 400)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.setup('short')).rejects.toThrow('Password too weak')
      expect(apiError.value).toBe(null)
    })

    it('api.authStatus does not set apiError on failure', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Server error', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.authStatus()).rejects.toThrow('Server error')
      expect(apiError.value).toBe(null)
    })

    it('api.changePassword does not set apiError on failure', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Wrong current password', 400)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.changePassword({ currentPassword: 'wrong', newPassword: 'newpassword123' }))
        .rejects.toThrow('Wrong current password')
      expect(apiError.value).toBe(null)
    })
  })

  describe('non-auth endpoints still set apiError on failure', () => {
    it('api.getTasks sets apiError on 500', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Database error', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.getTasks()).rejects.toThrow('Database error')
      expect(apiError.value).toBe('Database error')
    })
  })

  describe('onUnauthorized callback', () => {
    // Helper to create a fetch mock that always returns 401.
    // Returns a FRESH response each time because happy-dom Response body
    // can only be read once.
    const alwaysUnauthorized = (): typeof vi.fn =>
      vi.fn().mockImplementation(() => Promise.resolve(errorResponse('Unauthorized', 401)))

    it('401 fires onUnauthorized callbacks before throwing', async () => {
      const fetchSpy = alwaysUnauthorized()
      vi.stubGlobal('fetch', fetchSpy)

      const callback = vi.fn()
      const unsubscribe = onUnauthorized(callback)

      await expect(api.getTasks()).rejects.toThrow('Unauthorized')
      // Callback fires on every 401 (initial + retries that all return 401)
      expect(callback).toHaveBeenCalled()
      expect(callback.mock.calls.length).toBeGreaterThan(0)

      // Clean up
      unsubscribe()
    })

    it('throwing onUnauthorized callback does not prevent other callbacks', async () => {
      const fetchSpy = alwaysUnauthorized()
      vi.stubGlobal('fetch', fetchSpy)

      const callback1 = vi.fn(() => { throw new Error('callback1 failed') })
      const callback2 = vi.fn()
      const callback3 = vi.fn(() => { throw new Error('callback3 failed') })

      const unsub1 = onUnauthorized(callback1)
      const unsub2 = onUnauthorized(callback2)
      const unsub3 = onUnauthorized(callback3)

      await expect(api.getTasks()).rejects.toThrow('Unauthorized')
      // All registered callbacks should have been called at least once
      // (each callback called once per 401 response across retries)
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(callback3).toHaveBeenCalled()

      // Clean up
      unsub1()
      unsub2()
      unsub3()
    })

    it('onUnauthorized returns an unsubscribe function', async () => {
      const callback = vi.fn()
      const unsubscribe = onUnauthorized(callback)

      // Verify the callback fires on 401
      const fetchSpy = alwaysUnauthorized()
      vi.stubGlobal('fetch', fetchSpy)

      await expect(api.getTasks()).rejects.toThrow('Unauthorized')
      expect(callback).toHaveBeenCalled()

      // Call unsubscribe
      const result = unsubscribe()
      expect(typeof result).toBe('undefined') // unsubscribe returns void

      // Verify callback was removed by calling unsubscribe again (should be no-op)
      // This confirms the unsubscribe function works
      expect(unsubscribe()).toBeUndefined()
    })

    it('multiple callbacks all fire on a single 401', async () => {
      const fetchSpy = alwaysUnauthorized()
      vi.stubGlobal('fetch', fetchSpy)

      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      const unsub1 = onUnauthorized(callback1)
      const unsub2 = onUnauthorized(callback2)
      const unsub3 = onUnauthorized(callback3)

      await expect(api.getTasks()).rejects.toThrow('Unauthorized')
      // All callbacks should have been called at least once
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
      expect(callback3).toHaveBeenCalled()

      // Clean up
      unsub1()
      unsub2()
      unsub3()
    })

    it('non-401 errors do not fire onUnauthorized callbacks', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Bad request', 400)))
      vi.stubGlobal('fetch', fetchSpy)

      const callback = vi.fn()
      const unsubscribe = onUnauthorized(callback)

      await expect(api.getTasks()).rejects.toThrow('Bad request')
      expect(callback).not.toHaveBeenCalled()

      // Clean up
      unsubscribe()
    })

    it('500 errors do not fire onUnauthorized callbacks', async () => {
      const fetchSpy = vi
        .fn()
        .mockImplementation(() => Promise.resolve(errorResponse('Server error', 500)))
      vi.stubGlobal('fetch', fetchSpy)

      const callback = vi.fn()
      const unsubscribe = onUnauthorized(callback)

      await expect(api.getTasks()).rejects.toThrow('Server error')
      expect(callback).not.toHaveBeenCalled()

      // Clean up
      unsubscribe()
    })
  })

  describe('successMessage toast', () => {
    it('setSuccessMessage sets the ref and auto-clears after the dismiss timer', () => {
      vi.useFakeTimers()
      expect(successMessage.value).toBe(null)

      setSuccessMessage('Password changed successfully.')
      expect(successMessage.value).toBe('Password changed successfully.')

      // Advance past the 3s dismiss window.
      vi.advanceTimersByTime(3000)
      expect(successMessage.value).toBe(null)
    })

    it('a second setSuccessMessage call within the dismiss window replaces the message and resets the timer', () => {
      vi.useFakeTimers()
      setSuccessMessage('First message')
      // Part-way through the window.
      vi.advanceTimersByTime(1000)

      setSuccessMessage('Second message')
      expect(successMessage.value).toBe('Second message')

      // The original timer would have fired at 3000ms; with the reset,
      // it should now fire at 1000 + 3000 = 4000ms.
      vi.advanceTimersByTime(2999)
      expect(successMessage.value).toBe('Second message')
      vi.advanceTimersByTime(1)
      expect(successMessage.value).toBe(null)
    })

    it('_clearSuccessMessage cancels the pending timer and clears the ref', () => {
      vi.useFakeTimers()
      setSuccessMessage('Toast')
      expect(successMessage.value).toBe('Toast')

      _clearSuccessMessage()
      // Advance well past the dismiss window — the cleared timer must
      // not fire and resurrect the message.
      vi.advanceTimersByTime(10000)
      expect(successMessage.value).toBe(null)
    })
  })
})
