import { test, expect, password } from '../test/e2e'

test('sign-in rejects a wrong password, persists a valid session, and logs out', async ({ page, request }) => {
  // The standalone request fixture does not share the browser's cookies.
  const setup = await request.post('/api/auth/setup', { data: { password } })
  expect(setup.status()).toBe(201)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Open planner' })).toBeVisible()
  expect((await page.request.get('/api/tasks')).status()).toBe(401)

  await page.getByLabel('Password', { exact: true }).fill('incorrect-password')
  await page.getByRole('button', { name: 'Open planner', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid password')
  await expect(page.getByRole('heading', { name: 'Open planner' })).toBeVisible()

  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Open planner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Planner', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Planner', exact: true })).toBeVisible()
  expect((await page.request.get('/api/tasks')).status()).toBe(200)

  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Open planner' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Open planner' })).toBeVisible()
  expect((await page.request.get('/api/tasks')).status()).toBe(401)
})
