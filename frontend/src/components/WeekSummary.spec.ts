/**
 * Tests for the `WeekSummary` component.
 *
 * The summary aggregates the visible week's tasks into per-status
 * counts (completed / active / skipped / cancelled). The skipped
 * count was added with the "skipped tasks" feature and renders
 * conditionally so weeks with no skipped tasks keep the row quiet.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekSummary from './WeekSummary.vue'
import type { Property, Task } from '../types'

const now = Date.now()

const property = (overrides: Partial<Property> = {}): Property => ({
  id: 'pr1',
  name: 'Hours',
  unit: 'h',
  createdAt: now,
  updatedAt: now,
  ...overrides,
})

const task = (id: string, date: string, status: Task['status']): Task => ({
  id,
  projectId: 'p1',
  title: `Task ${id}`,
  description: '',
  date,
  status,
  notes: '',
  createdAt: now,
  updatedAt: now,
})

const baseProps = {
  tasks: [] as Task[],
  weekDateStrings: ['2024-01-15', '2024-01-16', '2024-01-17', '2024-01-18', '2024-01-19', '2024-01-20', '2024-01-21'],
  properties: [] as Array<Property & { sum: number }>,
}

describe('WeekSummary', () => {
  describe('status counts', () => {
    it('shows zero for every status when the week has no tasks', () => {
      const wrapper = mount(WeekSummary, { props: baseProps })
      const text = wrapper.text()
      // Initial renders should show 0/0/0/0 (skipped omitted when 0).
      expect(text).toContain('Completed')
      expect(text).toContain('Active')
      expect(text).toContain('Cancelled')
      // Skipped label is conditionally rendered; with count 0 it
      // must NOT appear.
      expect(text).not.toContain('Skipped')
    })

    it('tallies each task status across the week', () => {
      const props = {
        ...baseProps,
        tasks: [
          task('t1', '2024-01-15', 'completed'),
          task('t2', '2024-01-15', 'completed'),
          task('t3', '2024-01-16', 'active'),
          task('t4', '2024-01-16', 'active'),
          task('t5', '2024-01-16', 'active'),
          task('t6', '2024-01-17', 'skipped'),
          task('t7', '2024-01-17', 'cancelled'),
        ],
      }
      const wrapper = mount(WeekSummary, { props })
      // Each stat block shows the count then the label.
      expect(wrapper.text()).toMatch(/2\s*Completed/)
      expect(wrapper.text()).toMatch(/3\s*Active/)
      expect(wrapper.text()).toMatch(/1\s*Skipped/)
      expect(wrapper.text()).toMatch(/1\s*Cancelled/)
    })

    it('does not count tasks outside the visible week', () => {
      const props = {
        ...baseProps,
        tasks: [
          task('t1', '2024-01-14', 'completed'), // last week
          task('t2', '2024-01-22', 'completed'), // next week
          task('t3', '2024-01-15', 'completed'), // in week
        ],
      }
      const wrapper = mount(WeekSummary, { props })
      expect(wrapper.text()).toMatch(/1\s*Completed/)
    })
  })

  describe('skipped stat block (conditional render)', () => {
    it('does NOT render the Skipped label when no tasks are skipped', () => {
      const props = {
        ...baseProps,
        tasks: [
          task('t1', '2024-01-15', 'completed'),
          task('t2', '2024-01-15', 'active'),
        ],
      }
      const wrapper = mount(WeekSummary, { props })
      expect(wrapper.text()).not.toContain('Skipped')
      // And no .stat-item for skipped should exist.
      const skippedItems = wrapper.findAll('.stat-item').filter(n =>
        (n.text() || '').includes('Skipped'),
      )
      expect(skippedItems).toHaveLength(0)
    })

    it('renders the Skipped stat block when at least one task is skipped', () => {
      const props = {
        ...baseProps,
        tasks: [task('t1', '2024-01-15', 'skipped')],
      }
      const wrapper = mount(WeekSummary, { props })
      const skippedItems = wrapper.findAll('.stat-item').filter(n =>
        (n.text() || '').includes('Skipped'),
      )
      expect(skippedItems).toHaveLength(1)
      expect(skippedItems[0]?.text()).toContain('1')
    })

    it('updates the Skipped block as the count changes', async () => {
      const props = {
        ...baseProps,
        tasks: [task('t1', '2024-01-15', 'skipped')],
      }
      const wrapper = mount(WeekSummary, { props })
      expect(wrapper.text()).toMatch(/1\s*Skipped/)

      await wrapper.setProps({
        tasks: [
          task('t1', '2024-01-15', 'skipped'),
          task('t2', '2024-01-16', 'skipped'),
          task('t3', '2024-01-17', 'skipped'),
        ],
      })
      expect(wrapper.text()).toMatch(/3\s*Skipped/)

      // Removing all skipped tasks should hide the block again.
      await wrapper.setProps({
        tasks: [task('t1', '2024-01-15', 'active')],
      })
      expect(wrapper.text()).not.toContain('Skipped')
    })
  })

  describe('properties', () => {
    it('renders one stat block per property with its sum', () => {
      const props = {
        ...baseProps,
        properties: [
          { ...property({ id: 'p1', name: 'Hours', unit: 'h' }), sum: 5 },
          { ...property({ id: 'p2', name: 'Pages', unit: '' }), sum: 30 },
        ],
      }
      const wrapper = mount(WeekSummary, { props })
      expect(wrapper.text()).toMatch(/5\s*Hours\s*h/)
      expect(wrapper.text()).toMatch(/30\s*Pages\s*/)
    })
  })
})
