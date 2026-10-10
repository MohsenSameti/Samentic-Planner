import { defineConfig } from '@playwright/test'

function browserArgs(): string[] | undefined {
  const raw = process.env.E2E_BROWSER_ARGS
  if (!raw) return undefined
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((arg: unknown) => typeof arg === 'string')) {
    throw new Error('E2E_BROWSER_ARGS must be a JSON array of strings')
  }
  return parsed as string[]
}

export default defineConfig({
  testDir: './frontend/src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: true,
  // Keep the default lightweight; callers can opt into more workers via the CLI.
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: './test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.E2E_BROWSER_EXECUTABLE_PATH || undefined,
      args: browserArgs(),
    },
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
})
