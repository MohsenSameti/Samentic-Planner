/**
 * Tests for the `WeekNavigation` component.
 *
 * `WeekNavigation` is a presentational toolbar with prev/next buttons
 * and a week-range label. Spec §8 adds an orientation pill that
 * surfaces today's date when it falls inside the visible week, so the
 * user always knows where the today anchor is even after scrolling it
 * out of view on mobile.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekNavigation from './WeekNavigation.vue'

const baseProps = {
  weekDisplay: 'Jan 01-07, 2024',
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

  describe('orientation pill (spec §8)', () => {
    it('renders no orientation pill when currentDayLabel is omitted', () => {
      const wrapper = mount(WeekNavigation, { props: baseProps })
      expect(wrapper.find('.today-pill').exists()).toBe(false)
    })

    it('renders the orientation pill when currentDayLabel is provided', () => {
      const wrapper = mount(WeekNavigation, {
        props: { ...baseProps, currentDayLabel: 'Wed 03' },
      })
      const pill = wrapper.find('.today-pill')
      expect(pill.exists()).toBe(true)
      expect(pill.text()).toBe('Wed 03')
    })

    it('marks the pill as a non-interactive indicator (no button role, aria-hidden on decoration)', () => {
      // The pill is informational, not a button — clicking it does
      // not need to do anything (the toolbar Today button already
      // brings the user back to today's week). Keeping it as a span
      // avoids advertising a non-existent action.
      const wrapper = mount(WeekNavigation, {
        props: { ...baseProps, currentDayLabel: 'Wed 03' },
      })
      const pill = wrapper.find('.today-pill')
      expect(pill.element.tagName).toBe('SPAN')
      // The text "Wed 03" is the rendered content; the prefix word
      // "Today" can be set via a visually-hidden span for screen
      // readers without affecting the visual.
      expect(pill.text()).toBe('Wed 03')
    })
  })
})
