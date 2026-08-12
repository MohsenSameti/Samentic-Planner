/**
 * Tests for the `DayNotes` component.
 *
 * `DayNotes` is a small collapsible textarea. The expanded/collapsed
 * state is local to the component. Tests cover:
 *
 *   - Initial collapse
 *   - Toggle behaviour on click and keyboard
 *   - emit on blur with the current value
 *   - Initial value seeding
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DayNotes from './DayNotes.vue'

const baseProps = {
  date: '2024-01-01',
  initialValue: '',
}

describe('DayNotes', () => {
  it('renders the toggle label', () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    expect(wrapper.find('.day-notes-toggle').text()).toContain('Day Notes')
  })

  it('starts collapsed', () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    expect(wrapper.find('.day-notes-content').classes()).not.toContain('expanded')
  })

  it('expands on click', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('click')
    expect(wrapper.find('.day-notes-content').classes()).toContain('expanded')
  })

  it('expands on Enter', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('keydown.enter')
    expect(wrapper.find('.day-notes-content').classes()).toContain('expanded')
  })

  it('expands on Space', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('keydown.space')
    expect(wrapper.find('.day-notes-content').classes()).toContain('expanded')
  })

  it('collapses on a second click', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('click')
    await wrapper.find('.day-notes-toggle').trigger('click')
    expect(wrapper.find('.day-notes-content').classes()).not.toContain('expanded')
  })

  it('seeds the textarea with initialValue', async () => {
    const wrapper = mount(DayNotes, {
      props: { ...baseProps, initialValue: 'pre-existing' },
    })
    await wrapper.find('.day-notes-toggle').trigger('click')
    const textarea = wrapper.find('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('pre-existing')
  })

  it('emits update with the typed value on blur', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('click')
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await textarea.trigger('blur')
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')?.[0]).toEqual(['2024-01-01', 'hello'])
  })

  it('sets aria-expanded correctly', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    expect(wrapper.find('.day-notes-toggle').attributes('aria-expanded')).toBe('false')
    await wrapper.find('.day-notes-toggle').trigger('click')
    expect(wrapper.find('.day-notes-toggle').attributes('aria-expanded')).toBe('true')
  })
})
