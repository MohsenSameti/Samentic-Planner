/**
 * Generates a reasonably-unique identifier suitable for client-side entity
 * creation (tasks, projects, properties, etc.). The value is sent to the
 * server, which may rewrite it; this is only used to satisfy the typed
 * `id` field on creation and to give the optimistic update a stable key.
 *
 * Composition: a base-36 timestamp + random suffix. Not cryptographically
 * random — collisions are vanishingly unlikely in a single-user planner
 * but should not be relied on where uniqueness is critical.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
