/**
 * Integration tests for the `TaskModal` component, focused on the
 * calendar-aware date input. The modal swaps between a native
 * `<input type="date">` (Gregorian) and a `<JalaliDatePicker>`
 * (Jalali) based on the `calendar` prop.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import TaskModal from './TaskModal.vue'
import JalaliDatePicker from '../components/common/JalaliDatePicker.vue'
import type { Calendar, Project } from '../types/index.js'

/**
 * Read the modal SFC's source for the dark-mode regression tests
 * at the bottom. happy-dom doesn't process the SFC's `<style
 * scoped>` block, so we assert on the source instead. The contract
 * we lock in: every form-control rule in the modal's scoped style
 * has an explicit `color: var(--text-primary)`, so a future
 * wrapping element that sets `color` cannot silently change the
 * input text color in dark mode.
 */
const modalSource = readFileSync(
  resolve(process.cwd(), 'src/modals/TaskModal.vue'),
  'utf8',
)

const now = Date.now()

const baseProjects: Project[] = [
  { id: 'p1', name: 'Test', color: '#000', createdAt: now, updatedAt: now },
]

const baseProps = {
  show: true,
  task: null,
  projects: baseProjects,
  date: '2024-03-20',
  calendar: 'gregorian' as Calendar,
}

describe('TaskModal', () => {
  it('renders a native date input when calendar is "gregorian"', () => {
    const wrapper = mount(TaskModal, { props: baseProps })
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    expect(wrapper.findComponent(JalaliDatePicker).exists()).toBe(false)
  })

  it('renders a JalaliDatePicker when calendar is "jalali"', () => {
    const wrapper = mount(TaskModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    const picker = wrapper.findComponent(JalaliDatePicker)
    expect(picker.exists()).toBe(true)
    // The picker is bound to form.date (Gregorian ISO) — the same
    // shape the native input would produce.
    expect(picker.props('value')).toBe('2024-03-20')
  })

  it('reflects an existing task\'s date in the JalaliDatePicker when editing', () => {
    const wrapper = mount(TaskModal, {
      props: {
        ...baseProps,
        calendar: 'jalali' as Calendar,
        task: {
          id: 't1',
          projectId: 'p1',
          title: 'Existing',
          description: '',
          date: '2024-05-18',
          status: 'active',
          notes: '',
          createdAt: now,
          updatedAt: now,
        },
      },
    })
    const picker = wrapper.findComponent(JalaliDatePicker)
    expect(picker.props('value')).toBe('2024-05-18')
  })

  it('forwards the JalaliDatePicker update event into form.date and emits a Gregorian ISO on save', async () => {
    const wrapper = mount(TaskModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    // The submit handler bails on empty title, so seed a title
    // before exercising the calendar path.
    await wrapper.find('#task-title').setValue('Buy bread')
    const picker = wrapper.findComponent(JalaliDatePicker)
    // The picker emits Gregorian ISO; the modal forwards it to
    // form.date and the submit handler echoes it back via 'save'.
    await picker.vm.$emit('update', '2024-05-18')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.emitted('save')).toBeTruthy()
    const payload = wrapper.emitted('save')?.[0]?.[0] as
      | { date: string; title: string }
      | undefined
    expect(payload).toBeDefined()
    expect(payload?.date).toBe('2024-05-18')
    expect(payload?.title).toBe('Buy bread')
  })

  it('keeps the native date input when switching from Jalali to Gregorian', async () => {
    const wrapper = mount(TaskModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    expect(wrapper.findComponent(JalaliDatePicker).exists()).toBe(true)
    await wrapper.setProps({ calendar: 'gregorian' as Calendar })
    expect(wrapper.findComponent(JalaliDatePicker).exists()).toBe(false)
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
  })

  // --------------------------------------------------------------- //
  // Source-level regression coverage for dark-mode form-control   //
  // colors (see `docs/specs/4-implement-dark-theme.md` §6.1).    //
  // --------------------------------------------------------------- //

  describe('dark-mode form-control colors (regression)', () => {
    it('does NOT reference the undefined --text token anywhere in the SFC', () => {
      expect(modalSource).not.toMatch(/var\(--text\)/)
    })

    it('sets an explicit color: var(--text-primary) on form inputs', () => {
      // The rule body is the property list of the combined
      // `.form-group input, .form-group textarea, .form-group select`
      // selector group.
      const rule = /\.form-group\s+input,\s*\.form-group\s+textarea,\s*\.form-group\s+select\s*\{([\s\S]*?)\}/
      const match = modalSource.match(rule)
      expect(match, 'expected the form-group input/textarea/select rule').toBeTruthy()
      if (!match) return
      expect(match[1]).toMatch(/color\s*:\s*var\(--text-primary\)/)
    })

    it('declares color-scheme: light dark on the native date input', () => {
      // The form-group input rule (shared with the date input via
      // the `form-group input` selector) is the carrier for the
      // native date input's color-scheme. Asserting on the same
      // rule body keeps the test close to the real source.
      const rule = /\.form-group\s+input,\s*\.form-group\s+textarea,\s*\.form-group\s+select\s*\{([\s\S]*?)\}/
      const match = modalSource.match(rule)
      expect(match).toBeTruthy()
      if (!match) return
      expect(match[1]).toMatch(/color-scheme\s*:\s*light\s+dark/)
    })
  })
})
