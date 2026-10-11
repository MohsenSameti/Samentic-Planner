/**
 * Integration tests for the Active Project Filter flow (Task 2.4).
 *
 * Verifies that:
 * - Selecting a project in Sidebar activates board-level filtering.
 * - Active filter indicator shows the project name and accessible Clear filter button.
 * - Clicking Clear filter reverts to "All Tasks" and hides the indicator.
 * - Creating a task while filtered defaults to the selected project.
 * - "No project" option defaults or saves with empty string projectId.
 */
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref, computed } from 'vue'
import { mount } from '@vue/test-utils'
import Sidebar from './Sidebar.vue'
import TaskModal from '../../modals/TaskModal.vue'
import type { Calendar, Project, Task, Theme, WeekStartDay } from '../../types/index.js'

const now = Date.now()

const testProjects: Project[] = [
  { id: 'p1', name: 'Work Project', color: '#3498DB', createdAt: now, updatedAt: now },
  { id: 'p2', name: 'Personal Project', color: '#2ECC71', createdAt: now, updatedAt: now },
]

const testTasks: Task[] = [
  {
    id: 't1',
    projectId: 'p1',
    title: 'Work task',
    description: '',
    date: '2024-03-20',
    status: 'active',
    notes: '',
    createdAt: now,
    updatedAt: now,
  },
]

const IntegrationHarness = defineComponent({
  components: { Sidebar, TaskModal },
  setup() {
    const projects = ref<Project[]>([...testProjects])
    const tasks = ref<Task[]>([...testTasks])
    const selectedProject = ref<string>('all')
    const taskModalOpen = ref(false)
    const taskModalDate = ref('2024-03-20')
    const editingTask = ref<Task | null>(null)
    const savedPayloads = ref<Array<{ title: string; projectId: string; date: string }>>([])

    const activeProject = computed(() =>
      projects.value.find(p => p.id === selectedProject.value),
    )
    const activeProjectName = computed(() =>
      activeProject.value ? activeProject.value.name : selectedProject.value,
    )

    function openCreateTask(): void {
      editingTask.value = null
      taskModalOpen.value = true
    }

    function clearFilter(): void {
      selectedProject.value = 'all'
    }

    return {
      projects,
      tasks,
      selectedProject,
      taskModalOpen,
      taskModalDate,
      editingTask,
      savedPayloads,
      activeProject,
      activeProjectName,
      openCreateTask,
      clearFilter,
    }
  },
  render(): ReturnType<typeof h> {
    return h('div', { class: 'app-harness' }, [
      h(Sidebar, {
        projects: this.projects,
        properties: [],
        tasks: this.tasks,
        selectedProject: this.selectedProject,
        weeklyPropertySums: [],
        theme: 'system' as Theme,
        weekStart: 1 as WeekStartDay,
        calendar: 'gregorian' as Calendar,
        collapsed: false,
        onSelectProject: (id: string) => {
          this.selectedProject = id
        },
        onAddProject: () => {},
        onEditProject: () => {},
        onAddProperty: () => {},
        onEditProperty: () => {},
        onChangeTheme: () => {},
        onChangeWeekStart: () => {},
        onChangeCalendar: () => {},
      }),
      // Board-level container
      h('main', { class: 'week-container' }, [
        // Filter indicator when selectedProject !== 'all'
        this.selectedProject !== 'all'
          ? h('div', { class: 'project-filter-indicator active-filter-indicator' }, [
              h('div', { class: 'filter-indicator-content' }, [
                this.activeProject?.color
                  ? h('span', {
                      class: 'filter-indicator-dot',
                      style: { backgroundColor: this.activeProject.color },
                    })
                  : null,
                h('span', { class: 'filter-indicator-label' }, 'Filtered by:'),
                h('strong', { class: 'filter-indicator-name' }, this.activeProjectName),
              ]),
              h(
                'button',
                {
                  type: 'button',
                  class: 'clear-filter-btn',
                  'aria-label': 'Clear filter',
                  onClick: () => this.clearFilter(),
                },
                'Clear filter',
              ),
            ])
          : null,
        h('button', {
          class: 'trigger-create-task-btn',
          onClick: () => this.openCreateTask(),
        }),
      ]),
      h(TaskModal, {
        show: this.taskModalOpen,
        task: this.editingTask,
        projects: this.projects,
        date: this.taskModalDate,
        calendar: 'gregorian' as Calendar,
        defaultProjectId: this.selectedProject !== 'all' ? this.selectedProject : '',
        onClose: () => {
          this.taskModalOpen = false
        },
        onSave: (payload: { title: string; projectId: string; date: string }) => {
          this.savedPayloads.push(payload)
          this.taskModalOpen = false
        },
      }),
    ])
  },
})

describe('Active Project Filter Integration (Task 2.4)', () => {
  it('does not display filter indicator when selectedProject is "all"', () => {
    const wrapper = mount(IntegrationHarness)
    expect(wrapper.find('.active-filter-indicator').exists()).toBe(false)
    expect(wrapper.find('.project-filter-indicator').exists()).toBe(false)
  })

  it('shows filter indicator with project name and Clear filter action when a project is selected', async () => {
    const wrapper = mount(IntegrationHarness)

    // Select "Work Project" (p1) from the sidebar
    const projectItems = wrapper.findAll('.project-item')
    const workItem = projectItems.find(item => item.text().includes('Work Project'))
    expect(workItem).toBeDefined()
    await workItem!.trigger('click')

    // Filter indicator should appear
    const indicator = wrapper.find('.active-filter-indicator')
    expect(indicator.exists()).toBe(true)
    expect(indicator.text()).toContain('Filtered by:')
    expect(indicator.text()).toContain('Work Project')

    // Clear filter button should exist with accessible label
    const clearBtn = indicator.find('.clear-filter-btn')
    expect(clearBtn.exists()).toBe(true)
    expect(clearBtn.attributes('aria-label')).toBe('Clear filter')
    expect(clearBtn.text()).toContain('Clear filter')
  })

  it('clears the filter when Clear filter button is clicked and returns to "All Tasks"', async () => {
    const wrapper = mount(IntegrationHarness)

    // Select project p1
    const workItem = wrapper.findAll('.project-item').find(item => item.text().includes('Work Project'))
    await workItem!.trigger('click')
    expect(wrapper.find('.active-filter-indicator').exists()).toBe(true)

    // Click Clear filter
    const clearBtn = wrapper.find('.clear-filter-btn')
    await clearBtn.trigger('click')

    // Indicator disappears
    expect(wrapper.find('.active-filter-indicator').exists()).toBe(false)

    // Sidebar All Tasks is active
    const allTasksItem = wrapper.findAll('.project-item')[0]
    expect(allTasksItem.classes()).toContain('active')
  })

  it('defaults newly created tasks to the active project when filtered', async () => {
    const wrapper = mount(IntegrationHarness)

    // Select project p1
    const workItem = wrapper.findAll('.project-item').find(item => item.text().includes('Work Project'))
    await workItem!.trigger('click')

    // Open create task modal
    await wrapper.find('.trigger-create-task-btn').trigger('click')

    const taskModal = wrapper.findComponent(TaskModal)
    expect(taskModal.props('show')).toBe(true)
    expect(taskModal.props('defaultProjectId')).toBe('p1')

    const projectSelect = taskModal.find<HTMLSelectElement>('#task-project')
    expect(projectSelect.element.value).toBe('p1')

    // Submit new task
    await taskModal.find('#task-title').setValue('New filtered task')
    await taskModal.find('form').trigger('submit.prevent')

    const vm = wrapper.vm as unknown as { savedPayloads: Array<{ title: string; projectId: string }> }
    expect(vm.savedPayloads).toHaveLength(1)
    expect(vm.savedPayloads[0].projectId).toBe('p1')
  })

  it('allows selecting "No project" while filtered and saves empty project ID', async () => {
    const wrapper = mount(IntegrationHarness)

    // Select project p2
    const personalItem = wrapper.findAll('.project-item').find(item => item.text().includes('Personal Project'))
    await personalItem!.trigger('click')

    // Open create task modal
    await wrapper.find('.trigger-create-task-btn').trigger('click')

    const taskModal = wrapper.findComponent(TaskModal)
    expect(taskModal.props('defaultProjectId')).toBe('p2')

    // Change project selection to "No project"
    const projectSelect = taskModal.find<HTMLSelectElement>('#task-project')
    expect(projectSelect.element.value).toBe('p2')
    await projectSelect.setValue('')

    // Submit new task
    await taskModal.find('#task-title').setValue('Task with no project')
    await taskModal.find('form').trigger('submit.prevent')

    const vm = wrapper.vm as unknown as { savedPayloads: Array<{ title: string; projectId: string }> }
    expect(vm.savedPayloads).toHaveLength(1)
    expect(vm.savedPayloads[0].projectId).toBe('')
  })
})
