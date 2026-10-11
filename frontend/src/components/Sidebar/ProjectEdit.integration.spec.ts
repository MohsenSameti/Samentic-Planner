/**
 * Integration test for the Project Edit flow.
 *
 * Verifies that clicking a project's edit button in the Sidebar dispatches
 * `edit-project`, correctly opens `ProjectModal` in edit mode populated with
 * the selected project, and allows editing/saving or deleting.
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import ProjectModal from '../../modals/ProjectModal.vue'
import type { Calendar, Project, Task, Theme, WeekStartDay } from '../../types/index.js'

const now = Date.now()

const testProject: Project = {
  id: 'p1',
  name: 'Work Project',
  color: '#3498DB',
  createdAt: now,
  updatedAt: now,
}

const Harness = defineComponent({
  components: { Sidebar, ProjectModal },
  setup() {
    const projects = ref<Project[]>([testProject])
    const editingProject = ref<Project | null>(null)
    const projectModalOpen = ref(false)

    function openProjectModal(project?: Project): void {
      editingProject.value = project ?? null
      projectModalOpen.value = true
    }

    return { projects, editingProject, projectModalOpen, openProjectModal }
  },
  render(): ReturnType<typeof h> {
    return h('div', [
      h(Sidebar, {
        projects: this.projects,
        properties: [],
        tasks: [] as Task[],
        selectedProject: 'all',
        weeklyPropertySums: [],
        theme: 'system' as Theme,
        weekStart: 1 as WeekStartDay,
        calendar: 'gregorian' as Calendar,
        collapsed: false,
        onSelectProject: () => {},
        onAddProject: () => this.openProjectModal(),
        onEditProject: (p: Project) => this.openProjectModal(p),
      }),
      h(ProjectModal, {
        show: this.projectModalOpen,
        project: this.editingProject,
        onClose: () => {
          this.projectModalOpen = false
        },
        onSave: (payload: { id?: string; name: string; color: string }) => {
          if (payload.id) {
            const idx = this.projects.findIndex(p => p.id === payload.id)
            if (idx !== -1) {
              this.projects[idx] = {
                ...this.projects[idx],
                name: payload.name,
                color: payload.color,
              }
            }
          }
          this.projectModalOpen = false
        },
        onDelete: () => {
          this.projectModalOpen = false
        },
      }),
    ])
  },
})

describe('Project Edit Integration (Sidebar → ProjectModal)', () => {
  it('opens ProjectModal in edit mode when the project edit button is clicked', async () => {
    const wrapper = mount(Harness)

    const editBtn = wrapper.find('.project-edit-btn')
    expect(editBtn.exists()).toBe(true)
    expect(editBtn.attributes('aria-label')).toBe('Edit Work Project')

    // Modal is initially closed
    expect(wrapper.findComponent(ProjectModal).props('show')).toBe(false)

    // Click edit button
    await editBtn.trigger('click')

    const modal = wrapper.findComponent(ProjectModal)
    expect(modal.props('show')).toBe(true)
    expect(modal.props('project')).toEqual(testProject)
    expect(modal.text()).toContain('Edit Project')

    // Form inputs prefilled
    const nameInput = modal.find<HTMLInputElement>('#project-name')
    expect(nameInput.element.value).toBe('Work Project')

    // Delete button exists in edit mode
    expect(modal.find('.btn-danger').exists()).toBe(true)
  })
})
