/**
 * Integration test for the Property Edit flow.
 *
 * Verifies that clicking a property's edit button in the Sidebar dispatches
 * `edit-property`, correctly opens `PropertyModal` in edit mode populated with
 * the selected property, and allows editing/saving or deleting.
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import PropertyModal from '../../modals/PropertyModal.vue'
import type { Calendar, Project, Property, Task, Theme, WeekStartDay } from '../../types/index.js'

const now = Date.now()

const testProperty: Property = {
  id: 'prop-1',
  name: 'Reading',
  unit: 'pages',
  createdAt: now,
  updatedAt: now,
}

const Harness = defineComponent({
  components: { Sidebar, PropertyModal },
  setup() {
    const properties = ref<Property[]>([testProperty])
    const editingProperty = ref<Property | null>(null)
    const propertyModalOpen = ref(false)

    function openPropertyModal(property?: Property): void {
      editingProperty.value = property ?? null
      propertyModalOpen.value = true
    }

    return { properties, editingProperty, propertyModalOpen, openPropertyModal }
  },
  render(): ReturnType<typeof h> {
    return h('div', [
      h(Sidebar, {
        projects: [] as Project[],
        properties: this.properties,
        tasks: [] as Task[],
        selectedProject: 'all',
        weeklyPropertySums: [],
        theme: 'system' as Theme,
        weekStart: 1 as WeekStartDay,
        calendar: 'gregorian' as Calendar,
        collapsed: false,
        onSelectProject: () => {},
        onAddProject: () => {},
        onEditProject: () => {},
        onAddProperty: () => this.openPropertyModal(),
        onEditProperty: (p: Property) => this.openPropertyModal(p),
      }),
      h(PropertyModal, {
        show: this.propertyModalOpen,
        property: this.editingProperty,
        onClose: () => {
          this.propertyModalOpen = false
        },
        onSave: (payload: { id?: string; name: string; unit: string }) => {
          if (payload.id) {
            const idx = this.properties.findIndex(p => p.id === payload.id)
            if (idx !== -1) {
              this.properties[idx] = {
                ...this.properties[idx],
                name: payload.name,
                unit: payload.unit,
              }
            }
          }
          this.propertyModalOpen = false
        },
        onDelete: () => {
          this.propertyModalOpen = false
        },
      }),
    ])
  },
})

describe('Property Edit Integration (Sidebar → PropertyModal)', () => {
  it('opens PropertyModal in edit mode when the property edit button is clicked', async () => {
    const wrapper = mount(Harness)

    const editBtn = wrapper.find('.property-edit-btn')
    expect(editBtn.exists()).toBe(true)
    expect(editBtn.attributes('aria-label')).toBe('Edit Reading')

    // Modal is initially closed
    expect(wrapper.findComponent(PropertyModal).props('show')).toBe(false)

    // Click edit button
    await editBtn.trigger('click')

    const modal = wrapper.findComponent(PropertyModal)
    expect(modal.props('show')).toBe(true)
    expect(modal.props('property')).toEqual(testProperty)
    expect(modal.text()).toContain('Edit Property')

    // Form inputs prefilled
    const nameInput = modal.find<HTMLInputElement>('#property-name')
    expect(nameInput.element.value).toBe('Reading')

    const unitInput = modal.find<HTMLInputElement>('#property-unit')
    expect(unitInput.element.value).toBe('pages')

    // Delete button exists in edit mode
    expect(modal.find('.btn-danger').exists()).toBe(true)
  })
})
