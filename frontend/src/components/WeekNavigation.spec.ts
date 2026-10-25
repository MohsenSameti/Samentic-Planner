/**
 * Tests for the `WeekNavigation` component.
 *
 * `WeekNavigation` is a presentational toolbar with prev/next buttons
 * and a week-range label. The current week is emphasized without
 * adding an orientation pill or changing the navigation controls.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekNavigation from './WeekNavigation.vue'

const baseProps = {
  weekDisplay: 'Jan 01-07, 2024',
  isCurrentWeek: false,
}

describe('WeekNavigation', () => {
  it('renders the week-display label', () => {
    const wrapper = mount(WeekNavigation, { props: baseProps })
    expect(wrapper.find('.week-display').text()).toBe('Jan 01-07, 2024')
  })

  it('emits prev-week when the previous button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: baseProps })
    await wrapper.findAll('.nav-btn')[0]?.trigger('click')
    expect(wrapper.emitted('prev-week')).toBeTruthy()
  })

  it('emits next-week when the next button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: baseProps })
    await wrapper.findAll('.nav-btn')[1]?.trigger('click')
    expect(wrapper.emitted('next-week')).toBeTruthy()
  })

  describe('current-week emphasis', () => {
    it('emphasizes the week range when the displayed week is current', () => {
      const wrapper = mount(WeekNavigation, {
        props: { ...baseProps, isCurrentWeek: true },
      })
      expect(wrapper.find('.week-display').classes()).toContain('current-week')
      expect(wrapper.find('.today-pill').exists()).toBe(false)
    })

    it('leaves the week range normal when the displayed week is not current', () => {
      const wrapper = mount(WeekNavigation, {
        props: { ...baseProps, isCurrentWeek: false },
      })
      expect(wrapper.find('.week-display').classes()).not.toContain('current-week')
      expect(wrapper.find('.today-pill').exists()).toBe(false)
    })

    it('keeps both navigation controls present in either emphasis state', () => {
      const currentWeek = mount(WeekNavigation, {
        props: { ...baseProps, isCurrentWeek: true },
      })
      const otherWeek = mount(WeekNavigation, {
        props: { ...baseProps, isCurrentWeek: false },
      })
      expect(currentWeek.findAll('.nav-btn')).toHaveLength(2)
      expect(otherWeek.findAll('.nav-btn')).toHaveLength(2)
    })
  })
})
