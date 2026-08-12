/**
 * Tests for the ID generator.
 *
 * `generateId()` produces a base-36 timestamp + random suffix. We can
 * only assert on shape and uniqueness in a long-enough sample — the
 * timestamp part will collide on rapid successive calls, so the random
 * suffix is what makes the IDs distinct.
 */
import { describe, expect, it } from 'vitest'
import { generateId } from './id.js'

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns distinct values across many calls', () => {
    // 1000 IDs is more than enough to exercise the random suffix;
    // base-36 timestamp collisions are expected but random suffix
    // differences make duplicates vanishingly unlikely.
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()))
    expect(ids.size).toBe(1000)
  })

  it('contains only base-36 characters (0-9, a-z)', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-z]+$/)
  })
})
