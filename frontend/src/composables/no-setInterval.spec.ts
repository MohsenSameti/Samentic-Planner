/**
 * Source-wide guard: `setInterval(` may only appear in
 * `composables/useTodayISO.ts`.
 *
 * The "today" highlight in the week view (`docs/specs/7-improve-day-column.md`
 * §3) needs a reactive clock, and the only thing allowed to schedule a
 * timer is that one composable. Every other call site would either
 * duplicate the interval (two competing clocks), miss the
 * `visibilitychange` listener, or leak timers on unmount. So if a
 * future contributor adds `setInterval` anywhere else in `frontend/src`,
 * this test fails and the review catches the mistake before it ships.
 *
 * Implementation: walk `frontend/src` (excluding build / coverage
 * output and the composable itself) and grep for the literal token.
 * We do the file walk at module-load time so the assertion itself is
 * a single `it` block — cheaper than spinning one test per file.
 *
 * IMPORTANT: created after `useTodayISO.ts` already exists, so the
 * "only match is the composable" assertion is meaningful. If this
 * file is ever moved earlier in the boot order, the test will fail
 * permanently on first run — documented inline so the next maintainer
 * doesn't shift it accidentally.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The single allowed source location for `setInterval(`. Every other
 * call site is a regression.
 */
const ALLOWED_SOURCE = 'src/composables/useTodayISO.ts'

describe('source-wide: setInterval is only allowed in useTodayISO.ts', () => {
  // Exclude this very file from the scan — its source string contains
  // the literal `setInterval(` twice (in the doc comment and the
  // assertion below), which is intentional and not a regression.
  const targetFiles: ReadonlyArray<string> = globSync('src/**/*.{ts,vue}', {
    cwd: process.cwd(),
  })
    .filter(f => f !== 'src/composables/no-setInterval.spec.ts')
    .sort()

  it('finds at least one source file under frontend/src', () => {
    // Sanity check: if the glob ever returns empty, fail loudly
    // rather than silently passing because there's nothing to scan.
    expect(targetFiles.length).toBeGreaterThan(0)
  })

  it.each(
    targetFiles.map(f => [
      f,
      f === ALLOWED_SOURCE
        ? 'allowed'
        : (readFileSync(resolve(process.cwd(), f), 'utf8').match(/setInterval\(/g) ?? []).length,
    ] as const),
  )('%s has no setInterval()', (file, hits) => {
    if (file === ALLOWED_SOURCE) {
      // The composable itself must keep its interval — that's the
      // whole point. Pin that it exists; a future refactor that
      // deletes it would fail the spec §3 acceptance criterion.
      expect(hits).toBe('allowed')
      const body = readFileSync(resolve(process.cwd(), file), 'utf8')
      expect(body).toMatch(/setInterval\(/)
    } else {
      expect(hits).toBe(0)
    }
  })
})
