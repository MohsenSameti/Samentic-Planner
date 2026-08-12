/**
 * Tests for the `debounce` helper.
 *
 * These tests use `vi.useFakeTimers()` so we can advance time
 * deterministically without waiting on real ms. The contract:
 *
 *   - Multiple calls within `wait` ms share a single invocation of
 *     the wrapped function, with the *last* set of arguments.
 *   - The wrapped function fires `wait` ms after the *last* call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from './debounce.js'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes the function once after the wait window', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 100)
    debounced('a')
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('a')
  })

  it('coalesces rapid calls into a single invocation with the last args', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 100)
    debounced('a')
    vi.advanceTimersByTime(50)
    debounced('b')
    vi.advanceTimersByTime(50)
    debounced('c')
    vi.advanceTimersByTime(99)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('c')
  })

  it('does not fire when the wait window has not elapsed', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 100)
    debounced()
    vi.advanceTimersByTime(99)
    expect(spy).not.toHaveBeenCalled()
  })

  it('fires again on a fresh round of calls', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 100)
    debounced('first')
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith('first')

    debounced('second')
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('second')
  })

  it('preserves multiple positional arguments', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 50)
    debounced('a', 1, true)
    vi.advanceTimersByTime(50)
    expect(spy).toHaveBeenCalledWith('a', 1, true)
  })

  it('does not invoke synchronously', () => {
    const spy = vi.fn()
    const debounced = debounce(spy, 100)
    debounced()
    expect(spy).not.toHaveBeenCalled()
  })
})
