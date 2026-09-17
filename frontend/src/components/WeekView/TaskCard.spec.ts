/**
 * Tests for the `TaskCard` component.
 *
 * `TaskCard` owns its own UI state (notes expansion, menu open/closed,
 * notes buffer) — none of that is exposed as a prop. Tests therefore
 * drive the component through user events: clicks on the menu button,
 * keyboard activation of the checkbox, etc.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import TaskCard from './TaskCard.vue'
import { mountWithActions } from '../../composables/test-utils'
import type { Project, Task } from '../../types/index.js'

const now = Date.now()

const baseTask: Task = {
  id: 't1',
  projectId: 'p1',
  title: 'Test Task',
  description: '',
  date: '2024-01-01',
  status: 'active',
  notes: '',
  createdAt: now,
  updatedAt: now,
}

const baseProject: Project = {
  id: 'p1',
  name: 'Project A',
  color: '#FF0000',
  createdAt: now,
  updatedAt: now,
}

describe('TaskCard', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })
  describe('rendering', () => {
    it('renders the task title', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-title').text()).toBe('Test Task')
    })

    it('renders the description when provided', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, description: 'A description' }, project: baseProject },
      })
      expect(wrapper.find('.task-description').text()).toBe('A description')
    })

    it('omits the description block when the description is empty', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-description').exists()).toBe(false)
    })

    it('renders the project badge when a project is provided', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-project').exists()).toBe(true)
      expect(wrapper.find('.task-project-name').text()).toBe('Project A')
    })

    it('omits the project block when project is null', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: null },
      })
      expect(wrapper.find('.task-project').exists()).toBe(false)
    })

    it('applies the project color to the project dot', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      const dot = wrapper.find('.task-project-dot')
      expect(dot.attributes('style')).toContain('#FF0000')
    })
  })

  describe('status styling', () => {
    it('applies the .completed class to a completed task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('completed')
    })

    it('applies the .cancelled class to a cancelled task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('cancelled')
    })

    it('marks the checkbox as checked when status is completed', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').classes()).toContain('checked')
      expect(wrapper.find('.task-checkbox').attributes('aria-checked')).toBe('true')
    })
  })

  /**
   * Colour-per-state assertions for spec §4. The old code dimmed the
   * container with `opacity: 0.6` / `0.4`, which dropped text
   * contrast below AA. The fix uses foreground tokens
   * (`--text-completed`, `--text-cancelled`). The component imports
   * the `<style scoped>` block, so the values are resolved via
   * `getComputedStyle` against the resolved `--text-completed` /
   * `--text-cancelled` values from `style.css`. We read those values
   * from the stylesheet source so the test is independent of how the
   * cascade resolves the `var()` calls.
   */
  describe('colour per state (spec §4)', () => {
    it('does NOT set container-level opacity on completed cards', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      // `opacity` on the container used to halve contrast; now no
      // container-level `opacity` declaration exists, and the resolved
      // computed opacity is the browser default `1`. happy-dom
      // returns `''` for unset properties — both are valid signals
      // that no explicit opacity was applied.
      const card = wrapper.find('.task-card').element as HTMLElement
      const computed = window.getComputedStyle(card).opacity
      expect(computed === '' || computed === '1').toBe(true)
    })

    it('does NOT set container-level opacity on cancelled cards', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      const card = wrapper.find('.task-card').element as HTMLElement
      const computed = window.getComputedStyle(card).opacity
      expect(computed === '' || computed === '1').toBe(true)
    })

    it('keeps the .completed class on the root so the structural kicker (line-through, foreground token) is reachable', () => {
      // The colour swap is on the *foreground*, not the container, so
      // the structural `.completed` class must still apply so the CSS
      // selectors `.task-card.completed .task-title { color: var(--text-completed); text-decoration: line-through; }`
      // can reach the title. The actual rendering is a CSS concern;
      // happy-dom does not resolve `var()` so we pin the class only.
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('completed')
      expect(wrapper.find('.task-title').exists()).toBe(true)
    })

    it('reads the resolved --text-completed / --text-cancelled tokens from style.css', () => {
      // Sanity check that the tokens declared in `style.css` are the
      // same ones referenced by the TaskCard — catches accidental
      // divergence between the two layers.
      const css = readFileSync(
        resolve(process.cwd(), 'src/style.css'),
        'utf8',
      )
      expect(css).toMatch(/--text-completed\s*:\s*#[0-9A-Fa-f]+/)
      expect(css).toMatch(/--text-cancelled\s*:\s*#[0-9A-Fa-f]+/)
      // The token references in TaskCard must use `var(--text-completed)`
      // / `var(--text-cancelled)`, not a hex literal of their own.
      const taskCardCss = readFileSync(
        resolve(process.cwd(), 'src/components/WeekView/TaskCard.vue'),
        'utf8',
      )
      expect(taskCardCss).toMatch(/var\(--text-completed\)/)
      expect(taskCardCss).toMatch(/var\(--text-cancelled\)/)
    })
  })

  describe('toggle-status', () => {
    it('calls toggleTaskStatus when the checkbox is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('click')
      expect(actions.toggleTaskStatus).toHaveBeenCalledWith(baseTask)
    })

    it('calls toggleTaskStatus on Enter', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('keydown.enter')
      expect(actions.toggleTaskStatus).toHaveBeenCalledWith(baseTask)
    })

    it('calls toggleTaskStatus on Space', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      await wrapper.find('.task-checkbox').trigger('keydown.space')
      expect(actions.toggleTaskStatus).toHaveBeenCalledWith(baseTask)
    })
  })

  describe('draggable', () => {
    it('is draggable when the task is not cancelled', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-card').attributes('draggable')).toBe('true')
    })

    it('is not draggable when the task is cancelled', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').attributes('draggable')).toBe('false')
    })
  })

  describe('menu', () => {
    it('teleports the menu to document.body when opened', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const menuEl = document.body.querySelector('.task-menu')
      expect(menuEl).not.toBeNull()
      expect(wrapper.find('.task-card').element.contains(menuEl)).toBe(false)
      wrapper.unmount()
    })

    it('closes the menu when Escape key is pressed', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(document.body.querySelector('.task-menu.open')).not.toBeNull()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.task-menu.open')).toBeNull()
      wrapper.unmount()
    })

    it('closes the menu when clicking outside', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(document.body.querySelector('.task-menu.open')).not.toBeNull()

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.task-menu.open')).toBeNull()
      wrapper.unmount()
    })

    it('closes the menu on window scroll', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(document.body.querySelector('.task-menu.open')).not.toBeNull()

      window.dispatchEvent(new Event('scroll'))
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.task-menu.open')).toBeNull()
      wrapper.unmount()
    })

    it('closes the menu on window resize', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(document.body.querySelector('.task-menu.open')).not.toBeNull()

      window.dispatchEvent(new Event('resize'))
      await wrapper.vm.$nextTick()

      expect(document.body.querySelector('.task-menu.open')).toBeNull()
      wrapper.unmount()
    })

    it('opens the menu when the kebab button is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      expect(document.body.querySelector('.task-menu')?.classList.contains('open')).toBeFalsy()
      await wrapper.find('.task-menu-btn').trigger('click')
      expect(document.body.querySelector('.task-menu')?.classList.contains('open')).toBe(true)
      wrapper.unmount()
    })

    it('shows edit / move / cancel items when the task is active', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      const labels = items.map(i => i.textContent || '')
      expect(labels.some(l => l.includes('Edit'))).toBe(true)
      expect(labels.some(l => l.includes('Move'))).toBe(true)
      expect(labels.some(l => l.includes('Cancel'))).toBe(true)
      wrapper.unmount()
    })

    it('shows restore / delete items when the task is cancelled', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      const labels = items.map(i => i.textContent || '')
      expect(labels.some(l => l.includes('Restore'))).toBe(true)
      expect(labels.some(l => l.includes('Delete'))).toBe(true)
      // Active-only items should not appear.
      expect(labels.some(l => l.includes('Move'))).toBe(false)
      wrapper.unmount()
    })

    it('calls editTask when the Edit item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Edit'))!.click()
      await wrapper.vm.$nextTick()
      expect(actions.editTask).toHaveBeenCalledWith(baseTask)
      wrapper.unmount()
    })

    it('calls moveTask when the Move item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Move'))!.click()
      await wrapper.vm.$nextTick()
      expect(actions.moveTask).toHaveBeenCalledWith(baseTask)
      wrapper.unmount()
    })

    /**
     * Spec §21 acceptance: on a touch viewport a task can be moved
     * to another day in ≤3 taps. The flow is:
     *   1. Tap the 44px kebab (§6 bump)
     *   2. Tap the "Move to..." menu item
     *   3. Pick the target in the existing MoveModal
     * The modal is the only destination UI; desktop mouse drag is
     * unchanged. Pointer-event drag between columns is explicitly
     * deferred to a follow-up task — see the spec.
     */
    describe('touch-reachable Move to... (spec §21)', () => {
      it('exposes "Move to..." in the kebab menu of an active task', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        const items = Array.from(
          document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
        )
        const labels = items.map(i => i.textContent || '')
        const hasMove = labels.some(l => l.toLowerCase().includes('move to'))
        expect(hasMove).toBe(true)
        wrapper.unmount()
      })

      it('calls moveTask when the menu\'s Move item is clicked', async () => {
        const { wrapper, actions } = mountWithActions(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        const items = Array.from(
          document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
        )
        const moveItem = items.find(
          i => (i.textContent || '').toLowerCase().includes('move to'),
        )
        expect(moveItem).toBeDefined()
        moveItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(actions.moveTask).toHaveBeenCalledWith(baseTask)
        wrapper.unmount()
      })
    })

    it('calls cancelTask when the Cancel item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Cancel'))!.click()
      await wrapper.vm.$nextTick()
      expect(actions.cancelTask).toHaveBeenCalledWith(baseTask)
      wrapper.unmount()
    })

    it('calls restoreTask when the Restore item is clicked', async () => {
      const cancelledTask = { ...baseTask, status: 'cancelled' as const }
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: cancelledTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Restore'))!.click()
      await wrapper.vm.$nextTick()
      expect(actions.restoreTask).toHaveBeenCalledWith(cancelledTask)
      wrapper.unmount()
    })

    it('calls deleteTask when the Delete item is clicked', async () => {
      const cancelledTask = { ...baseTask, status: 'cancelled' as const }
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: cancelledTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Delete'))!.click()
      await wrapper.vm.$nextTick()
      expect(actions.deleteTask).toHaveBeenCalledWith(cancelledTask)
      wrapper.unmount()
    })
  })

  describe('notes', () => {
    it('does not show the notes textarea by default', () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      expect(wrapper.find('.task-notes').classes()).not.toContain('expanded')
    })

    it('expands the notes block when the Add Notes menu item is clicked', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.task-notes').classes()).toContain('expanded')
      wrapper.unmount()
    })

    it('calls updateTaskNotes with the new value on textarea blur', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      // Open the notes section.
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('New note content')
      await textarea.trigger('blur')
      expect(actions.updateTaskNotes).toHaveBeenCalledWith(baseTask, 'New note content')
      wrapper.unmount()
    })

    it('seeds the textarea with the task notes prop on mount', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, notes: 'existing' }, project: baseProject },
      })
      // The notes block is collapsed by default, but the prop value
      // is mirrored into a local ref. Force-expansion to assert.
      const vm = wrapper.vm as unknown as { notes: string }
      expect(vm.notes).toBe('existing')
    })
  })

  describe('drag start', () => {
    it('sets the task id as the drag data transfer payload', () => {
      // We test the underlying handler by dispatching the event with
      // a stub `dataTransfer` on the actual DOM element so the
      // property survives Vue Test Utils' trigger wrapping.
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
      })
      const setData = vi.fn()
      const card = wrapper.find('.task-card').element as HTMLElement
      // `dispatchEvent` accepts a generic Event; the handler reads
      // `dataTransfer` off it, so we patch the property in.
      const event = new Event('dragstart', { bubbles: true, cancelable: true }) as Event & {
        dataTransfer?: unknown
      }
      event.dataTransfer = { setData, getData: () => 't1' }
      card.dispatchEvent(event)
      expect(setData).toHaveBeenCalledWith('text/plain', 't1')
    })

    it('cancels a drag for a cancelled task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
      })
      const setData = vi.fn()
      const card = wrapper.find('.task-card').element as HTMLElement
      const event = new Event('dragstart', { bubbles: true, cancelable: true }) as Event & {
        dataTransfer?: unknown
      }
      event.dataTransfer = { setData, getData: () => '' }
      card.dispatchEvent(event)
      // The handler short-circuits without calling setData.
      expect(setData).not.toHaveBeenCalled()
    })
  })
})
