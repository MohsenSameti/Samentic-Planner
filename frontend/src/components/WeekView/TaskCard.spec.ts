/**
 * Tests for the `TaskCard` component.
 *
 * `TaskCard` owns its own UI state (notes expansion, menu open/closed,
 * notes buffer) — none of that is exposed as a prop. Tests therefore
 * drive the component through user events: clicks on the menu button,
 * keyboard activation of the checkbox, etc.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

    it('applies the .skipped class to a skipped task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').classes()).toContain('skipped')
    })

    it('marks the checkbox as mixed when status is skipped', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').classes()).toContain('indeterminate')
      expect(wrapper.find('.task-checkbox').attributes('aria-checked')).toBe('mixed')
    })

    it('does not mark the checkbox as checked when status is skipped', () => {
      // Skipped and completed are mutually-exclusive visual states; a
      // skipped card must not carry the `.checked` class.
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').classes()).not.toContain('checked')
    })
  })

  describe('accessible name (spec §3.2)', () => {
    it('exposes "Mark \'<title>\' complete" on the checkbox for an active task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, title: 'Call Sam', status: 'active' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').attributes('aria-label')).toBe("Mark 'Call Sam' complete")
    })

    it('exposes "Mark \'<title>\' incomplete" on the checkbox for a completed task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, title: 'Call Sam', status: 'completed' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').attributes('aria-label')).toBe("Mark 'Call Sam' incomplete")
    })

    it('exposes "Mark \'<title>\' complete" on the checkbox for a skipped task', () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, title: 'Call Sam', status: 'skipped' }, project: baseProject },
      })
      expect(wrapper.find('.task-checkbox').attributes('aria-label')).toBe("Mark 'Call Sam' complete")
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

    it('reads the resolved --text-completed / --text-cancelled / --text-skipped tokens from style.css', () => {
      // Sanity check that the tokens declared in `style.css` are the
      // same ones referenced by the TaskCard — catches accidental
      // divergence between the two layers.
      const css = readFileSync(
        resolve(process.cwd(), 'src/style.css'),
        'utf8',
      )
      expect(css).toMatch(/--text-completed\s*:\s*#[0-9A-Fa-f]+/)
      expect(css).toMatch(/--text-cancelled\s*:\s*#[0-9A-Fa-f]+/)
      expect(css).toMatch(/--text-skipped\s*:\s*#[0-9A-Fa-f]+/)
      // The token references in TaskCard must use `var(--text-completed)`
      // / `var(--text-cancelled)` / `var(--text-skipped)`, not a hex literal of their own.
      const taskCardCss = readFileSync(
        resolve(process.cwd(), 'src/components/WeekView/TaskCard.vue'),
        'utf8',
      )
      expect(taskCardCss).toMatch(/var\(--text-completed\)/)
      expect(taskCardCss).toMatch(/var\(--text-cancelled\)/)
      expect(taskCardCss).toMatch(/var\(--text-skipped\)/)
    })

    it('applies strike-through to title, description, and project name in TaskCard.vue for skipped tasks (spec §9)', () => {
      const taskCardCss = readFileSync(
        resolve(process.cwd(), 'src/components/WeekView/TaskCard.vue'),
        'utf8',
      )
      expect(taskCardCss).toMatch(
        /\.task-card\.skipped\s+\.task-title,\s*\n\.task-card\.skipped\s+\.task-description,\s*\n\.task-card\.skipped\s+\.task-project-name\s*\{[^}]*text-decoration:\s*line-through;/,
      )
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

    it('is draggable when the task is skipped (deferred, not terminal)', () => {
      // Skipping is a temporary deferral; the user may still want to
      // drag the task to another day or reorder within the column.
      // Only `cancelled` is the drag-disabled state.
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
      })
      expect(wrapper.find('.task-card').attributes('draggable')).toBe('true')
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

    it('orders active-menu items as Edit, Notes, Move, Skip, Cancel', async () => {
      // Locks in the per-item order so a future refactor can't
      // accidentally bury Skip/Unskip at the bottom or move Cancel
      // away from the destructive position.
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => (i.textContent || '').trim())
      // Find the index of each expected label and assert ordering.
      const editIdx = labels.findIndex(l => l === 'Edit')
      const notesIdx = labels.findIndex(l => l === 'Add Notes' || l === 'Hide Notes')
      const moveIdx = labels.findIndex(l => l === 'Move to...')
      const skipIdx = labels.findIndex(l => l === 'Skip')
      const cancelIdx = labels.findIndex(l => l === 'Cancel')
      expect(editIdx).toBeGreaterThanOrEqual(0)
      expect(notesIdx).toBeGreaterThan(editIdx)
      expect(moveIdx).toBeGreaterThan(notesIdx)
      expect(skipIdx).toBeGreaterThan(moveIdx)
      expect(cancelIdx).toBeGreaterThan(skipIdx)
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

    it('shows a Skip item when the task is active', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => i.textContent || '')
      expect(labels.some(l => l.trim() === 'Skip')).toBe(true)
      expect(labels.some(l => l.trim() === 'Unskip')).toBe(false)
      wrapper.unmount()
    })

    it('shows a Skip item when the task is completed (one-click override)', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => i.textContent || '')
      expect(labels.some(l => l.trim() === 'Skip')).toBe(true)
      expect(labels.some(l => l.trim() === 'Unskip')).toBe(false)
      wrapper.unmount()
    })

    it('shows an Unskip item when the task is skipped', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => i.textContent || '')
      expect(labels.some(l => l.trim() === 'Unskip')).toBe(true)
      expect(labels.some(l => l.trim() === 'Skip')).toBe(false)
      wrapper.unmount()
    })

    it('hides Skip / Unskip when the task is cancelled (must restore first)', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'cancelled' }, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => i.textContent || '')
      expect(labels.some(l => l.trim() === 'Skip')).toBe(false)
      expect(labels.some(l => l.trim() === 'Unskip')).toBe(false)
      wrapper.unmount()
    })

    it('hides Cancel when the task is skipped (must unskip to active first)', async () => {
      const wrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'skipped' }, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const labels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => (i.textContent || '').trim())
      expect(labels.some(l => l === 'Cancel')).toBe(false)
      wrapper.unmount()
    })

    it('shows Cancel when the task is active or completed', async () => {
      const activeWrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'active' }, project: baseProject },
        attachTo: document.body,
      })
      await activeWrapper.find('.task-menu-btn').trigger('click')
      const activeLabels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => (i.textContent || '').trim())
      expect(activeLabels.some(l => l === 'Cancel')).toBe(true)
      activeWrapper.unmount()

      const completedWrapper = mount(TaskCard, {
        props: { task: { ...baseTask, status: 'completed' }, project: baseProject },
        attachTo: document.body,
      })
      await completedWrapper.find('.task-menu-btn').trigger('click')
      const completedLabels = Array.from(
        document.body.querySelectorAll<HTMLElement>('.task-menu-item'),
      ).map(i => (i.textContent || '').trim())
      expect(completedLabels.some(l => l === 'Cancel')).toBe(true)
      completedWrapper.unmount()
    })

    it('emits the skip action when the Skip menu item is clicked', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').trim() === 'Skip')!.click()
      await wrapper.vm.$nextTick()
      expect(actions.skipTask).toHaveBeenCalledWith(baseTask)
      wrapper.unmount()
    })

    it('calls skipTask when the Skip menu item is clicked on a completed task', async () => {
      const completedTask = { ...baseTask, status: 'completed' as const }
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: completedTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').trim() === 'Skip')!.click()
      await wrapper.vm.$nextTick()
      expect(actions.skipTask).toHaveBeenCalledWith(completedTask)
      wrapper.unmount()
    })

    describe('skipped ↔ cancelled two-step transition enforcement (spec §Out of scope)', () => {
      it('locks skipped → cancelled into a two-click transition via active', async () => {
        // Step 1: On a skipped task, Cancel is hidden; user can only Unskip to active.
        const skippedTask = { ...baseTask, status: 'skipped' as const }
        const { wrapper, actions } = mountWithActions(TaskCard, {
          props: { task: skippedTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        let items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
        let labels = items.map(i => (i.textContent || '').trim())
        expect(labels.includes('Cancel')).toBe(false)
        expect(labels.includes('Unskip')).toBe(true)

        // Click Unskip -> triggers unskipTask
        items.find(i => (i.textContent || '').trim() === 'Unskip')!.click()
        await wrapper.vm.$nextTick()
        expect(actions.unskipTask).toHaveBeenCalledWith(skippedTask)
        expect(actions.cancelTask).not.toHaveBeenCalled()

        // Step 2: Once the task returns to active, Cancel becomes available.
        await wrapper.setProps({ task: { ...skippedTask, status: 'active' } })
        await wrapper.find('.task-menu-btn').trigger('click')
        items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
        labels = items.map(i => (i.textContent || '').trim())
        expect(labels.includes('Cancel')).toBe(true)

        items.find(i => (i.textContent || '').trim() === 'Cancel')!.click()
        await wrapper.vm.$nextTick()
        expect(actions.cancelTask).toHaveBeenCalledWith({ ...skippedTask, status: 'active' })
        wrapper.unmount()
      })

      it('locks cancelled → skipped into a two-click transition via active', async () => {
        // Step 1: On a cancelled task, Skip is hidden; user can only Restore to active.
        const cancelledTask = { ...baseTask, status: 'cancelled' as const }
        const { wrapper, actions } = mountWithActions(TaskCard, {
          props: { task: cancelledTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        let items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
        let labels = items.map(i => (i.textContent || '').trim())
        expect(labels.includes('Skip')).toBe(false)
        expect(labels.includes('Unskip')).toBe(false)
        expect(labels.includes('Restore')).toBe(true)

        // Click Restore -> triggers restoreTask
        items.find(i => (i.textContent || '').trim() === 'Restore')!.click()
        await wrapper.vm.$nextTick()
        expect(actions.restoreTask).toHaveBeenCalledWith(cancelledTask)
        expect(actions.skipTask).not.toHaveBeenCalled()

        // Step 2: Once the task returns to active, Skip becomes available.
        await wrapper.setProps({ task: { ...cancelledTask, status: 'active' } })
        await wrapper.find('.task-menu-btn').trigger('click')
        items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
        labels = items.map(i => (i.textContent || '').trim())
        expect(labels.includes('Skip')).toBe(true)

        items.find(i => (i.textContent || '').trim() === 'Skip')!.click()
        await wrapper.vm.$nextTick()
        expect(actions.skipTask).toHaveBeenCalledWith({ ...cancelledTask, status: 'active' })
        wrapper.unmount()
      })
    })

    it('emits the unskip action when the Unskip menu item is clicked', async () => {
      const skippedTask = { ...baseTask, status: 'skipped' as const }
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: skippedTask, project: baseProject },
        attachTo: document.body,
      })
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').trim() === 'Unskip')!.click()
      await wrapper.vm.$nextTick()
      expect(actions.unskipTask).toHaveBeenCalledWith(skippedTask)
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

    describe('keyboard accessibility (spec §3.1)', () => {
      it('renders menu items as native button elements with role="menuitem"', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
        expect(items.length).toBeGreaterThan(0)
        for (const item of items) {
          expect(item.tagName.toLowerCase()).toBe('button')
          expect(item.getAttribute('type')).toBe('button')
          expect(item.getAttribute('role')).toBe('menuitem')
        }
        wrapper.unmount()
      })

      it('moves focus to the first menu item on opening the menu', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        await wrapper.vm.$nextTick()
        const firstItem = document.body.querySelector<HTMLButtonElement>('.task-menu-item')
        expect(firstItem).not.toBeNull()
        expect(document.activeElement).toBe(firstItem)
        wrapper.unmount()
      })

      it('navigates between menu items using ArrowDown and ArrowUp with circular wrapping', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        await wrapper.vm.$nextTick()
        const items = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.task-menu-item'))
        expect(items.length).toBeGreaterThanOrEqual(2)
        expect(document.activeElement).toBe(items[0])

        // ArrowDown moves to next item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        expect(document.activeElement).toBe(items[1])

        // ArrowUp moves back to first item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
        expect(document.activeElement).toBe(items[0])

        // ArrowUp from first item wraps to last item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
        expect(document.activeElement).toBe(items[items.length - 1])

        // ArrowDown from last item wraps to first item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        expect(document.activeElement).toBe(items[0])

        wrapper.unmount()
      })

      it('navigates to the first and last menu items using Home and End', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        await wrapper.find('.task-menu-btn').trigger('click')
        await wrapper.vm.$nextTick()
        const items = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.task-menu-item'))
        expect(items.length).toBeGreaterThanOrEqual(3)

        // Move to middle item first
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
        expect(document.activeElement).toBe(items[1])

        // End moves to last item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
        expect(document.activeElement).toBe(items[items.length - 1])

        // Home moves to first item
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
        expect(document.activeElement).toBe(items[0])

        wrapper.unmount()
      })

      it('closes menu and restores focus to the trigger button on Escape', async () => {
        const wrapper = mount(TaskCard, {
          props: { task: baseTask, project: baseProject },
          attachTo: document.body,
        })
        const triggerBtn = wrapper.find<HTMLButtonElement>('.task-menu-btn').element
        triggerBtn.focus()
        expect(document.activeElement).toBe(triggerBtn)

        await wrapper.find('.task-menu-btn').trigger('click')
        await wrapper.vm.$nextTick()
        expect(document.body.querySelector('.task-menu.open')).not.toBeNull()

        const stopPropagationSpy = vi.fn()
        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        escapeEvent.stopPropagation = stopPropagationSpy
        document.dispatchEvent(escapeEvent)
        await wrapper.vm.$nextTick()

        expect(document.body.querySelector('.task-menu.open')).toBeNull()
        expect(stopPropagationSpy).toHaveBeenCalled()
        expect(document.activeElement).toBe(triggerBtn)

        wrapper.unmount()
      })
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

  describe('theme-aware status card background tokens (Task 4.2)', () => {
    const taskCardSource = readFileSync(
      resolve(process.cwd(), 'src/components/WeekView/TaskCard.vue'),
      'utf8',
    )

    it('has no hardcoded light gradient start literals (#EBE7DE, #EAE3DB, #EDE6D6)', () => {
      expect(taskCardSource).not.toMatch(/#EBE7DE/i)
      expect(taskCardSource).not.toMatch(/#EAE3DB/i)
      expect(taskCardSource).not.toMatch(/#EDE6D6/i)
    })

    it('references theme-aware gradient start tokens', () => {
      expect(taskCardSource).toContain('var(--task-completed-bg)')
      expect(taskCardSource).toContain('var(--task-cancelled-bg)')
      expect(taskCardSource).toContain('var(--task-skipped-bg)')
    })
  })

  describe('mobile touch hit areas (Task 5.1)', () => {
    const taskCardSource = readFileSync(
      resolve(process.cwd(), 'src/components/WeekView/TaskCard.vue'),
      'utf8',
    )

    it('bumps .task-menu-btn to 44x44px on mobile', () => {
      expect(taskCardSource).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.task-menu-btn\s*\{[^}]*width:\s*44px;\s*height:\s*44px;/)
    })

    it('expands .task-checkbox touch hit area to at least 44x44px via ::after on mobile', () => {
      expect(taskCardSource).toMatch(/@media\s*\(\s*max-width\s*:\s*768px\s*\)[\s\S]*\.task-checkbox::after\s*\{[^}]*width:\s*44px;\s*height:\s*44px;/)
    })
  })

  describe('notes save status feedback (Task 6.2)', () => {
    it('shows saving status while task note save is in flight', async () => {
      let resolvePromise!: () => void
      const pendingPromise = new Promise<void>(resolve => {
        resolvePromise = resolve
      })
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      actions.updateTaskNotes.mockReturnValue(pendingPromise)

      // Open notes
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('new task note')
      await textarea.trigger('blur')

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('saving')
      expect(statusEl.text()).toBe('Saving…')
      expect(statusEl.attributes('aria-live')).toBe('polite')

      resolvePromise()
      await flushPromises()
      wrapper.unmount()
    })

    it('shows saved status after successful task note save and returns to idle after timeout', async () => {
      vi.useFakeTimers()
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      actions.updateTaskNotes.mockResolvedValue(undefined)

      // Open notes
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('saved task note')
      await textarea.trigger('blur')
      await flushPromises()

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('saved')
      expect(statusEl.text()).toBe('Saved')

      // Advance time past the transient status timeout (2000ms)
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.note-save-status').exists()).toBe(false)
      vi.useRealTimers()
      wrapper.unmount()
    })

    it('shows error status with role="alert" when task note save fails', async () => {
      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      actions.updateTaskNotes.mockRejectedValue(new Error('Network error'))

      // Open notes
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')
      await textarea.setValue('failed task note')
      await textarea.trigger('blur')
      await flushPromises()

      const statusEl = wrapper.find('.note-save-status')
      expect(statusEl.exists()).toBe(true)
      expect(statusEl.classes()).toContain('error')
      expect(statusEl.text()).toBe('Save failed')
      expect(statusEl.attributes('role')).toBe('alert')
      wrapper.unmount()
    })

    it('race condition: older save resolving does not overwrite newer save status', async () => {
      let resolveFirst!: () => void
      let resolveSecond!: () => void
      const firstPromise = new Promise<void>(resolve => {
        resolveFirst = resolve
      })
      const secondPromise = new Promise<void>(resolve => {
        resolveSecond = resolve
      })

      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      actions.updateTaskNotes
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      // Open notes
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')

      // First blur
      await textarea.setValue('task note 1')
      await textarea.trigger('blur')

      // Second blur
      await textarea.setValue('task note 2')
      await textarea.trigger('blur')

      expect(wrapper.find('.note-save-status').classes()).toContain('saving')

      // Second completes first
      resolveSecond()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')

      // Older first save completes later
      resolveFirst()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')
      wrapper.unmount()
    })

    it('race condition: older save rejecting does not overwrite newer save status', async () => {
      let rejectFirst!: (err: Error) => void
      let resolveSecond!: () => void
      const firstPromise = new Promise<void>((_, reject) => {
        rejectFirst = reject
      })
      const secondPromise = new Promise<void>(resolve => {
        resolveSecond = resolve
      })

      const { wrapper, actions } = mountWithActions(TaskCard, {
        props: { task: baseTask, project: baseProject },
        attachTo: document.body,
      })
      actions.updateTaskNotes
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise)

      // Open notes
      await wrapper.find('.task-menu-btn').trigger('click')
      const items = Array.from(document.body.querySelectorAll<HTMLElement>('.task-menu-item'))
      items.find(i => (i.textContent || '').includes('Notes'))!.click()
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')

      // First blur
      await textarea.setValue('task note 1')
      await textarea.trigger('blur')

      // Second blur
      await textarea.setValue('task note 2')
      await textarea.trigger('blur')

      // First save fails after second started
      rejectFirst(new Error('Old failure'))
      await flushPromises()

      // Should still be saving
      expect(wrapper.find('.note-save-status').classes()).toContain('saving')
      expect(wrapper.find('.note-save-status').text()).toBe('Saving…')

      // Second save succeeds
      resolveSecond()
      await flushPromises()

      expect(wrapper.find('.note-save-status').classes()).toContain('saved')
      expect(wrapper.find('.note-save-status').text()).toBe('Saved')
      wrapper.unmount()
    })
  })
})



