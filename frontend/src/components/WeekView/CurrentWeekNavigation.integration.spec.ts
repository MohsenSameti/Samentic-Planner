/**
 * Integration coverage for current-week navigation emphasis (spec 13 Task 4.4).
 * The week range is emphasized only while the displayed week contains today;
 * no redundant Today pill is rendered, and navigation remains available.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../../App.vue'
import WeekNavigation from '../WeekNavigation.vue'

const { mockAuthStatus, mockGetState } = vi.hoisted(() => ({
  mockAuthStatus: vi.fn().mockResolvedValue({
    authenticated: true,
    setupRequired: false,
  }),
  mockGetState: vi.fn().mockResolvedValue({
    projects: [
      { id: 'p1', name: 'General', color: '#E74C3C', createdAt: 1000, updatedAt: 1000 },
    ],
    tasks: [],
    properties: [],
    propertyValues: [],
    dayNotes: [],
    weekNotes: [],
    settings: { weekStart: 1, calendar: 'gregorian' },
  }),
}))

vi.mock('../../api.js', () => ({
  api: {
    authStatus: (...args: unknown[]) => mockAuthStatus(...args),
    getState: (...args: unknown[]) => mockGetState(...args),
    updateSettings: vi.fn().mockResolvedValue({}),
    createProject: vi.fn(),
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

describe('Current-week navigation emphasis (Task 4.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    mockAuthStatus.mockResolvedValue({ authenticated: true, setupRequired: false })
    mockGetState.mockResolvedValue({
      projects: [
        { id: 'p1', name: 'General', color: '#E74C3C', createdAt: 1000, updatedAt: 1000 },
      ],
      tasks: [],
      properties: [],
      propertyValues: [],
      dayNotes: [],
      weekNotes: [],
      settings: { weekStart: 1, calendar: 'gregorian' },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('bolds the current week range, removes the pill, and returns to normal for other weeks', async () => {
    const wrapper = mount(App, {
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

    await flushPromises()
    await nextTick()

    const weekNav = wrapper.findComponent(WeekNavigation)
    expect(weekNav.exists()).toBe(true)
    expect(weekNav.find('.week-display').classes()).toContain('current-week')
    expect(weekNav.find('.today-pill').exists()).toBe(false)

    const prevBtn = weekNav.find('button[aria-label="Previous week"]')
    const nextBtn = weekNav.find('button[aria-label="Next week"]')
    expect(prevBtn.exists()).toBe(true)
    expect(nextBtn.exists()).toBe(true)

    await nextBtn.trigger('click')
    await nextTick()

    expect(weekNav.find('.week-display').classes()).not.toContain('current-week')
    expect(weekNav.find('.today-pill').exists()).toBe(false)
    expect(weekNav.find('button[aria-label="Previous week"]').exists()).toBe(true)
    expect(weekNav.find('button[aria-label="Next week"]').exists()).toBe(true)

    await prevBtn.trigger('click')
    await nextTick()
    expect(weekNav.find('.week-display').classes()).toContain('current-week')

    wrapper.unmount()
  }, 20_000)
})
