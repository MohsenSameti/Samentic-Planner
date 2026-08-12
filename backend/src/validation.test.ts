/**
 * Unit tests for the Zod validation schemas in `validation.ts`.
 *
 * These schemas are the only line of defence against malformed data
 * entering the store via the API. Tests cover both happy-path parsing
 * and the rejection cases we rely on for input safety.
 */
import { describe, it, expect } from 'vitest'
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  CreatePropertySchema,
  UpdatePropertySchema,
  CreatePropertyValueSchema,
  DayNoteSchema,
  WeekNoteSchema,
  SettingsSchema,
  IdParamSchema,
} from './validation.js'

describe('Project schemas', () => {
  describe('CreateProjectSchema', () => {
    it('accepts a minimal valid project', () => {
      const result = CreateProjectSchema.parse({ name: 'Test', color: '#E74C3C' })
      expect(result.name).toBe('Test')
      expect(result.color).toBe('#E74C3C')
    })

    it('accepts both 3-digit and 6-digit hex colors', () => {
      expect(() => CreateProjectSchema.parse({ name: 'A', color: '#FFF' })).not.toThrow()
      expect(() => CreateProjectSchema.parse({ name: 'A', color: '#FFFFFF' })).not.toThrow()
    })

    it('rejects missing name', () => {
      expect(() => CreateProjectSchema.parse({ color: '#000' })).toThrow()
    })

    it('rejects empty name', () => {
      expect(() => CreateProjectSchema.parse({ name: '', color: '#000' })).toThrow()
    })

    it('rejects an invalid hex color', () => {
      expect(() => CreateProjectSchema.parse({ name: 'A', color: 'red' })).toThrow()
      expect(() => CreateProjectSchema.parse({ name: 'A', color: '#GG0000' })).toThrow()
    })

    it('rejects a name longer than 100 characters', () => {
      expect(() => CreateProjectSchema.parse({ name: 'a'.repeat(101), color: '#000' })).toThrow()
    })
  })

  describe('UpdateProjectSchema', () => {
    it('accepts an empty update (no fields required)', () => {
      expect(() => UpdateProjectSchema.parse({})).not.toThrow()
    })

    it('accepts partial updates', () => {
      const result = UpdateProjectSchema.parse({ name: 'New' })
      expect(result.name).toBe('New')
    })
  })
})

describe('Task schemas', () => {
  describe('CreateTaskSchema', () => {
    it('accepts a minimal valid task', () => {
      const result = CreateTaskSchema.parse({
        projectId: 'p1',
        title: 'A',
        description: '',
        date: '2024-01-01',
        status: 'active',
        notes: '',
      })
      expect(result.title).toBe('A')
      expect(result.status).toBe('active')
    })

    it('rejects an invalid status', () => {
      expect(() =>
        CreateTaskSchema.parse({
          projectId: 'p1',
          title: 'A',
          description: '',
          date: '2024-01-01',
          status: 'invalid',
          notes: '',
        })
      ).toThrow()
    })

    it('rejects a non-ISO date', () => {
      expect(() =>
        CreateTaskSchema.parse({
          projectId: 'p1',
          title: 'A',
          description: '',
          date: '01-01-2024',
          status: 'active',
          notes: '',
        })
      ).toThrow()
    })

    it('accepts all three valid statuses', () => {
      for (const status of ['active', 'completed', 'cancelled']) {
        expect(() =>
          CreateTaskSchema.parse({
            projectId: 'p1',
            title: 'A',
            description: '',
            date: '2024-01-01',
            status,
            notes: '',
          })
        ).not.toThrow()
      }
    })

    it('rejects a title longer than 500 characters', () => {
      expect(() =>
        CreateTaskSchema.parse({
          projectId: 'p1',
          title: 'a'.repeat(501),
          description: '',
          date: '2024-01-01',
          status: 'active',
          notes: '',
        })
      ).toThrow()
    })
  })

  describe('UpdateTaskSchema', () => {
    it('accepts an empty update', () => {
      expect(() => UpdateTaskSchema.parse({})).not.toThrow()
    })
  })
})

describe('Property schemas', () => {
  it('accepts a valid property', () => {
    const result = CreatePropertySchema.parse({ name: 'Hours', unit: 'h' })
    expect(result.name).toBe('Hours')
    expect(result.unit).toBe('h')
  })

  it('rejects a missing name', () => {
    expect(() => CreatePropertySchema.parse({ unit: 'h' })).toThrow()
  })

  it('accepts a partial update', () => {
    const result = UpdatePropertySchema.parse({ unit: 'min' })
    expect(result.unit).toBe('min')
  })
})

describe('PropertyValue schemas', () => {
  it('accepts a valid property value', () => {
    const result = CreatePropertyValueSchema.parse({
      propertyId: 'p1',
      date: '2024-01-01',
      value: 5,
    })
    expect(result.value).toBe(5)
  })

  it('accepts zero (the "clear" signal)', () => {
    expect(() =>
      CreatePropertyValueSchema.parse({
        propertyId: 'p1',
        date: '2024-01-01',
        value: 0,
      })
    ).not.toThrow()
  })

  it('accepts negative values', () => {
    // Some planners may use negative values (e.g. corrections).
    // The schema doesn't restrict the sign.
    expect(() =>
      CreatePropertyValueSchema.parse({
        propertyId: 'p1',
        date: '2024-01-01',
        value: -3,
      })
    ).not.toThrow()
  })

  it('rejects a non-ISO date', () => {
    expect(() =>
      CreatePropertyValueSchema.parse({
        propertyId: 'p1',
        date: '2024/01/01',
        value: 5,
      })
    ).toThrow()
  })
})

describe('Note schemas', () => {
  it('accepts a valid day note', () => {
    const result = DayNoteSchema.parse({ date: '2024-01-01', note: 'hi' })
    expect(result.note).toBe('hi')
  })

  it('accepts an empty day note', () => {
    expect(() => DayNoteSchema.parse({ date: '2024-01-01', note: '' })).not.toThrow()
  })

  it('accepts a valid week note', () => {
    const result = WeekNoteSchema.parse({ weekStart: '2024-01-01', note: 'plan' })
    expect(result.note).toBe('plan')
  })

  it('rejects malformed ISO dates in week notes', () => {
    expect(() => WeekNoteSchema.parse({ weekStart: 'not-a-date', note: 'plan' })).toThrow()
  })
})

describe('IdParamSchema', () => {
  it('accepts a non-empty id', () => {
    const result = IdParamSchema.parse({ id: 'abc123' })
    expect(result.id).toBe('abc123')
  })

  it('rejects an empty id', () => {
    expect(() => IdParamSchema.parse({ id: '' })).toThrow()
  })
})

describe('SettingsSchema', () => {
  it('accepts a valid weekStart value', () => {
    const result = SettingsSchema.parse({ weekStart: 1 })
    expect(result.weekStart).toBe(1)
  })

  it('accepts every numeric day-of-week (0..6)', () => {
    for (let day = 0; day <= 6; day++) {
      const result = SettingsSchema.parse({ weekStart: day })
      expect(result.weekStart).toBe(day)
    }
  })

  it('rejects negative weekStart values', () => {
    expect(() => SettingsSchema.parse({ weekStart: -1 })).toThrow()
  })

  it('rejects weekStart values above 6', () => {
    expect(() => SettingsSchema.parse({ weekStart: 7 })).toThrow()
  })

  it('rejects non-integer weekStart values', () => {
    expect(() => SettingsSchema.parse({ weekStart: 1.5 })).toThrow()
  })

  it('rejects a missing weekStart', () => {
    expect(() => SettingsSchema.parse({})).toThrow()
  })
})
