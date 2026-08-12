import { ref } from 'vue'
import { api } from '../api'
import { generateId } from '../utils/id'
import type { Project } from '../types'

/**
 * Owns the `projects` collection. The deletion action also clears the
 * `projectId` on any tasks that pointed at the deleted project so the
 * UI doesn't end up pointing at a dangling reference until the next
 * server-side reconcile.
 *
 * `tasks` is passed in rather than imported from `useTasks` because
 * the composables are decoupled — neither depends on the other at
 * module load.
 */
export function useProjects() {
  const projects = ref<Project[]>([])

  const loadProjects = async (): Promise<void> => {
    projects.value = await api.getProjects()
  }

  const addProject = async (
    data: Pick<Project, 'name' | 'color'>,
  ): Promise<Project> => {
    const project = await api.createProject({
      id: generateId(),
      name: data.name,
      color: data.color,
    })
    projects.value.push(project)
    return project
  }

  const updateProject = async (
    id: string,
    data: Partial<Pick<Project, 'name' | 'color'>>,
  ): Promise<Project> => {
    const updated = await api.updateProject(id, data)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      projects.value[idx] = {
        ...projects.value[idx],
        ...updated,
        updatedAt: updated.updatedAt ?? Date.now(),
      }
    }
    return updated
  }

  /**
   * Deletes a project and clears `projectId` on every task that referenced
   * it. The `tasks` array is provided by the caller (App.vue) so this
   * composable doesn't need to know about the `useTasks` composable.
   */
  const deleteProject = async (
    project: Project,
    tasks: { id: string; projectId: string }[],
  ): Promise<void> => {
    await api.deleteProject(project.id)
    projects.value = projects.value.filter(p => p.id !== project.id)
    // Clear references so the UI doesn't show a "ghost" project name.
    tasks.forEach(t => {
      if (t.projectId === project.id) t.projectId = ''
    })
  }

  return {
    projects,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
  }
}
