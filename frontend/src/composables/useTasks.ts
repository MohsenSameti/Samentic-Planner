import { ref } from 'vue'
import { api } from '../api'
import { generateId } from '../utils/id'
import type { Task } from '../types'

/**
 * Owns the `tasks` collection and the operations that mutate it.
 *
 * Notes for future maintainers:
 * - `projects` was previously a parameter to this composable but never used
 *   inside, so it was dropped. Project filtering is a derived concern
 *   (`tasksForProject`) rather than something the store needs to know.
 * - `tasksForProject` returns the live array reference, not a copy, so the
 *   caller must not mutate it. Use the returned `addTask` / `updateTask`
 *   / `deleteTask` instead.
 */
export function useTasks() {
  const tasks = ref<Task[]>([])

  const loadTasks = async (): Promise<void> => {
    tasks.value = await api.getTasks()
  }

  const addTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'notes'>,
  ): Promise<Task> => {
    const task = await api.createTask({
      ...taskData,
      id: generateId(),
      status: 'active',
      notes: '',
    })
    tasks.value.push(task)
    return task
  }

  const updateTask = async (id: string, data: Partial<Task>): Promise<Task> => {
    const updated = await api.updateTask(id, data)
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      // Preserve local-only fields by spreading in the existing task first.
      tasks.value[idx] = { ...tasks.value[idx], ...updated, updatedAt: updated.updatedAt ?? Date.now() }
    }
    return updated
  }

  /**
   * Optimistically toggles a task's status between `active` and `completed`.
   * Throws if the server rejects; the optimistic update is not rolled back
   * here because the next page load will reconcile. Callers can `await`
   * and refresh on failure if needed.
   */
  const toggleTaskStatus = async (task: Task): Promise<void> => {
    const newStatus = task.status === 'active' ? 'completed' : 'active'
    await updateTask(task.id, { status: newStatus })
  }

  const cancelTask = async (task: Task): Promise<void> => {
    await updateTask(task.id, { status: 'cancelled' })
  }

  const restoreTask = async (task: Task): Promise<void> => {
    await updateTask(task.id, { status: 'active' })
  }

  const deleteTask = async (task: Task): Promise<void> => {
    await api.deleteTask(task.id)
    tasks.value = tasks.value.filter(t => t.id !== task.id)
  }

  /**
   * Move a task to a new date. Used by drag-and-drop and the move modal.
   */
  const moveTask = async (task: Task, date: string): Promise<void> => {
    await updateTask(task.id, { date })
  }

  /**
   * Filter helper used by views. `projectId === 'all'` short-circuits to
   * the live array reference (not a copy) for performance — callers must
   * not mutate the result.
   */
  function tasksForProject(projectId: string): Task[] {
    if (projectId === 'all') return tasks.value
    return tasks.value.filter(t => t.projectId === projectId)
  }

  return {
    tasks,
    loadTasks,
    addTask,
    updateTask,
    toggleTaskStatus,
    cancelTask,
    restoreTask,
    deleteTask,
    moveTask,
    tasksForProject,
  }
}
