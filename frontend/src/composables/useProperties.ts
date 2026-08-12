import { ref } from 'vue'
import { api } from '../api'
import { generateId } from '../utils/id'
import type { Property, PropertyValue } from '../types'

/**
 * Owns both `properties` (the *definitions*) and `propertyValues`
 * (the per-day numbers) — they're tightly coupled and almost always
 * needed together, so they're managed in one composable rather than two.
 */
export function useProperties() {
  const properties = ref<Property[]>([])
  const propertyValues = ref<PropertyValue[]>([])

  const loadProperties = async (): Promise<void> => {
    // Both endpoints are independent — run them in parallel to halve the
    // perceived load time. Either failure surfaces via the shared
    // `apiError` ref in `api.ts`.
    const [defs, values] = await Promise.all([
      api.getProperties(),
      api.getPropertyValues(),
    ])
    properties.value = defs
    propertyValues.value = values
  }

  const addProperty = async (
    data: Pick<Property, 'name' | 'unit'>,
  ): Promise<Property> => {
    const prop = await api.createProperty({
      id: generateId(),
      name: data.name,
      unit: data.unit,
    })
    properties.value.push(prop)
    return prop
  }

  const updateProperty = async (
    id: string,
    data: Partial<Pick<Property, 'name' | 'unit'>>,
  ): Promise<Property> => {
    const updated = await api.updateProperty(id, data)
    const idx = properties.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      properties.value[idx] = {
        ...properties.value[idx],
        ...updated,
        updatedAt: updated.updatedAt ?? Date.now(),
      }
    }
    return updated
  }

  /**
   * Deletes a property and every `propertyValue` row that pointed at it.
   * The values are filtered out locally so the UI updates immediately.
   */
  const deleteProperty = async (property: Property): Promise<void> => {
    await api.deleteProperty(property.id)
    properties.value = properties.value.filter(p => p.id !== property.id)
    propertyValues.value = propertyValues.value.filter(
      pv => pv.propertyId !== property.id,
    )
  }

  /**
   * Sets a property value for a given date. `value === 0` is treated as
   * "delete the row" — the server endpoint behaves the same way, but we
   * splice locally so the UI updates immediately without a refetch.
   */
  const setPropertyValue = async (
    date: string,
    propertyId: string,
    value: number,
  ): Promise<void> => {
    await api.setPropertyValue({ propertyId, date, value })
    const idx = propertyValues.value.findIndex(
      pv => pv.date === date && pv.propertyId === propertyId,
    )
    if (idx !== -1) {
      if (value) {
        propertyValues.value[idx] = { ...propertyValues.value[idx], value }
      } else {
        propertyValues.value.splice(idx, 1)
      }
    } else if (value) {
      propertyValues.value.push({ id: generateId(), propertyId, date, value })
    }
  }

  return {
    properties,
    propertyValues,
    loadProperties,
    addProperty,
    updateProperty,
    deleteProperty,
    setPropertyValue,
  }
}
