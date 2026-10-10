import { test, expect, password } from '../test/e2e'

test('first-run setup validates the password and opens a persistent session', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Create your password' })).toBeVisible()
  const submit = page.getByRole('button', { name: 'Create password', exact: true })
  await expect(submit).toBeDisabled()

  await page.getByLabel('Password', { exact: true }).fill('short')
  await expect(page.getByText('Password must be at least 8 characters.')).toBeVisible()
  await expect(submit).toBeDisabled()

  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill('not-the-same-password')
  await expect(page.getByText('Passwords do not match.')).toBeVisible()
  await expect(submit).toBeDisabled()

  await page.getByLabel('Confirm password').fill(password)
  await expect(submit).toBeEnabled()
  await submit.click()
  await expect(page.getByRole('heading', { name: 'Planner', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Planner', exact: true })).toBeVisible()

  // First-run setup must no longer be accessible after initialization.
  const repeatedSetup = await page.request.post('/api/auth/setup', { data: { password } })
  expect(repeatedSetup.status()).toBe(409)
})
