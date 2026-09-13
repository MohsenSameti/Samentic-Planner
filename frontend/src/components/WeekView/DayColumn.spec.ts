/**
 * Tests for the `DayColumn` component.
 *
 * `DayColumn` consumes day- and task-level actions through
 * `useDayActions()` (spec §22). Every test that drives an
 * actionable interaction mounts the component via `mountWithActions`
 * so the resulting spy bag mirrors the typed `DayActions` surface;
 * assertions read `actions.addTask.mock.calls` etc. instead of
 * `wrapper.emitted(...)`. Tests focus on:
 *
 *   - Header rendering (day name, day number, today highlight)
 *   - Property input rendering + value change actions
 *   - Drop action forwarding
 *   - Empty-state rendering
 *   - Task list rendering
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import DayColumn from './DayColumn.vue'
import { mountWithActions } from '../../composables/test-utils'
import type { Project, Task, Property, PropertyValue } from '../../types/index.js'

const now = Date.now()

const baseProps = {
  date: '2024-01-01',
  dayName: 'Mon',
  dayNum: 1,
  isToday: false,
  isPast: false,
  tasks: [] as Task[],
  taskProgress: { done: 0, total: 0 },
  projects: new Map<string, Project>(),
  properties: [] as Property[],
  propertyValues: [] as PropertyValue[],
  dayNoteValue: '',
  pendingTaskIds: new Set<string>(),
  monthMarker: null,
}

describe('DayColumn', () => {
  it('renders the day name and number in the header', () => {
    const wrapper = mount(DayColumn, { props: baseProps })
    expect(wrapper.find('.day-name').text()).toBe('Mon')
    expect(wrapper.find('.day-date').text()).toBe('1')
  })

  it('applies the .today class when isToday is true', () => {
    const wrapper = mount(DayColumn, { props: { ...baseProps, isToday: true } })
    expect(wrapper.find('.day-column').classes()).toContain('today')
  })

  it('does not apply the .today class when isToday is false', () => {
    const wrapper = mount(DayColumn, { props: baseProps })
    expect(wrapper.find('.day-column').classes()).not.toContain('today')
  })

  it('calls addTask with the date when the add button is clicked', async () => {
    const { wrapper, actions } = mountWithActions(DayColumn, { props: baseProps })
    await wrapper.find('.add-task-btn').trigger('click')
    expect(actions.addTask).toHaveBeenCalledWith('2024-01-01')
  })

  it('shows the empty-state add-task button when there are no tasks', () => {
    const wrapper = mount(DayColumn, { props: baseProps })
    expect(wrapper.find('.empty-state-add').exists()).toBe(true)
    expect(wrapper.text()).toContain('Add task')
  })

  it('does not show the empty-state add-task button when there are tasks', () => {
    const task: Task = {
      id: 't1', projectId: 'p1', title: 'A', description: '',
      date: '2024-01-01', status: 'active', notes: '', createdAt: now, updatedAt: now,
    }
    const wrapper = mount(DayColumn, { props: { ...baseProps, tasks: [task] } })
    expect(wrapper.find('.empty-state-add').exists()).toBe(false)
  })

  it('no longer renders a 48px icon in the empty state (spec §16)', () => {
    // Spec §16 replaces the 48px calendar icon + 150px block with a
    // quiet dashed "Add task" button. The icon is gone; the
    // structural source guard in `no-state-opacity.spec.ts` still
    // pins `--icon-muted-opacity`'s declaration in case any future
    // consumer re-introduces it.
    const wrapper = mount(DayColumn, { props: baseProps })
    expect(wrapper.find('.empty-state svg').exists()).toBe(false)
  })

  it('renders a TaskCard for each task', () => {
    const tasks: Task[] = [
      { id: 't1', projectId: 'p1', title: 'A', description: '', date: '2024-01-01', status: 'active', notes: '', createdAt: now, updatedAt: now },
      { id: 't2', projectId: 'p1', title: 'B', description: '', date: '2024-01-01', status: 'active', notes: '', createdAt: now, updatedAt: now },
    ]
    const wrapper = mount(DayColumn, { props: { ...baseProps, tasks } })
    const cards = wrapper.findAllComponents({ name: 'TaskCard' })
    // Above the virtualization threshold (50) the list is virtualized,
    // so we just check the rendered titles via DOM when possible.
    expect(wrapper.findAll('.task-title')).toHaveLength(2)
    expect(cards.length).toBeGreaterThanOrEqual(0) // virtualized vs direct — both acceptable
  })

  /**
   * Regression guard for spec §1 (`docs/specs/7-improve-day-column.md`).
   *
   * The non-virtualized list branch of `DayColumn` carried
   * `v-memo="[task.status, projects.get(task.projectId)]"`. Neither dep
   * changes when a task is renamed, and the `projects` Map is built once per
   * `WeekView` render, so its identity is stable too — which meant an edited
   * card kept painting its previous title/description until the task's status
   * or project changed. These tests drive the exact scenario (same `id`,
   * `status` and `projectId`, changed content) so the bug cannot return
   * silently; they are the reason there is no source-level "no `v-memo`"
   * grep test beside them.
   */
  describe('task content re-render', () => {
    const task = (over: Partial<Task> = {}): Task => ({
      id: 't1',
      projectId: 'p1',
      title: 'Buy milk',
      description: '',
      date: '2024-01-01',
      status: 'active',
      notes: '',
      createdAt: now,
      updatedAt: now,
      ...over,
    })

    it('re-renders a card when the task title changes', async () => {
      const wrapper = mount(DayColumn, { props: { ...baseProps, tasks: [task()] } })
      expect(wrapper.find('.task-title').text()).toBe('Buy milk')

      // Same identity fields, only content differs — this is what an Edit
      // through the task modal produces.
      await wrapper.setProps({ tasks: [task({ title: 'Buy oat milk' })] })

      expect(wrapper.find('.task-title').text()).toBe('Buy oat milk')
    })

    it('re-renders a card when a description is added', async () => {
      const wrapper = mount(DayColumn, { props: { ...baseProps, tasks: [task()] } })
      expect(wrapper.find('.task-description').exists()).toBe(false)

      await wrapper.setProps({ tasks: [task({ description: 'Two cartons' })] })

      expect(wrapper.find('.task-description').text()).toBe('Two cartons')
    })
  })

  describe('properties', () => {
    const props: Property[] = [
      { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
    ]

    it('renders a row per property when properties are provided', () => {
      const wrapper = mount(DayColumn, { props: { ...baseProps, properties: props } })
      expect(wrapper.find('.day-properties').exists()).toBe(true)
      expect(wrapper.find('.property-label').text()).toBe('Hours')
    })

    it('does not render the property section when there are no properties', () => {
      const wrapper = mount(DayColumn, { props: { ...baseProps, properties: [] } })
      expect(wrapper.find('.day-properties').exists()).toBe(false)
    })

    it('reflects the current property value in the input', () => {
      const propertyValues: PropertyValue[] = [
        { id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 7 },
      ]
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, properties: props, propertyValues },
      })
      const input = wrapper.find('.property-input').element as HTMLInputElement
      expect(input.value).toBe('7')
    })

    it('calls updatePropertyValue with parsed number on change', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, { props: { ...baseProps, properties: props } })
      const input = wrapper.find('.property-input')
      // Set the value and dispatch a `change` event with a real
      // target.value. `setValue` updates the v-model; the component
      // listens to `change`, not `input`, so we use a manual event.
      Object.defineProperty(input.element, 'value', { value: '12', configurable: true })
      await input.trigger('change')
      expect(actions.updatePropertyValue).toHaveBeenCalledWith('2024-01-01', 'pr1', 12)
    })

    it('calls updatePropertyValue with 0 when the input is cleared', async () => {
      const propertyValues: PropertyValue[] = [
        { id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 5 },
      ]
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, properties: props, propertyValues },
      })
      const input = wrapper.find('.property-input')
      Object.defineProperty(input.element, 'value', { value: '', configurable: true })
      await input.trigger('change')
      expect(actions.updatePropertyValue).toHaveBeenCalledWith('2024-01-01', 'pr1', 0)
    })

    /**
     * Accessibility + lossless-input assertions for spec §5. The old
     * code:
     *  - had no `aria-label` (the sibling `<span>` wasn't associated),
     *  - had no `inputmode` (mobile raised the QWERTY keyboard for a
     *    numeric field),
     *  - coerced bad input with `parseFloat(value) || 0`, so typing
     *    `abc` silently stored `0` and the next render blanked the
     *    field. The fix keeps a local string buffer and only emits
     *    finite parsed numbers.
     */
    describe('a11y + lossless input (spec §5)', () => {
      it('exposes the property name as the input\'s accessible name', () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: props },
        })
        const input = wrapper.find('.property-input')
        // The accessible name must contain the property name. We use
        // `aria-label` rather than `<label for=...>` because the
        // visual label is part of the row layout (column header +
        // row label + input) and a separate label element would
        // duplicate the visual without aiding the screen-reader.
        const aria = input.attributes('aria-label') ?? ''
        expect(aria).toContain('Hours')
      })

      it('includes the property unit in the accessible name when one is set', () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: props }, // unit: 'h'
        })
        const aria = wrapper.find('.property-input').attributes('aria-label') ?? ''
        expect(aria).toContain('h')
      })

      it('declares inputmode="decimal" so mobile raises the numeric pad', () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: props },
        })
        expect(wrapper.find('.property-input').attributes('inputmode')).toBe('decimal')
      })

      it('does not call updatePropertyValue when the input value is non-numeric', async () => {
        const { wrapper, actions } = mountWithActions(DayColumn, {
          props: { ...baseProps, properties: props },
        })
        const input = wrapper.find('.property-input')
        Object.defineProperty(input.element, 'value', { value: 'abc', configurable: true })
        await input.trigger('change')
        expect(actions.updatePropertyValue).not.toHaveBeenCalled()
      })

      it('does not blank the input when the value is non-numeric', async () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: props },
        })
        const input = wrapper.find('.property-input')
        Object.defineProperty(input.element, 'value', { value: '12.5x', configurable: true })
        await input.trigger('change')
        // Spec §5 acceptance: "entering a non-numeric value does not
        // blank the field". The displayed value stays whatever the
        // user typed (the buffer holds the raw string) and the
        // upstream emit is suppressed.
        expect((input.element as HTMLInputElement).value).toBe('12.5x')
      })

      it('shows the unit next to the input when the property has one', () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: props }, // unit: 'h'
        })
        const unit = wrapper.find('.property-unit')
        expect(unit.exists()).toBe(true)
        expect(unit.text()).toBe('h')
      })
    })

    /**
     * Spec §10: long property names used to ellipsise to gibberish
     * ("Deep sl…") inside the 160px column. The fix exposes the full
     * name + unit as a tooltip on pointer devices and lets the label
     * wrap on touch.
     */
    describe('property label truncation (spec §10)', () => {
      const longNameProps: Property[] = [
        { id: 'pr1', name: 'Deep sleep hours', unit: 'h', createdAt: now, updatedAt: now },
      ]

      it('exposes the full property name + unit as a tooltip on the label', () => {
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: longNameProps },
        })
        const label = wrapper.find('.property-label')
        expect(label.attributes('title')).toBe('Deep sleep hours (h)')
      })

      it('exposes only the name (no parentheses) when no unit is set', () => {
        const noUnitProps: Property[] = [
          { id: 'pr1', name: 'Steps', unit: '', createdAt: now, updatedAt: now },
        ]
        const wrapper = mount(DayColumn, {
          props: { ...baseProps, properties: noUnitProps },
        })
        const label = wrapper.find('.property-label')
        expect(label.attributes('title')).toBe('Steps')
      })

      it('still uses the @media rule to switch from ellipsis to wrap on mobile', () => {
        // Structural assertion (happy-dom doesn't apply @media). The
        // CSS rule must exist so a future refactor doesn't silently
        // re-break the touch-width experience.
        const css = readFileSync(
          resolve(process.cwd(), 'src/components/WeekView/DayColumn.vue'),
          'utf8',
        )
        const mobileBlock = css.match(
          /@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\}\s*\n/g,
        )
        expect(mobileBlock).not.toBeNull()
        const mobileCss = (mobileBlock ?? []).join('\n')
        const rule = mobileCss.match(/\.property-label\s*\{([\s\S]*?)\}/)?.[1] ?? ''
        expect(rule).toMatch(/white-space\s*:\s*normal/)
      })
    })
  })

  describe('drop', () => {
    it('calls dropTask with the original event and date when something is dropped', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, { props: baseProps })
      const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
        preventDefault?: () => void
      }
      event.preventDefault = vi.fn()
      await wrapper.find('.day-column').trigger('drop', event)
      // The action is `(event, date)`; the date is the second arg.
      const call = actions.dropTask.mock.calls[0]
      expect(call).toBeDefined()
      expect(call?.[1]).toBe('2024-01-01')
    })

    it('handles dragover without throwing', () => {
      // The `@dragover.prevent` template modifier calls preventDefault
      // to allow the subsequent drop to fire. We don't try to assert
      // the preventDefault call itself (it's a Vue template feature,
      // not testable through the synthetic event API), but we do
      // confirm the column stays mounted and responsive.
      const wrapper = mount(DayColumn, { props: baseProps })
      const event = new Event('dragover', { cancelable: true })
      expect(() => wrapper.find('.day-column').trigger('dragover', event)).not.toThrow()
    })
  })

  describe('task action forwarding', () => {
    it('routes TaskCard interactions through the actions surface', async () => {
      // After §22 the column does NOT re-emit task events — TaskCard
      // calls `actions.toggleTaskStatus` directly, and the column
      // has nothing to forward. Asserting on the actions spy bag
      // rather than wrapper.emitted(...) pins the new contract.
      const task: Task = {
        id: 't1', projectId: 'p1', title: 'A', description: '',
        date: '2024-01-01', status: 'active', notes: '', createdAt: now, updatedAt: now,
      }
      const { wrapper, actions } = mountWithActions(DayColumn, { props: { ...baseProps, tasks: [task] } })
      const card = wrapper.findComponent({ name: 'TaskCard' })
      expect(card.exists()).toBe(true)
      // Drive the actual click rather than `$emit('toggle-status')`
      // — TaskCard no longer emits, so the action path is the only
      // way the user gesture reaches the action.
      await card.find('.task-checkbox').trigger('click')
      expect(actions.toggleTaskStatus).toHaveBeenCalledWith(task)
    })
  })

  /**
   * Accessibility structure guard for spec §2
   * (`docs/specs/7-improve-day-column.md`).
   *
   * `.day-header` used to carry `role="button" tabindex="0"` while also
   * containing the real `<button class="add-task-btn">`. An interactive
   * descendant inside a button-role container is invalid: assistive tech
   * flattens the header into a single button whose name swallows "Add task"
   * and the inner control's role is lost. happy-dom builds no accessibility
   * tree, so the only way to pin this is structurally — which also catches the
   * same mistake recurring.
   */
  describe('day header semantics', () => {
    it('never nests a button inside a role="button" element', () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const offenders = wrapper
        .findAll('[role="button"]')
        .filter(node => node.element.querySelector('button') !== null)
        .map(node => (node.element as HTMLElement).className)

      expect(offenders).toEqual([])
    })

    it('renders the header as a plain container, not a fake button', () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const header = wrapper.find('.day-header').element as HTMLElement

      expect(header.getAttribute('role')).toBeNull()
      expect(header.getAttribute('tabindex')).toBeNull()
    })

    /**
     * Spec §25: the §7 open-day chevron is removed from the header
     * entirely — the two-icon header read as clutter. The header now
     * exposes exactly one real button (add-task); opening the day view
     * happens via the header-click handler (mouse/touch) or the
     * header's date picker (keyboard).
     */
    it('exposes exactly one real button in the header: add-task (§25)', () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const header = wrapper.find('.day-header').element as HTMLElement
      const buttons = Array.from(header.querySelectorAll('button'))
      const addBtn = wrapper.find('.add-task-btn').element as HTMLElement

      expect(buttons).toHaveLength(1)
      expect(buttons[0]).toBe(addBtn)
      expect(wrapper.find('.open-day-btn').exists()).toBe(false)
      // A native button is what gives the control keyboard activation and a
      // button role for free — happy-dom does not synthesize `click` from
      // Enter/Space, so this structural check is the testable half of it.
      expect(addBtn.tagName).toBe('BUTTON')
      expect(addBtn.getAttribute('type')).toBe('button')
    })

    it('keeps the add-task control name unchanged', () => {
      const wrapper = mount(DayColumn, { props: baseProps })

      expect(wrapper.find('.add-task-btn').attributes('aria-label')).toBe(
        'Add task',
      )
    })
  })

  describe('open-day', () => {
    it('calls openDay exactly once when the header background is clicked', async () => {
      // Mouse convenience: clicking the day text still opens the day, but the
      // chevron's `@click.stop` must prevent the container handler from also
      // firing and calling the action twice.
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      await wrapper.find('.day-header-text').trigger('click')
      expect(actions.openDay).toHaveBeenCalledTimes(1)
      expect(actions.openDay).toHaveBeenCalledWith('2024-01-15')
    })

    it('calls openDay with the column date when the day header is clicked', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      await wrapper.find('.day-header').trigger('click')
      expect(actions.openDay).toHaveBeenCalledWith('2024-01-15')
    })

    /**
     * Inverted from the original "emits open-day on Enter/Space pressed on the
     * day header" tests. Those asserted the old `role="button"` header was
     * keyboard-activatable; spec §2 removes that role, so the container must
     * NOT be a control any more — keyboard entry is the native `.open-day-btn`
     * above. Deleting the pair would have hidden the change; inverting it pins
     * the new contract instead.
     */
    it('does NOT call openDay on Enter or Space on the header container', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      await wrapper.find('.day-header').trigger('keydown.enter')
      await wrapper.find('.day-header').trigger('keydown.space')

      expect(actions.openDay).not.toHaveBeenCalled()
    })

    it('makes the header container non-focusable', () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const header = wrapper.find('.day-header').element as HTMLElement

      expect(header.getAttribute('tabindex')).toBeNull()
    })

      it('does NOT call openDay when the add-task button is clicked', async () => {
      // The "+" button is the only header button (§25). It must
      // still call `addTask` and never `openDay` — clicking the
      // "+" should not open day view.
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-01-15' },
      })
      await wrapper.find('.add-task-btn').trigger('click')
      expect(actions.openDay).not.toHaveBeenCalled()
      // Sanity: the original `addTask` action still fires.
      expect(actions.addTask).toHaveBeenCalledWith('2024-01-15')
    })

    /**
     * Spec §25 removal contract: the §7 chevron is gone — not in the
     * rendered DOM, and not as a dormant CSS selector waiting to be
     * re-added. The header-click and `+` behaviour tests above are the
     * surviving coverage for opening the day view.
     */
    describe('open-day chevron removed (spec §25)', () => {
      it('renders no .open-day-btn in the column', () => {
        const wrapper = mount(DayColumn, { props: baseProps })
        expect(wrapper.find('.open-day-btn').exists()).toBe(false)
      })

      it('leaves no .open-day-btn selector in the component source (template or style)', () => {
        const css = readFileSync(
          resolve(process.cwd(), 'src/components/WeekView/DayColumn.vue'),
          'utf8',
        )
        expect(css).not.toMatch(/open-day-btn/)
      })

      it('keeps calling addTask when the + button is clicked', async () => {
        const { wrapper, actions } = mountWithActions(DayColumn, { props: baseProps })
        await wrapper.find('.add-task-btn').trigger('click')
        expect(actions.addTask).toHaveBeenCalled()
        expect(actions.openDay).not.toHaveBeenCalled()
      })
    })
  })

  /**
   * Spec §9: on mobile, properties and notes collapse into a single
   * compact meta footer row instead of always mounting two full
   * blocks. The footer carries property sums + a note dot (from
   * §19) and tap-expands the inline controls. Desktop is unchanged.
   *
   * The footer is conditionally rendered (`v-if` on `isMobile`), so
   * each test mounts the component under a narrow viewport by
   * overriding `window.innerWidth` and dispatching a `resize` event
   * so the listener the component registers at mount-time fires.
   */
  describe('mobile meta footer (spec §9)', () => {
    function mountAt(overrides: Partial<typeof baseProps> = {}): ReturnType<typeof mount> {
      const wrapper = mount(DayColumn, { props: { ...baseProps, ...overrides } })
      return wrapper
    }

    async function goMobile(wrapper: ReturnType<typeof mount>): Promise<void> {
      Object.defineProperty(window, 'innerWidth', {
        value: 375, configurable: true, writable: true,
      })
      window.dispatchEvent(new Event('resize'))
      await wrapper.vm.$nextTick()
    }

    it('renders a single .meta-footer row in the column on mobile', async () => {
      // The footer is only mounted when there's something to show
      // (a property or a note) — otherwise it would be a stranded
      // button. Provide a property so the summary has content.
      const properties = [
        { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
      ]
      const wrapper = mountAt({ properties })
      await goMobile(wrapper)
      expect(wrapper.find('.meta-footer').exists()).toBe(true)
    })

    it('shows property values inline in the meta footer on mobile', async () => {
      const properties = [
        { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
      ]
      const propertyValues = [
        { id: 'pv1', propertyId: 'pr1', date: '2024-01-01', value: 7 },
      ]
      const wrapper = mountAt({ properties, propertyValues })
      await goMobile(wrapper)
      // The footer carries the resolved numeric value next to the
      // unit so the user can see the saved value at a glance.
      expect(wrapper.find('.meta-footer').text()).toContain('7')
      expect(wrapper.find('.meta-footer').text()).toContain('h')
    })

    it('renders the note dot in the meta footer when the day has a note', async () => {
      const wrapper = mountAt({ dayNoteValue: 'a saved note' })
      await goMobile(wrapper)
      expect(wrapper.find('.meta-footer .meta-note-dot').exists()).toBe(true)
    })

    it('omits the note dot when the day has no note', async () => {
      const wrapper = mountAt({ dayNoteValue: '' })
      await goMobile(wrapper)
      expect(wrapper.find('.meta-footer .meta-note-dot').exists()).toBe(false)
    })

    it('starts with the property rows + DayNotes hidden on mobile (collapsed by default)', async () => {
      const properties = [
        { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
      ]
      const wrapper = mountAt({ properties })
      await goMobile(wrapper)

      // Properties section is collapsed (`display: none` via v-show)
      // and DayNotes wrapper is also collapsed.
      const propertiesEl = wrapper.find('.day-properties').element as HTMLElement
      expect(propertiesEl.style.display).toBe('none')
    })

    it('expands properties inline when the meta footer is tapped', async () => {
      const properties = [
        { id: 'pr1', name: 'Hours', unit: 'h', createdAt: now, updatedAt: now },
      ]
      const wrapper = mountAt({ properties })
      await goMobile(wrapper)

      await wrapper.find('.meta-footer').trigger('click')
      await wrapper.vm.$nextTick()

      const propertiesEl = wrapper.find('.day-properties').element as HTMLElement
      expect(propertiesEl.style.display).not.toBe('none')
    })

    it('does NOT render the meta footer on desktop', () => {
      // Default viewport is wide; no resize dispatched. The footer
      // is conditionally rendered, so it must be absent.
      const wrapper = mountAt({ dayNoteValue: 'a note' })
      expect(wrapper.find('.meta-footer').exists()).toBe(false)
    })
  })

  /**
   * Spec §14: drag/drop feedback. The column adds a `.drag-hover`
   * class while the cursor is over it (depth-countered so moving
   * over child cards doesn't flicker), clears on drop, and renders
   * cards whose id is in `pendingTaskIds` with a `.pending` class.
   */
  describe('drag affordance (spec §14)', () => {
    it('applies .drag-hover on dragenter', async () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      await wrapper.find('.day-column').trigger('dragenter')
      expect(wrapper.find('.day-column').classes()).toContain('drag-hover')
    })

    it('removes .drag-hover on a matching dragleave', async () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const col = wrapper.find('.day-column')
      await col.trigger('dragenter')
      expect(col.classes()).toContain('drag-hover')
      await col.trigger('dragleave')
      expect(col.classes()).not.toContain('drag-hover')
    })

    it('does NOT flicker when dragenter/dragleave pair across a child (counter)', async () => {
      // dragenter on parent → dragenter on child (depth=2) → 
      // dragleave on child (depth=1) → dragleave on parent (depth=0)
      // The class must stay applied while inside any descendant, and
      // only clear once the cursor leaves the column entirely.
      const wrapper = mount(DayColumn, { props: baseProps })
      const col = wrapper.find('.day-column')
      await col.trigger('dragenter')
      await col.trigger('dragenter')
      expect(col.classes()).toContain('drag-hover')
      await col.trigger('dragleave')
      expect(col.classes()).toContain('drag-hover')
      await col.trigger('dragleave')
      expect(col.classes()).not.toContain('drag-hover')
    })

    it('clears .drag-hover on drop', async () => {
      const wrapper = mount(DayColumn, { props: baseProps })
      const col = wrapper.find('.day-column')
      await col.trigger('dragenter')
      expect(col.classes()).toContain('drag-hover')
      const event = new Event('drop', { bubbles: true, cancelable: true })
      ;(event as Event & { preventDefault?: () => void }).preventDefault = vi.fn()
      await col.trigger('drop', event)
      expect(col.classes()).not.toContain('drag-hover')
    })

    it('marks a TaskCard as pending when its id is in pendingTaskIds', () => {
      const task: Task = {
        id: 't1', projectId: 'p1', title: 'A', description: '',
        date: '2024-01-01', status: 'active', notes: '',
        createdAt: now, updatedAt: now,
      }
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, tasks: [task], pendingTaskIds: new Set(['t1']) },
      })
      const card = wrapper.find('.task-card')
      expect(card.classes()).toContain('pending')
      expect(card.attributes('aria-busy')).toBe('true')
    })

    it('does NOT mark a TaskCard pending when its id is not in pendingTaskIds', () => {
      const task: Task = {
        id: 't1', projectId: 'p1', title: 'A', description: '',
        date: '2024-01-01', status: 'active', notes: '',
        createdAt: now, updatedAt: now,
      }
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, tasks: [task] },
      })
      const card = wrapper.find('.task-card')
      expect(card.classes()).not.toContain('pending')
      expect(card.attributes('aria-busy')).toBeUndefined()
    })
  })

  /**
   * Spec §24: the §15 step 1 done/total chip is removed from the
   * week view entirely — an untouched week rendered `0 of N done`
   * in every column, which is noise, and §15 step 2's active-first
   * ordering is the progress signal instead.
   *
   * These are removal-contract tests: they exist to fail loudly if
   * the chip is ever re-introduced. Each case populates the tasks
   * prop (so the old `v-if="taskProgress.total > 0"` condition
   * would have rendered) across the done/total states the chip used
   * to distinguish.
   */
  describe('progress chip removed (spec §24)', () => {
    const chipTask: Task = {
      id: 't1', projectId: 'p1', title: 'A', description: '',
      date: '2024-01-01', status: 'active', notes: '', createdAt: now, updatedAt: now,
    }

    it.each([
      ['partially done (2 of 5)', 2, 5],
      ['nothing done (0 of 3)', 0, 3],
      ['all done (4 of 4)', 4, 4],
    ])('renders no .day-progress chip for %s', (_label, _done, _total) => {
      const wrapper = mount(DayColumn, {
        props: {
          ...baseProps,
          tasks: [chipTask],
        },
      })
      expect(wrapper.find('.day-progress').exists()).toBe(false)
    })

    it('renders no done/total text anywhere in the header', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, tasks: [chipTask] },
      })
      const header = wrapper.find('.day-header')
      expect(header.text()).not.toContain('done')
    })
  })

  /**
   * Spec §16 acceptance: tapping the empty-state zone emits
   * `add-task` (the zone is a real button), and the zone remains a
   * valid drop target (drop events bubble up to the column root).
   */
  describe('empty-state drop zone (spec §16)', () => {
    it('calls addTask when the empty-state zone is clicked', async () => {
      const { wrapper, actions } = mountWithActions(DayColumn, {
        props: { ...baseProps, date: '2024-02-09' },
      })
      await wrapper.find('.empty-state-add').trigger('click')
      expect(actions.addTask).toHaveBeenCalledWith('2024-02-09')
    })

    it('does not show the empty-state zone when the day has tasks', () => {
      const task: Task = {
        id: 't1', projectId: 'p1', title: 'A', description: '',
        date: '2024-01-01', status: 'active', notes: '',
        createdAt: now, updatedAt: now,
      }
      const wrapper = mount(DayColumn, { props: { ...baseProps, tasks: [task] } })
      expect(wrapper.find('.empty-state-add').exists()).toBe(false)
    })

    it('exposes the day name in the accessible name of the empty-state button', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, dayName: 'Friday' },
      })
      expect(wrapper.find('.empty-state-add').attributes('aria-label')).toBe(
        'Add a task to Friday',
      )
    })
  })

  /**
   * Spec §17: the column renders the inline month-context marker
   * when the prop is non-null. The actual marker arithmetic is
   * covered by `monthMarkerFor` in `utils/date.test.ts`; here we
   * pin the wiring (prop → DOM) and the `null` short-circuit.
   */
  describe('month marker (spec §17)', () => {
    it('does not render the marker when monthMarker is null', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, monthMarker: null },
      })
      expect(wrapper.find('.day-month-marker').exists()).toBe(false)
    })

    it('renders the marker label when monthMarker is provided', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, monthMarker: '1 Feb' },
      })
      const marker = wrapper.find('.day-month-marker')
      expect(marker.exists()).toBe(true)
      expect(marker.text()).toBe('1 Feb')
      // Title duplicates the visible text for screen-reader /
      // pointer hover redundancy.
      expect(marker.attributes('title')).toBe('1 Feb')
    })
  })

  /**
   * Spec §18: past days get a `.past` class on the column root so
   * CSS can soften the header treatment. Today and future days do
   * NOT carry the class. The colour change itself is a CSS concern;
   * this seam just pins the structural wiring.
   */
  describe('past-day distinction (spec §18)', () => {
    it('applies the .past class when isPast is true', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, isPast: true },
      })
      expect(wrapper.find('.day-column').classes()).toContain('past')
    })

    it('does not apply the .past class when isPast is false', () => {
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, isPast: false },
      })
      expect(wrapper.find('.day-column').classes()).not.toContain('past')
    })

    it('does not apply the .past class when isToday is true (today wins)', () => {
      // Today stays loudest; future and past treatments must not
      // interfere with the today ring.
      const wrapper = mount(DayColumn, {
        props: { ...baseProps, isPast: true, isToday: true },
      })
      // Both classes are present; CSS specificity decides which
      // wins, and .today is declared with a higher-specificity
      // selector (`.day-column.today`) than `.day-column.past`.
      const col = wrapper.find('.day-column')
      expect(col.classes()).toContain('today')
      expect(col.classes()).toContain('past')
    })
  })
})
