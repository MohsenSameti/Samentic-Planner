/**
 * Test helper for components that consume `useDayActions()` (spec §22).
 *
 * Replaces the old `wrapper.emitted(...)` contract with
 * "the injected action was called with these arguments". Each call
 * to `mountWithActions` returns a fresh spy bag mirroring
 * `DayActions` so a test can assert on the specific method that
 * matters to it.
 *
 * Usage:
 *
 *     const { wrapper, actions } = mountWithActions(DayColumn, {
 *       props: { date: '2024-01-01', ...baseProps },
 *     })
 *     await wrapper.find('.add-task-btn').trigger('click')
 *     expect(actions.addTask).toHaveBeenCalledWith('2024-01-01')
 */
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { vi } from 'vitest'
import { provideDayActions, type DayActions } from './useDayActions'

/** Spy bag mirroring `DayActions`. Each method is a `vi.fn()`. */
export type DayActionsSpies = {
  [K in keyof DayActions]: ReturnType<typeof vi.fn>
}

function makeSpyBag(): DayActionsSpies {
  return {
    addTask: vi.fn(),
    openDay: vi.fn(),
    updateDayNote: vi.fn(),
    updatePropertyValue: vi.fn(),
    dropTask: vi.fn(),
    editTask: vi.fn(),
    moveTask: vi.fn(),
    toggleTaskStatus: vi.fn(),
    cancelTask: vi.fn(),
    restoreTask: vi.fn(),
    deleteTask: vi.fn(),
    updateTaskNotes: vi.fn(),
  }
}

/**
 * Mount `component` with a fresh spy bag on every action method.
 *
 * `options.props` is forwarded to the inner `mount(component, { props })`
 * call. Other mount options (attachTo, slots, attrs) pass through.
 */
export function mountWithActions(
  component: Parameters<typeof mount>[0],
  options: Parameters<typeof mount>[1] = {},
): { wrapper: VueWrapper; actions: DayActionsSpies } {
  const actions = makeSpyBag()
  const props = options.props ?? {}

  const Harness = defineComponent({
    name: 'DayActionsHarness',
    setup() {
      provideDayActions(actions as unknown as DayActions)
      return () => h(component as never, props as never)
    },
  })

  const wrapper = mount(Harness, options)
  return { wrapper, actions }
}
