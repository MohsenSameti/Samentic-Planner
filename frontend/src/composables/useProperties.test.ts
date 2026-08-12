/**
 * Tests for the `useProperties` composable.
 *
 * This composable uses `useDebounceFn` from `@vueuse/core` for the
 * `setPropertyValue` setter, so we use `vi.useFakeTimers()` to advance
 * the debounce window deterministically.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProperties } from './useProperties.js'
import type { Property, PropertyValue } from '../types/index.js'

vi.mock('../api.js', () => ({
  api: {
    getProperties: vi.fn(),
    getPropertyValues: vi.fn(),
    createProperty: vi.fn(),
    updateProperty: vi.fn(),
    deleteProperty: vi.fn(),
    setPropertyValue: vi.fn(),
  },
}))

import { api } from '../api.js'

const mockProperty = (overrides: Partial<Property> = {}): Property => ({
  id: 'pr1',
  name: 'Hours',
  unit: 'h',
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

const mockPropertyValue = (
  overrides: Partial<PropertyValue> = {},
): PropertyValue => ({
  id: 'pv1',
  propertyId: 'pr1',
  date: '2024-01-01',
  value: 5,
  ...overrides,
})

describe('useProperties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes empty', () => {
    const { properties, propertyValues } = useProperties()
    expect(properties.value).toEqual([])
    expect(propertyValues.value).toEqual([])
  })

  it('loadProperties fetches both definitions and values in parallel', async () => {
    const defs = [mockProperty({ id: 'pr1' })]
    const values = [mockPropertyValue({ id: 'pv1' })]
    vi.mocked(api.getProperties).mockResolvedValue(defs)
    vi.mocked(api.getPropertyValues).mockResolvedValue(values)
    const { properties, propertyValues, loadProperties } = useProperties()
    await loadProperties()
    expect(properties.value).toEqual(defs)
    expect(propertyValues.value).toEqual(values)
  })

  it('addProperty appends the created property', async () => {
    const created = mockProperty({ id: 'new' })
    vi.mocked(api.createProperty).mockResolvedValue(created)
    const { properties, addProperty } = useProperties()
    const result = await addProperty({ name: 'New', unit: 'h' })
    expect(result).toEqual(created)
    expect(properties.value).toContainEqual(created)
  })

  it('updateProperty merges updates into the matching entry', async () => {
    const existing = mockProperty({ id: 'pr1', name: 'Old' })
    const updated = mockProperty({ id: 'pr1', name: 'New' })
    vi.mocked(api.updateProperty).mockResolvedValue(updated)
    const { properties, updateProperty } = useProperties()
    properties.value = [existing]
    await updateProperty('pr1', { name: 'New' })
    expect(properties.value[0]?.name).toBe('New')
  })

  it('deleteProperty removes the property and cascades to its values', async () => {
    vi.mocked(api.deleteProperty).mockResolvedValue({ success: true })
    const { properties, propertyValues, deleteProperty } = useProperties()
    properties.value = [mockProperty({ id: 'pr1' })]
    propertyValues.value = [
      mockPropertyValue({ id: 'pv1', propertyId: 'pr1' }),
      mockPropertyValue({ id: 'pv2', propertyId: 'pr1' }),
      mockPropertyValue({ id: 'pv3', propertyId: 'other' }),
    ]
    await deleteProperty(mockProperty({ id: 'pr1' }))
    expect(properties.value).toHaveLength(0)
    expect(propertyValues.value).toHaveLength(1)
    expect(propertyValues.value[0]?.id).toBe('pv3')
  })

  describe('setPropertyValue / setPropertyValueImmediate', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('the immediate variant fires the API call right away', async () => {
      vi.mocked(api.setPropertyValue).mockResolvedValue(mockPropertyValue())
      const { setPropertyValueImmediate } = useProperties()
      await setPropertyValueImmediate('2024-01-01', 'pr1', 5)
      expect(api.setPropertyValue).toHaveBeenCalledWith({
        propertyId: 'pr1',
        date: '2024-01-01',
        value: 5,
      })
    })

    it('the debounced variant fires after the window elapses', async () => {
      vi.mocked(api.setPropertyValue).mockResolvedValue(mockPropertyValue())
      const { setPropertyValue, propertyValues } = useProperties()
      setPropertyValue('2024-01-01', 'pr1', 5)
      // The debounce window is 500ms per the source. The API call
      // AND the optimistic update must NOT have fired yet — both
      // live inside the debounced core function.
      expect(api.setPropertyValue).not.toHaveBeenCalled()
      expect(propertyValues.value).toHaveLength(0)
      // Advance past the debounce window.
      await vi.advanceTimersByTimeAsync(500)
      expect(api.setPropertyValue).toHaveBeenCalledTimes(1)
      expect(propertyValues.value).toHaveLength(1)
    })

    it('zero value removes the row optimistically', async () => {
      vi.mocked(api.setPropertyValue).mockResolvedValue(mockPropertyValue())
      const { setPropertyValueImmediate, propertyValues } = useProperties()
      propertyValues.value = [mockPropertyValue({ value: 5 })]
      await setPropertyValueImmediate('2024-01-01', 'pr1', 0)
      expect(propertyValues.value).toHaveLength(0)
    })

    it('updates an existing value optimistically', async () => {
      vi.mocked(api.setPropertyValue).mockResolvedValue(mockPropertyValue())
      const { setPropertyValueImmediate, propertyValues } = useProperties()
      propertyValues.value = [mockPropertyValue({ value: 5 })]
      await setPropertyValueImmediate('2024-01-01', 'pr1', 7)
      expect(propertyValues.value[0]?.value).toBe(7)
    })
  })
})
