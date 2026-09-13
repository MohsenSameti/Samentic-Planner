/**
 * `useDayActions` — typed action surface for day- and task-level
 * operations used by the week view's column + card components.
 *
 * Spec §22: previously, `DayColumn` declared 12 emits, `WeekView`
 * re-declared and re-wired all 12 one-by-one, and `App.vue` bound
 * them again — ~40 lines of pure boilerplate, with the same wiring
 * duplicated in `DayView`. Adding one action meant editing three
 * (four) files in lockstep, which is how stale wiring bugs like
 * §1's `v-memo` survived review.
 *
 * This composable is the single typed seam. `App.vue` builds an
 * object from its existing handlers (no business logic moves) and
 * `provide()`s it under `DAY_ACTIONS_KEY`; every component that
 * previously emitted calls `inject(DAY_ACTIONS_KEY)` and invokes
 * the matching method. Props that carry *data* (tasks, projects,
 * properties, calendar) stay as props — only the *action* channel
 * changes.
 *
 * The actions are typed as the function signatures `App.vue`
 * already uses, so the wiring is type-checked end-to-end. No
 * implementation runs in this file: the goal is to consolidate
 * the *shape* of the actions, not to add new behaviour.
 */
import { inject, provide, type App, type InjectionKey } from 'vue'
import type { Task } from '../types'

/**
 * The action surface every component under `DayView` / `WeekView`
 * consumes. Keys mirror the previous emit names so the seam is a
 * drop-in replacement (the only differences are caller-side: an
 * emit becomes a method call).
 */
export interface DayActions {
  addTask: (date: string) => void
  openDay: (date: string) => void
  /**
   * Save the textarea value of a day's note. The day is identified
   * by ISO date; `DayNotes` always knows its own date, so the call
   * shape mirrors the previous `(date, note) => emit(...)`.
   */
  updateDayNote: (date: string, note: string) => void
  /**
   * Save a numeric property value (e.g. hours slept, water intake).
   * `propertyId` is the row's property definition; `value` is the
   * already-parsed finite number — invalid input never reaches
   * here (see spec §5).
   */
  updatePropertyValue: (date: string, propertyId: string, value: number) => void
  /**
   * Drop handler. Receives the original `DragEvent` (so the parent
   * can read the transfer payload) and the target date. Returns a
   * promise so future callers can `await` the save completion;
   * currently the implementation is async (it awaits
   * `updateTask`).
   */
  dropTask: (event: DragEvent, date: string) => Promise<void> | void
  /** Open the edit modal seeded with the given task. */
  editTask: (task: Task) => void
  /** Open the move-to-day modal seeded with the given task. */
  moveTask: (task: Task) => void
  /** Toggle between `active` and `completed`. */
  toggleTaskStatus: (task: Task) => void
  /** Mark a task as cancelled. */
  cancelTask: (task: Task) => void
  /** Restore a cancelled task back to active. */
  restoreTask: (task: Task) => void
  /** Permanently delete a task (after confirmation). */
  deleteTask: (task: Task) => void
  /** Save the in-card notes textarea value. */
  updateTaskNotes: (task: Task, notes: string) => void
}

/**
 * Vue's `InjectionKey` so consumers get a typed `inject()` without
 * having to repeat the interface name. `null` is the default; an
 * absent provider is treated as "no action available" rather than
 * throwing, which keeps tests that mount a child component in
 * isolation from needing the full provider.
 */
export const DAY_ACTIONS_KEY: InjectionKey<DayActions> = Symbol('day-actions')

/**
 * Provide the actions. Used once at the `App.vue` root so every
 * descendant (DayView / WeekView / DayColumn / DayNotes / TaskCard)
 * can `inject` them. The generic `<App>` lets call sites pass the
 * typed Vue app (e.g. `provide<DayActions>(...)`); without it the
 * return type widens to `DayActions | undefined`.
 */
export function provideDayActions(actions: DayActions, app?: App): DayActions {
  // Vue's `provide()` is called inside `setup()` and binds to the
  // current component instance. The optional `app` parameter lets
  // tests call this from a bare module scope when they don't have
  // a current instance — at the cost of skipping the actual
  // injection (the return value is what those tests consume).
  if (app) {
    app.provide(DAY_ACTIONS_KEY, actions)
  }
  // Always also call the global provide so `setup()`-bound consumers
  // (the production path) get it.
  try {
    provide(DAY_ACTIONS_KEY, actions)
  } catch {
    // `provide()` outside `setup()` throws. Tests that call this
    // helper without a current instance catch the throw and use
    // the return value directly.
  }
  return actions
}

/**
 * Inject the actions. Returns `null` when no provider is in scope
 * (e.g. a component mounted in isolation for a unit test). Every
 * consumer guards on `null` before calling so the tests don't have
 * to wire the full provider for every assertion.
 */
export function useDayActions(): DayActions | null {
  return inject(DAY_ACTIONS_KEY, null)
}
