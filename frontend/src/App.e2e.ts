import { test, expect, openPlanner, openSidebar, closeSidebar } from './test/e2e'

test('creates a project and persists a task through editing and completion', async ({ page }) => {
  await openPlanner(page)
  await openSidebar(page)
  await page.getByRole('button', { name: 'Add Project', exact: true }).click()
  const projectDialog = page.getByRole('dialog', { name: 'Add Project' })
  await projectDialog.getByLabel('Name', { exact: true }).fill('Launch checklist')
  await projectDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(projectDialog).toBeHidden()
  await expect(page.getByRole('complementary').getByRole('button', { name: /^Launch checklist/ })).toBeVisible()
  await closeSidebar(page)

  // The current day stays in the visible week, regardless of the start-of-week setting.
  await page.locator('.day-column.today').getByRole('button', { name: 'Add task', exact: true }).click()
  const taskDialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
  await taskDialog.getByLabel('Task', { exact: true }).fill('Prepare release')
  await taskDialog.getByLabel('Description', { exact: true }).fill('Check the browser suite')
  await taskDialog.getByLabel('Project', { exact: true }).selectOption({ label: 'Launch checklist' })
  await taskDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(taskDialog).toBeHidden()

  const originalCard = page.locator('.task-card').filter({ has: page.getByText('Prepare release', { exact: true }) })
  await expect(originalCard).toBeVisible()
  await expect(originalCard.getByText('Launch checklist', { exact: true })).toBeVisible()
  await page.reload()
  await expect(originalCard).toBeVisible()
  await expect(originalCard.getByText('Check the browser suite', { exact: true })).toBeVisible()

  await originalCard.getByRole('button', { name: 'Task actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit Task', exact: true })
  await expect(editDialog.getByLabel('Task', { exact: true })).toHaveValue('Prepare release')
  await editDialog.getByLabel('Task', { exact: true }).fill('Release ready')
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(editDialog).toBeHidden()

  const updatedCard = page.locator('.task-card').filter({ has: page.getByText('Release ready', { exact: true }) })
  await expect(updatedCard).toBeVisible()
  const [saved] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/tasks/') && response.request().method() === 'PUT'),
    updatedCard.getByRole('checkbox').click(),
  ])
  expect(saved.ok()).toBe(true)
  await expect(updatedCard.getByRole('checkbox')).toBeChecked()
  await page.reload()
  await expect(updatedCard.getByRole('checkbox')).toBeChecked()
  await expect(updatedCard.getByText('Launch checklist', { exact: true })).toBeVisible()
  await expect(originalCard).toHaveCount(0)
})

test('switches language, direction, calendar defaults, and persists the choice', async ({ page }) => {
  await openPlanner(page)
  await openSidebar(page)
  const sidebar = page.getByRole('complementary')
  const language = sidebar.getByRole('combobox', { name: 'Language', exact: true })

  const persianSettings = page.waitForResponse(response =>
    response.url().includes('/api/settings') && response.request().method() === 'PUT',
  )
  await language.selectOption('fa')
  await persianSettings
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(sidebar.getByRole('heading', { name: 'پروژه‌ها' })).toBeVisible()
  await expect(sidebar.getByRole('combobox', { name: 'تقویم' })).toHaveValue('jalali')
  await expect.poll(() => page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-body'),
  )).toContain('Vazirmatn')
  const viewportWidth = page.viewportSize()?.width ?? 0
  const sidebarBounds = await sidebar.boundingBox()
  expect(sidebarBounds).not.toBeNull()
  if (!sidebarBounds) throw new Error('Open Persian sidebar has no bounding box')
  expect(sidebarBounds.x + sidebarBounds.width).toBeCloseTo(viewportWidth, 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1)

  await closeSidebar(page)
  await page.locator('.day-column.today .day-header-text').click()
  const daySummary = page.locator('.day-view-summary')
  await expect(daySummary).toContainText('در حال انجام')
  await expect(daySummary).toContainText('انجام‌شده')
  await expect(daySummary).toContainText('به‌تعویق‌افتاده')
  await expect(daySummary).toContainText('لغوشده')
  await page.getByRole('button', { name: 'بازگشت به هفته', exact: true }).click()

  const resetServerCalendar = await page.evaluate(async () => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekStart: 6, calendar: 'gregorian' }),
    })
    return response.status
  })
  expect(resetServerCalendar).toBe(200)
  const localeCalendarSync = page.waitForResponse(response =>
    response.url().includes('/api/settings') && response.request().method() === 'PUT',
  )
  await page.reload()
  await localeCalendarSync
  const persianSidebar = page.getByRole('complementary')
  if (await persianSidebar.evaluate(element => element.classList.contains('collapsed'))) {
    await page.getByRole('button', { name: 'باز و بسته کردن منو' }).click()
  }
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(persianSidebar.getByRole('combobox', { name: 'تقویم' })).toHaveValue('jalali')

  const manualCalendarSave = page.waitForResponse(response =>
    response.url().includes('/api/settings') && response.request().method() === 'PUT',
  )
  await persianSidebar.getByRole('combobox', { name: 'تقویم' }).selectOption('gregorian')
  await manualCalendarSave
  await page.reload()
  const reloadedPersianSidebar = page.getByRole('complementary')
  if (await reloadedPersianSidebar.evaluate(element => element.classList.contains('collapsed'))) {
    await page.getByRole('button', { name: 'باز و بسته کردن منو' }).click()
  }
  await expect(reloadedPersianSidebar.getByRole('combobox', { name: 'تقویم' })).toHaveValue('gregorian')

  await reloadedPersianSidebar.getByRole('combobox', { name: 'زبان' }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(persianSidebar.getByRole('combobox', { name: 'Calendar' })).toHaveValue('gregorian')
})

test('week chevrons reverse in Persian without reversing navigation', async ({ page }) => {
  await openPlanner(page)
  const englishNav = page.getByRole('navigation', { name: 'Week navigation' })
  await expect(englishNav.getByRole('button', { name: 'Previous week' }).locator('svg'))
    .toHaveCSS('transform', 'none')
  await expect(englishNav.getByRole('button', { name: 'Next week' }).locator('svg'))
    .toHaveCSS('transform', 'none')

  await openSidebar(page)
  await page.getByRole('complementary').getByRole('combobox', { name: 'Language' }).selectOption('fa')
  // In RTL the sidebar is on the right; the exposed backdrop is on the left.
  if ((page.viewportSize()?.width ?? 1440) <= 1024) {
    await page.locator('.sidebar-backdrop').click({ position: { x: 20, y: 100 } })
    await expect(page.getByRole('complementary')).toHaveClass(/collapsed/)
  }
  const persianNav = page.getByRole('navigation', { name: 'پیمایش هفته' })
  const previous = persianNav.getByRole('button', { name: 'هفتهٔ قبل' })
  const next = persianNav.getByRole('button', { name: 'هفتهٔ بعد' })
  await expect(previous.locator('svg')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)')
  await expect(next.locator('svg')).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)')

  const weekDisplay = persianNav.locator('.week-display')
  const originalWeek = await weekDisplay.innerText()
  await previous.click()
  await expect(weekDisplay).not.toHaveText(originalWeek)
  await next.click()
  await expect(weekDisplay).toHaveText(originalWeek)
})

test('navigation and dialogs remain usable at the configured viewport', async ({ page }) => {
  await openPlanner(page)
  await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeInViewport()
  await openSidebar(page)
  await expect(page.getByRole('complementary').getByRole('combobox', { name: 'Theme', exact: true })).toBeInViewport()
  await closeSidebar(page)

  const weekLabel = page.getByRole('navigation', { name: 'Week navigation' }).locator('.week-display')
  const currentWeek = await weekLabel.innerText()
  await page.getByRole('button', { name: 'Next week', exact: true }).click()
  await expect(weekLabel).not.toHaveText(currentWeek)
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(weekLabel).toHaveText(currentWeek)
  await expect(page.locator('.day-column.today')).toBeInViewport()

  // The day header is intentionally a pointer target, not an ARIA button.
  await page.locator('.day-column.today .day-header-text').click()
  await expect(page.getByRole('button', { name: 'Back to week', exact: true })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Next day', exact: true })).toBeInViewport()
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Task', { exact: true })).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) throw new Error('Visible task dialog has no bounding box')
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: 'Back to week', exact: true }).click()
  await expect(weekLabel).toHaveText(currentWeek)

  // Check Escape independently of day view's own Escape-to-week shortcut.
  await page.locator('.day-column.today').getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(weekLabel).toHaveText(currentWeek)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
