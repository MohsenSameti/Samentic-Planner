/**
 * Tests for the `WeekNavigation` component.
 *
 * `WeekNavigation` is a pure presentational component: it shows the
 * centered week display string and a pair of nav buttons (previous /
 * next). It used to live inside `Header`; the controls were lifted
 * out into their own component so the toolbar could stay minimal.
 * Tests assert on the rendered text and event emissions.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekNavigation from './WeekNavigation.vue'

const defaultProps = {
  weekDisplay: 'Jan 1 - 7, 2024',
}

describe('WeekNavigation', () => {
  it('renders the week display', () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    expect(wrapper.find('.week-display').text()).toBe('Jan 1 - 7, 2024')
  })

  it('emits prev-week when the first nav button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[0]!.trigger('click')
    expect(wrapper.emitted('prev-week')).toBeTruthy()
  })

  it('emits next-week when the second nav button is clicked', async () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[1]!.trigger('click')
    expect(wrapper.emitted('next-week')).toBeTruthy()
  })

  it('aria-labels the nav buttons', () => {
    const wrapper = mount(WeekNavigation, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    expect(navButtons[0]!.attributes('aria-label')).toBe('Previous week')
    expect(navButtons[1]!.attributes('aria-label')).toBe('Next week')
  })
})
