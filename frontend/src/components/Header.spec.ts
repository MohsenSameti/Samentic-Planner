/**
 * Tests for the `Header` component.
 *
 * `Header` is a pure presentational component: it shows a week display
 * string, a hamburger/X toggle, and a pair of week-nav buttons plus a
 * "Today" button. Tests assert on the rendered text and event
 * emissions.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Header from './Header.vue'

const defaultProps = {
  weekDisplay: 'Jan 1 - 7, 2024',
  sidebarCollapsed: true,
}

describe('Header', () => {
  it('renders the week display', () => {
    const wrapper = mount(Header, { props: defaultProps })
    expect(wrapper.find('.week-display').text()).toBe('Jan 1 - 7, 2024')
  })

  it('renders the logo text', () => {
    const wrapper = mount(Header, { props: defaultProps })
    expect(wrapper.find('.logo h1').text()).toBe('Planner')
  })

  it('emits prev-week when the first nav button is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[0]!.trigger('click')
    expect(wrapper.emitted('prev-week')).toBeTruthy()
  })

  it('emits next-week when the second nav button is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    await navButtons[1]!.trigger('click')
    expect(wrapper.emitted('next-week')).toBeTruthy()
  })

  it('emits go-today when the Today button is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    await wrapper.find('.today-btn').trigger('click')
    expect(wrapper.emitted('go-today')).toBeTruthy()
  })

  it('emits toggle-sidebar when the sidebar toggle is clicked', async () => {
    const wrapper = mount(Header, { props: defaultProps })
    await wrapper.find('.sidebar-toggle').trigger('click')
    expect(wrapper.emitted('toggle-sidebar')).toBeTruthy()
  })

  it('aria-labels the nav buttons', () => {
    const wrapper = mount(Header, { props: defaultProps })
    const navButtons = wrapper.findAll('.nav-btn')
    expect(navButtons[0]!.attributes('aria-label')).toBe('Previous week')
    expect(navButtons[1]!.attributes('aria-label')).toBe('Next week')
  })
})
