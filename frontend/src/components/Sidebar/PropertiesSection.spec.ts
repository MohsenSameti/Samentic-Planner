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
})
