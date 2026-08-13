/**
 * Integration tests for the `TaskModal` component, focused on the
 * calendar-aware date input. The modal swaps between a native
 * `<input type="date">` (Gregorian) and a `<JalaliDatePicker>`
 * (Jalali) based on the `calendar` prop.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskModal from './TaskModal.vue'
import JalaliDatePicker from '../components/common/JalaliDatePicker.vue'
import type { Calendar, Project } from '../types/index.js'

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
})
