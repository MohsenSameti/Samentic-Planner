import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import type { State } from './types'

const { mockAuthStatus, mockGetState } = vi.hoisted(() => ({
  mockAuthStatus: vi.fn().mockResolvedValue({
    authenticated: true,
    setupRequired: false,
  }),
  mockGetState: vi.fn(),
}))

vi.mock('./api.js', () => ({
  api: {
    authStatus: (...args: unknown[]) => mockAuthStatus(...args),
    getState: (...args: unknown[]) => mockGetState(...args),
    updateSettings: vi.fn().mockResolvedValue({}),
    createProject: vi.fn().mockResolvedValue({
      id: 'p-general',
      name: 'General',
      color: '#E74C3C',
      createdAt: 1000,
      updatedAt: 1000,
    }),
    login: vi.fn(),
    logout: vi.fn(),
    setup: vi.fn(),
  },
  apiError: { value: null },
  successMessage: { value: null },
  isLoading: { value: false },
  onUnauthorized: vi.fn(),
  setSuccessMessage: vi.fn(),
}))

const dummyState: State = {
  projects: [
    {
      id: 'p1',
      name: 'Project 1',
      color: '#E74C3C',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ],
  tasks: [],
  properties: [],
  propertyValues: [],
  dayNotes: [],
  weekNotes: [],
  settings: {
    weekStart: 1,
    calendar: 'gregorian',
  },
}

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        TaskModal: true,
        ProjectModal: true,
        PropertyModal: true,
        MoveModal: true,
        DeleteConfirmModal: true,
        ChangePasswordModal: true,
        WeekSummary: true,
      },
    },
  })
}

describe('Initial board load error and retry (Task 6.1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockAuthStatus.mockResolvedValue({
      authenticated: true,
      setupRequired: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows "Could not load planner" and the Retry button and does not render .app when initial getState rejects', async () => {
    mockGetState.mockRejectedValueOnce(new Error('Network failure'))
    const wrapper = mountApp()
    await flushPromises()

    const errorEl = wrapper.find('.board-error')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.attributes('role')).toBe('alert')
    expect(errorEl.text()).toContain('Could not load planner')

    const retryBtn = wrapper.find('.retry-btn')
    expect(retryBtn.exists()).toBe(true)
    expect(retryBtn.text()).toContain('Retry')

    expect(wrapper.find('.app').exists()).toBe(false)
  })

  it('displays loading state while retry request is in flight', async () => {
    mockGetState.mockRejectedValueOnce(new Error('Initial failure'))
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('.board-error').exists()).toBe(true)

    let resolveRetry!: (val: State) => void
    const pendingPromise = new Promise<State>((res) => {
      resolveRetry = res
    })
    mockGetState.mockReturnValueOnce(pendingPromise)

    const retryBtn = wrapper.find('.retry-btn')
    await retryBtn.trigger('click')
    await nextTick()

    const loadingEl = wrapper.find('.loading')
    expect(loadingEl.exists()).toBe(true)
    expect(loadingEl.text()).toContain('Opening planner…')
    expect(wrapper.find('.board-error').exists()).toBe(false)
    expect(wrapper.find('.app').exists()).toBe(false)

    resolveRetry(dummyState)
    await flushPromises()
  })

  it('returns to the error state with Retry button still visible if retry fails', async () => {
    mockGetState.mockRejectedValueOnce(new Error('Initial failure'))
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('.board-error').exists()).toBe(true)

    mockGetState.mockRejectedValueOnce(new Error('Second failure'))
    const retryBtn = wrapper.find('.retry-btn')
    await retryBtn.trigger('click')
    await flushPromises()

    const errorEl = wrapper.find('.board-error')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('Could not load planner')
    expect(wrapper.find('.retry-btn').exists()).toBe(true)
    expect(wrapper.find('.app').exists()).toBe(false)
  })

  it('renders the board (.app) with the loaded state if retry succeeds', async () => {
    mockGetState.mockRejectedValueOnce(new Error('Initial failure'))
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('.board-error').exists()).toBe(true)
    expect(wrapper.find('.app').exists()).toBe(false)

    mockGetState.mockResolvedValueOnce(dummyState)
    const retryBtn = wrapper.find('.retry-btn')
    await retryBtn.trigger('click')
    await flushPromises()

    expect(wrapper.find('.board-error').exists()).toBe(false)
    expect(wrapper.find('.loading').exists()).toBe(false)
    expect(wrapper.find('.app').exists()).toBe(true)
  })
})
