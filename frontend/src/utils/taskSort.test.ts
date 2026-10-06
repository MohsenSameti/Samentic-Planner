/**
 * Tests for the canonical task-sorting comparator.
 *
 * The comparator is the single source of truth for per-day task
 * ordering, used by `WeekView` and `DayView`. These tests pin the
 * bucket order and the secondary keys (createdAt, id).
 */
import { describe, expect, it } from 'vitest'
import { compareTasksByStatus, taskStatusBucket } from './taskSort'
import type { Task } from '../types'

const t = (id: string, status: Task['status'], createdAt: number): Task => ({
  id,
  projectId: 'p1',
  title: `Task ${id}`,
  description: '',
  date: '2024-01-01',
  status,
  notes: '',
  createdAt,
  updatedAt: createdAt,
})

describe('taskStatusBucket', () => {
  it('orders active < completed < skipped < cancelled', () => {
    const a = t('a', 'active', 0)
    const c = t('c', 'completed', 0)
    const s = t('s', 'skipped', 0)
    const x = t('x', 'cancelled', 0)
    expect(taskStatusBucket(a)).toBeLessThan(taskStatusBucket(c))
    expect(taskStatusBucket(c)).toBeLessThan(taskStatusBucket(s))
    expect(taskStatusBucket(s)).toBeLessThan(taskStatusBucket(x))
  })
})

describe('compareTasksByStatus', () => {
  it('places skipped between completed and cancelled regardless of creation time', () => {
    const tasks = [
      t('cancelled', 'cancelled', 999),
      t('skipped', 'skipped', 999),
      t('completed', 'completed', 999),
      t('active', 'active', 999),
    ]
    const sorted = [...tasks].sort(compareTasksByStatus)
    expect(sorted.map(x => x.id)).toEqual(['active', 'completed', 'skipped', 'cancelled'])
  })

  it('breaks ties within a bucket by createdAt ascending (older first)', () => {
    const tasks = [
      t('newer-active', 'active', 200),
      t('older-active', 'active', 100),
      t('mid-active', 'active', 150),
    ]
    const sorted = [...tasks].sort(compareTasksByStatus)
    expect(sorted.map(x => x.id)).toEqual(['older-active', 'mid-active', 'newer-active'])
  })

  it('breaks createdAt ties by id (lexicographic) for deterministic order', () => {
    const tasks = [
      t('c', 'active', 100),
      t('a', 'active', 100),
      t('b', 'active', 100),
    ]
    const sorted = [...tasks].sort(compareTasksByStatus)
    expect(sorted.map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
})
