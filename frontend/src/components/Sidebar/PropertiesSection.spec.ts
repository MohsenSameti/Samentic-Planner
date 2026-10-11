/**
 * Tests for the `PropertiesSection` sidebar component.
 *
 * Verifies rendering of the custom properties list, the Add Property button,
 * and the per-property accessible edit buttons.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PropertiesSection from './PropertiesSection.vue'
import type { Property } from '../../types/index.js'

const now = Date.now()

const testProperties: Property[] = [
  { id: 'prop-1', name: 'Reading', unit: 'pages', createdAt: now, updatedAt: now },
  { id: 'prop-2', name: 'Meditation', unit: 'mins', createdAt: now, updatedAt: now },
]

describe('PropertiesSection', () => {
  it('renders property items with names and units', () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: testProperties },
    })
    const items = wrapper.findAll('.property-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Reading')
    expect(items[0].text()).toContain('pages')
    expect(items[1].text()).toContain('Meditation')
    expect(items[1].text()).toContain('mins')
  })

  it('renders an edit button with accessible name for each property', () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: testProperties },
    })
    const editButtons = wrapper.findAll('.property-edit-btn')
    expect(editButtons).toHaveLength(2)

    expect(editButtons[0].attributes('aria-label')).toBe('Edit Reading')
    expect(editButtons[1].attributes('aria-label')).toBe('Edit Meditation')
  })

  it('emits "edit" with the property when an edit button is clicked', async () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: testProperties },
    })
    const editButtons = wrapper.findAll('.property-edit-btn')
    await editButtons[0].trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')?.[0]).toEqual([testProperties[0]])
  })

  it('emits "add" when the Add Property button is clicked', async () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: testProperties },
    })
    const addBtn = wrapper.find('.add-btn')
    await addBtn.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
  })

  it('renders empty-state text and Add Property button when properties is empty', () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: [] },
    })
    const emptyMsg = wrapper.find('.property-empty')
    expect(emptyMsg.exists()).toBe(true)
    expect(emptyMsg.text()).toBe('No trackers yet.')
    expect(wrapper.findAll('.property-item')).toHaveLength(0)
    expect(wrapper.find('.add-btn').exists()).toBe(true)
    expect(wrapper.find('.add-btn').text()).toContain('Add Property')
  })

  it('does not render empty-state text when properties are present', () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: testProperties },
    })
    expect(wrapper.find('.property-empty').exists()).toBe(false)
  })

  it('emits "add" when Add Property is clicked in empty state', async () => {
    const wrapper = mount(PropertiesSection, {
      props: { properties: [] },
    })
    const addBtn = wrapper.find('.add-btn')
    await addBtn.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
  })
})
