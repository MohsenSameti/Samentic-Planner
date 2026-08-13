/**
 * Tests for the `api` client.
 *
 * `api.ts` is a thin wrapper around `fetch` with retries, error
 * normalization, and shared `apiError` / `isLoading` bookkeeping. We
 * mock `globalThis.fetch` to drive deterministic responses (success,
 * HTTP error, network failure) and assert on the wrapper's behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, apiError, isLoading } from './api.js'
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
})
