/**
 * Integration tests for the `MoveModal` component, focused on the
 * calendar-aware date input. The modal swaps between a native
 * `<input type="date">` (Gregorian) and a `<JalaliDatePicker>`
 * (Jalali) based on the `calendar` prop.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveModal from './MoveModal.vue'
import JalaliDatePicker from '../components/common/JalaliDatePicker.vue'
import type { Calendar, Task } from '../types/index.js'

const now = Date.now()

const baseTask: Task = {
  id: 't1',
  projectId: 'p1',
  title: 'Existing',
  description: '',
  date: '2024-03-20',
  status: 'active',
  notes: '',
  createdAt: now,
  updatedAt: now,
}

const baseProps = {
  show: true,
  task: baseTask,
  calendar: 'gregorian' as Calendar,
}

describe('MoveModal', () => {
  it('renders a native date input when calendar is "gregorian"', () => {
    const wrapper = mount(MoveModal, { props: baseProps })
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    expect(wrapper.findComponent(JalaliDatePicker).exists()).toBe(false)
  })

  it('renders a JalaliDatePicker when calendar is "jalali"', () => {
    const wrapper = mount(MoveModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    const picker = wrapper.findComponent(JalaliDatePicker)
    expect(picker.exists()).toBe(true)
    // The picker initialises from the task's current date.
    expect(picker.props('value')).toBe('2024-03-20')
  })

  it('re-syncs the picker when the task prop changes (e.g. opening for a different task)', async () => {
    const wrapper = mount(MoveModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    expect(wrapper.findComponent(JalaliDatePicker).props('value')).toBe('2024-03-20')
    const otherTask: Task = {
      ...baseTask,
      id: 't2',
      date: '2024-05-18',
    }
    await wrapper.setProps({ task: otherTask })
    expect(wrapper.findComponent(JalaliDatePicker).props('value')).toBe('2024-05-18')
  })

  it('forwards the JalaliDatePicker update into the move payload', async () => {
    const wrapper = mount(MoveModal, {
      props: { ...baseProps, calendar: 'jalali' as Calendar },
    })
    const picker = wrapper.findComponent(JalaliDatePicker)
    await picker.vm.$emit('update', '2024-05-18')
    await wrapper.find('form').trigger('submit.prevent')
    expect(wrapper.emitted('move')).toBeTruthy()
    const payload = wrapper.emitted('move')?.[0] as
      | [Task, string]
      | undefined
    expect(payload).toBeDefined()
    expect(payload?.[0].id).toBe('t1')
    expect(payload?.[1]).toBe('2024-05-18')
  })
})
