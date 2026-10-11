/**
 * Integration tests for Today Orientation Pill ref access (Task 4.3).
 *
 * Acceptance Criteria 10:
 * "The Today orientation pill appears when today is in the visible week
 * and is absent when it is not."
 *
 * Verifies:
 * - App.vue source contract: does not read `.currentDayLabel?.value`
 * - Vue component-instance ref unwrapping: WeekView exposes `currentDayLabel`
 *   as an unwrapped `string | null` on its public instance.
 * - Integration harness / App.vue:
 *   - When today is in the visible week, `currentDayLabel` evaluates to
 *     the formatted label (e.g. 'Mon 01') and `.today-orientation-pill` is rendered.
 *   - When navigating away so today is not in the visible week,
 *     `currentDayLabel` evaluates to `null` and `.today-orientation-pill` is absent.
 *   - When navigating back, the orientation pill reappears.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, ref, computed, nextTick } from 'vue'
import WeekView from './WeekView.vue'
import WeekNavigation from '../WeekNavigation.vue'
import App from '../../App.vue'
import type { Calendar, Project, Property, Task } from '../../types'
import { fromLocalISODate, toLocalISODate } from '../../utils/date'

const { mockAuthStatus, mockGetState } = vi.hoisted(() => ({
  mockAuthStatus: vi.fn().mockResolvedValue({
    authenticated: true,
    setupRequired: false,
  }),
  mockGetState: vi.fn().mockResolvedValue({
    projects: [
      {
        id: 'p1',
        name: 'General',
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
      weekStart: 1, // Monday
      calendar: 'gregorian',
    },
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

describe('Today orientation pill ref access (Task 4.3)', () => {
  describe('Source contract', () => {
    it('App.vue does not read .currentDayLabel?.value', () => {
      const appPath = resolve(__dirname, '../../App.vue')
      const source = readFileSync(appPath, 'utf-8')

      // App.vue must not try to access .value on the unwrapped currentDayLabel
      expect(source).not.toContain('currentDayLabel?.value')
      expect(source).not.toMatch(/currentDayLabel\?\.value/)

      // App.vue must read currentDayLabel directly as exposed by WeekView
      expect(source).toMatch(/weekViewRef\.value\?\.currentDayLabel\s*\?\?\s*null/)

      // App.vue template-ref TypeScript typing must not expect an inner Ref
      expect(source).not.toContain('{ value: string | null }')
    })
  })

  describe('Integration harness (WeekView ↔ WeekNavigation wiring)', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z')) // Monday Jan 1, 2024
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const Harness = defineComponent({
      setup() {
        const currentWeekStart = ref<string>('2024-01-01')
        const weekViewRef = ref<InstanceType<typeof WeekView> | null>(null)
        const currentDayLabel = computed<string | null>(
          () => weekViewRef.value?.currentDayLabel ?? null,
        )

        function navigateWeek(dir: number): void {
          const d = fromLocalISODate(currentWeekStart.value)
          d.setDate(d.getDate() + dir * 7)
          currentWeekStart.value = toLocalISODate(d)
        }

        return {
          currentWeekStart,
          weekViewRef,
          currentDayLabel,
          navigateWeek,
        }
      },
      render() {
        return h('div', [
          h(WeekNavigation, {
            weekDisplay: 'Jan 01 - 07, 2024',
            currentDayLabel: this.currentDayLabel,
            onPrevWeek: () => this.navigateWeek(-1),
            onNextWeek: () => this.navigateWeek(1),
          }),
          h(WeekView, {
            ref: 'weekViewRef',
            currentWeekStart: this.currentWeekStart,
            tasks: [] as Task[],
            projects: [] as Project[],
            properties: [] as Property[],
            propertyValues: [],
            dayNotes: [],
            selectedProject: 'all',
            calendar: 'gregorian' as Calendar,
            goToTodayTrigger: 0,
            pendingTaskIds: new Set<string>(),
          }),
        ])
      },
    })

    it('exposes currentDayLabel as string | null directly on the component instance (unwrapped)', async () => {
      const wrapper = mount(Harness)
      await nextTick()

      const vm = wrapper.vm as unknown as {
        weekViewRef: InstanceType<typeof WeekView> | null
        currentDayLabel: string | null
      }

      // Vue 3 instance unwrapping: currentDayLabel on the public instance is string | null
      expect(typeof vm.weekViewRef?.currentDayLabel).toBe('string')
      expect(vm.weekViewRef?.currentDayLabel).toBe('Mon 01')
      expect(vm.currentDayLabel).toBe('Mon 01')

      // In WeekNavigation, orientation pill is rendered with .today-orientation-pill
      const pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Mon 01')
    })

    it('displays orientation pill when today is in visible week and hides when navigating away', async () => {
      const wrapper = mount(Harness)
      await nextTick()

      // Today is 2024-01-01 (in visible week): pill is rendered
      const weekNav = wrapper.findComponent(WeekNavigation)
      expect(weekNav.props('currentDayLabel')).toBe('Mon 01')

      let pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Mon 01')

      // Navigate to next week: today is not in visible week
      await weekNav.find('button[aria-label="Next week"]').trigger('click')
      await nextTick()

      expect(weekNav.props('currentDayLabel')).toBeNull()
      pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(false)

      // Navigate back to previous week: today is in visible week again
      await weekNav.find('button[aria-label="Previous week"]').trigger('click')
      await nextTick()

      expect(weekNav.props('currentDayLabel')).toBe('Mon 01')
      pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Mon 01')
    })
  })

  describe('App.vue mounting integration', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z')) // Monday Jan 1, 2024

      mockAuthStatus.mockResolvedValue({
        authenticated: true,
        setupRequired: false,
      })
      mockGetState.mockResolvedValue({
        projects: [
          {
            id: 'p1',
            name: 'General',
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
          weekStart: 1, // Monday
          calendar: 'gregorian',
        },
      })
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('renders .today-orientation-pill when today is in visible week and removes it when navigating away', async () => {
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

      // When today (Mon 2024-01-01) is in the visible week:
      // currentDayLabel evaluates to 'Mon 01' and .today-orientation-pill is rendered
      expect(weekNav.props('currentDayLabel')).toBe('Mon 01')

      let pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Mon 01')

      // Navigate to next week: today is not in visible week
      const nextBtn = weekNav.find('button[aria-label="Next week"]')
      expect(nextBtn.exists()).toBe(true)
      await nextBtn.trigger('click')
      await nextTick()

      // currentDayLabel evaluates to null and .today-orientation-pill is absent
      expect(weekNav.props('currentDayLabel')).toBeNull()
      pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(false)

      // Navigate back to previous week: today is again in visible week
      const prevBtn = weekNav.find('button[aria-label="Previous week"]')
      expect(prevBtn.exists()).toBe(true)
      await prevBtn.trigger('click')
      await nextTick()

      expect(weekNav.props('currentDayLabel')).toBe('Mon 01')
      pill = wrapper.find('.today-orientation-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Mon 01')
    }, 20_000)
  })
})
