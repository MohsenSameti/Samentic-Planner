/**
 * Sort tasks by status bucket and creation time.
 *
 * Bucket order: `active` < `completed` < `skipped` < `cancelled`.
 * Within each bucket, sort by `createdAt` ascending (older first),
 * with `id` as a final tiebreaker for deterministic ordering.
 *
 * This is the canonical order used by both `WeekView` (per-day
 * column) and `DayView` (focused single-day view). Keeping it in one
 * place ensures both views render the same day the same way, even
 * when one of them adds a new state — only the buckets here need to
 * change.
 */
import type { Task } from '../types'

/** Bucket index for a task's status. Lower buckets render first. */
export function taskStatusBucket(t: Task): number {
  if (t.status === 'active') return 0
  if (t.status === 'completed') return 1
  if (t.status === 'skipped') return 2
  return 3 // cancelled
}

/**
 * Comparator that places tasks in the canonical order:
 *
 *   1. by `taskStatusBucket` (ascending)
 *   2. by `createdAt` (ascending — older first)
 *   3. by `id` (lexicographic, final tiebreaker)
 *
 * The secondary keys keep the relative order of unrelated tasks
 * stable when a single task's status toggles — otherwise toggling
 * one task could re-shuffle every other card in the column.
 */
export function compareTasksByStatus(a: Task, b: Task): number {
  const sb = taskStatusBucket(a) - taskStatusBucket(b)
  if (sb !== 0) return sb
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
