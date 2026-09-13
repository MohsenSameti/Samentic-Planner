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
import { mountWithActions } from '../../composables/test-utils'

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

  it('calls updateDayNote with the typed value on blur', async () => {
    const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
    await wrapper.find('.day-notes-toggle').trigger('click')
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await textarea.trigger('blur')
    expect(actions.updateDayNote).toHaveBeenCalledWith('2024-01-01', 'hello')
  })

  it('sets aria-expanded correctly', async () => {
    const wrapper = mount(DayNotes, { props: baseProps })
    expect(wrapper.find('.day-notes-toggle').attributes('aria-expanded')).toBe('false')
    await wrapper.find('.day-notes-toggle').trigger('click')
    expect(wrapper.find('.day-notes-toggle').attributes('aria-expanded')).toBe('true')
  })

  /**
   * Spec §19 acceptance: a saved day note is visible without opening
   * the editor. The component now exposes an indicator dot and a
   * single-line preview when the trimmed note is non-empty.
   */
  describe('note indicator + preview (spec §19)', () => {
    it('does not render the indicator dot when the note is empty', () => {
      const wrapper = mount(DayNotes, { props: baseProps })
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(false)
    })

    it('renders the indicator dot when the note has content', async () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: 'hello' },
      })
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(true)
    })

    it('does NOT render the indicator dot when the note is only whitespace', () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: '   \n  ' },
      })
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(false)
    })

    it('renders the single-line preview with the stored text', () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: 'short note' },
      })
      const preview = wrapper.find('.day-notes-preview')
      expect(preview.exists()).toBe(true)
      expect(preview.text()).toBe('short note')
    })

    it('collapses multi-line whitespace in the preview to a single line', () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: 'line one\n\n  line two' },
      })
      expect(wrapper.find('.day-notes-preview').text()).toBe('line one line two')
    })

    it('hides the preview while the editor is expanded (avoid double-text)', async () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: 'saved' },
      })
      expect(wrapper.find('.day-notes-preview').exists()).toBe(true)
      await wrapper.find('.day-notes-toggle').trigger('click')
      expect(wrapper.find('.day-notes-preview').exists()).toBe(false)
    })

    it('updates the indicator reactively when the user types into the textarea', async () => {
      // Empty → has-content
      const wrapper = mount(DayNotes, { props: baseProps })
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(false)
      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')
      await textarea.setValue('a note')
      // No blur yet — the local `value` ref is what drives the dot,
      // not the upstream prop, so the indicator flips before save.
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(true)
    })

    it('clears the indicator and preview when the textarea is emptied', async () => {
      const wrapper = mount(DayNotes, {
        props: { ...baseProps, initialValue: 'a note' },
      })
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(true)
      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')
      await textarea.setValue('')
      expect(wrapper.find('.day-notes-indicator').exists()).toBe(false)
      expect(wrapper.find('.day-notes-preview').exists()).toBe(false)
    })
  })
})
