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
import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

  it('writes to the date that owned the editor on blur even if date prop changes', async () => {
    const { wrapper, actions } = mountWithActions(DayNotes, {
      props: { date: '2024-01-17', initialValue: 'wednesday' },
    })
    await wrapper.find('.day-notes-toggle').trigger('click')
    const textarea = wrapper.find('textarea')
    await textarea.setValue('edited wednesday')
    await wrapper.setProps({ date: '2024-01-18' })
    await textarea.trigger('blur')
    expect(actions.updateDayNote).toHaveBeenCalledWith('2024-01-17', 'edited wednesday')
    expect(actions.updateDayNote).not.toHaveBeenCalledWith('2024-01-18', expect.anything())
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

  describe('save status feedback (Task 6.2)', () => {
    it('shows saving status while save is in flight', async () => {
      let resolvePromise!: () => void
      const pendingPromise = new Promise<void>(resolve => {
        resolvePromise = resolve
      })
      const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
      actions.updateDayNote.mockReturnValue(pendingPromise)

      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')
      await textarea.setValue('new note')
      await textarea.trigger('blur')

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('saving')
      expect(statusEl.text()).toBe('Saving…')
      expect(statusEl.attributes('aria-live')).toBe('polite')

      resolvePromise()
      await flushPromises()
    })

    it('shows saved status after successful save and returns to idle after timeout', async () => {
      vi.useFakeTimers()
      const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
      actions.updateDayNote.mockResolvedValue(undefined)

      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')
      await textarea.setValue('saved note')
      await textarea.trigger('blur')
      await flushPromises()

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('saved')
      expect(statusEl.text()).toBe('Saved')

      // Advance time past the transient status timeout (2000ms)
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.note-save-status').exists()).toBe(false)
      vi.useRealTimers()
    })

    it('shows error status with role="alert" when save fails', async () => {
      const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
      actions.updateDayNote.mockRejectedValue(new Error('Network error'))

      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')
      await textarea.setValue('failed note')
      await textarea.trigger('blur')
      await flushPromises()

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('error')
      expect(statusEl.text()).toBe('Save failed')
      expect(statusEl.attributes('role')).toBe('alert')
    })

    it('race condition: older save resolving does not overwrite newer save status', async () => {
      let resolveFirst!: () => void
      let resolveSecond!: () => void
      const firstPromise = new Promise<void>(resolve => {
        resolveFirst = resolve
      })
      const secondPromise = new Promise<void>(resolve => {
        resolveSecond = resolve
      })

      const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
      actions.updateDayNote
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')

      // First blur (initiates first save)
      await textarea.setValue('edit 1')
      await textarea.trigger('blur')

      // Second blur before first completes (initiates second save)
      await textarea.setValue('edit 2')
      await textarea.trigger('blur')

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.classes()).toContain('saving')

      // Second save finishes first
      resolveSecond()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')

      // Older first save completes later — should be ignored and not overwrite
      resolveFirst()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')
    })

    it('race condition: older save rejecting does not overwrite newer save status', async () => {
      let rejectFirst!: (err: Error) => void
      let resolveSecond!: () => void
      const firstPromise = new Promise<void>((_, reject) => {
        rejectFirst = reject
      })
      const secondPromise = new Promise<void>(resolve => {
        resolveSecond = resolve
      })

      const { wrapper, actions } = mountWithActions(DayNotes, { props: baseProps })
      actions.updateDayNote
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      await wrapper.find('.day-notes-toggle').trigger('click')
      const textarea = wrapper.find('textarea')

      // First blur
      await textarea.setValue('edit 1')
      await textarea.trigger('blur')

      // Second blur before first finishes
      await textarea.setValue('edit 2')
      await textarea.trigger('blur')

      // First save fails after second has started
      rejectFirst(new Error('Old failure'))
      await flushPromises()

      // Should still be saving edit 2, NOT error from edit 1
      expect(wrapper.find('.note-save-status').classes()).toContain('saving')
      expect(wrapper.find('.note-save-status').text()).toBe('Saving…')

      // Second save succeeds
      resolveSecond()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')
    })
  })
})

