import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { test as base, expect, type Page } from '@playwright/test'

const backendDirectory = fileURLToPath(new URL('../../../backend/', import.meta.url))
export const password = 'Browser-test-password-42'

async function availablePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a browser-test port'))
        return
      }
      server.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

/** Real application entry point, fresh database and session store for EVERY test. */
export const test = base.extend({
  baseURL: async ({}, use, testInfo) => {
    const port = await availablePort()
    const child = spawn(process.execPath, ['dist/index.js'], {
      cwd: backendDirectory,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DATABASE_URL: ':memory:',
        PORT: String(port),
        SESSION_SECRET: 'isolated-browser-test-session-secret',
        SESSION_MAX_AGE: '3600000',
        TZ: 'UTC',
      },
      stdio: 'pipe',
    })
    let output = ''
    const collect = (chunk: Buffer): void => {
      output = (output + chunk.toString()).slice(-20_000)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()))

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => finish(new Error(`App startup timed out\n${output}`)), 15_000)
        const onError = (error: Error): void => finish(error)
        const onExit = (code: number | null): void => {
          finish(new Error(`App exited during startup (${code})\n${output}`))
        }
        const onOutput = (): void => {
          // Wait for OUR child to listen, not an arbitrary existing HTTP server.
          if (output.includes(`Server running on http://localhost:${port}`)) finish()
        }
        function finish(error?: Error): void {
          clearTimeout(timer)
          child.off('error', onError)
          child.off('exit', onExit)
          child.stdout.off('data', onOutput)
          if (error) reject(error)
          else resolve()
        }
        child.once('error', onError)
        child.once('exit', onExit)
        child.stdout.on('data', onOutput)
      })
      await use(`http://127.0.0.1:${port}`)
    } finally {
      // Graceful shutdown first, with a bounded fallback even after test failure.
      const forceKill = setTimeout(() => child.kill('SIGKILL'), 5_000)
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
      await closed
      clearTimeout(forceKill)
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('backend.log', { body: output, contentType: 'text/plain' })
      }
    }
  },
})

export { expect }

/** Seed auth via the real API; setup itself has separate UI coverage. */
export async function openPlanner(page: Page): Promise<void> {
  // Freeze Date only: keep timers/network real while avoiding midnight/week rollover.
  await page.clock.setFixedTime(new Date('2026-05-13T12:00:00Z'))
  const response = await page.request.post('/api/auth/setup', { data: { password } })
  expect(response.status()).toBe(201)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Planner', exact: true })).toBeVisible()
}

export async function openSidebar(page: Page): Promise<void> {
  const sidebar = page.getByRole('complementary')
  if (await sidebar.evaluate(element => element.classList.contains('collapsed'))) {
    await page.getByRole('button', { name: 'Toggle menu' }).click()
  }
  await expect(sidebar.getByRole('button', { name: 'Add Project', exact: true })).toBeInViewport()
}

export async function closeSidebar(page: Page): Promise<void> {
  // On narrow screens the backdrop covers the header's menu toggle.
  if ((page.viewportSize()?.width ?? 1440) <= 1024) {
    await page.locator('.sidebar-backdrop').click({ position: { x: 300, y: 100 } })
    await expect(page.getByRole('complementary')).toHaveClass(/collapsed/)
  }
}
