/**
 * Tests for the `Header` component.
 *
 * `Header` is a pure presentational component: it shows the
 * burger/X sidebar toggle, the Planner logo/name, and the "Today"
 * button. Week navigation (prev / display / next) was moved to
 * `WeekNavigation.vue` and is covered in `WeekNavigation.spec.ts`.
 * Tests assert on the rendered text and event emissions.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Header from './Header.vue'

const defaultProps = {
  sidebarCollapsed: true,
}

describe('Header', () => {
  it('renders the logo text', () => {
    const wrapper = mount(Header, { props: defaultProps })
    expect(wrapper.find('.logo h1').text()).toBe('Planner')
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
})
