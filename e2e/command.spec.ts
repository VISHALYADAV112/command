import { expect, test, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }))
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewport)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('logs the approved three daily practice floors', async ({ page }) => {
  await page.getByRole('button', { name: /log today/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Log today' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Job hunt')).toHaveCount(0)
  await expect(dialog.getByRole('spinbutton')).toHaveCount(3)
  await dialog.getByRole('button', { name: 'Save today' }).click()
  await expect(dialog).toBeHidden()
})

test('captures, schedules, finds, and completes a registry-driven record', async ({ page }) => {
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type').selectOption('10000000-0000-4000-8000-000000000002')
  await dialog.getByLabel('Title').fill('Mira Patel')
  await dialog.getByLabel(/Status/).selectOption('talking')
  await dialog.getByLabel('Schedule this record now').check()
  await dialog.getByLabel('Due on').fill('2026-09-02')
  await dialog.getByLabel('Commitment action').fill('Send Mira a follow-up')
  await dialog.getByRole('button', { name: 'Capture record' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: 'Due', exact: true }).click()
  await page.getByLabel('Type filter').selectOption('person')
  await expect(page.getByText('Send Mira a follow-up')).toBeVisible()
  const row = page.getByText('Send Mira a follow-up').locator('xpath=ancestor::article')
  await row.getByRole('button', { name: 'Outcome' }).click()
  const outcome = page.getByRole('dialog', { name: 'Record outcome' })
  await outcome.getByLabel('What happened?').fill('Sent a thoughtful follow-up.')
  await outcome.getByRole('button', { name: 'Save outcome' }).click()
  await expect(page.getByText('Send Mira a follow-up')).toHaveCount(0)
})

test('browses a canonical item and supports archive and restore', async ({ page }) => {
  await page.getByRole('button', { name: 'Browse', exact: true }).click()
  await page.getByLabel('Browse type').selectOption('project')
  await page.getByRole('button', { name: /RAG evaluation workbench/ }).click()
  await expect(page.getByRole('heading', { name: 'RAG evaluation workbench' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Provenance' })).toBeVisible()
  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Archived records are read-only until restored.')).toBeVisible()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(page.getByText('Archived records are read-only until restored.')).toHaveCount(0)
})

test('maps useful legacy hashes to registry routes', async ({ page }) => {
  await page.goto('/#/jobs')
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
  await page.goto('/#/learning')
  await expect(page.getByRole('heading', { name: 'Learning' })).toBeVisible()
})

test('publishes valid installable PWA metadata', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest).toMatchObject({ name: 'Command', start_url: './', scope: './', display: 'standalone' })
  expect(manifest.icons).toHaveLength(2)
})

test('keeps the Today priority, weekly outcomes, and primary action visible at 380px', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  await expect(page.locator('.urgent-lead, .floor-field').first()).toBeInViewport()
  await expect(page.getByRole('group', { name: 'Weekly outcome progress' })).toBeInViewport()
  await expect(page.getByRole('button', { name: /log today|review today/i })).toBeInViewport()
  await expectNoHorizontalOverflow(page)
})

test('keeps every Phase 5 route inside the approved narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  for (const route of ['/#/', '/#/due', '/#/t/application', '/#/i/00000000-0000-4000-8000-000000000301']) {
    await page.goto(route)
    await expectNoHorizontalOverflow(page)
  }
})

test('renders empty v3 migration state safely', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('command.prototype.v1', JSON.stringify({
      logs: [], applications: [], people: [], projects: [], ideas: [], learning: [],
    }))
  })
  await page.reload()
  await page.goto('/#/due')
  await expect(page.locator('.empty-state')).toBeVisible()
  await page.goto('/#/t/application')
  await expect(page.locator('.empty-state')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('retains long captured values without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  await page.getByRole('button', { name: 'Capture', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Type').selectOption('10000000-0000-4000-8000-000000000005')
  await dialog.getByLabel('Title').fill('x'.repeat(200))
  await dialog.getByLabel(/Tag/).selectOption('idea')
  await dialog.getByLabel(/Status/).selectOption('captured')
  await dialog.getByRole('button', { name: 'Capture record' }).click()
  await expectNoHorizontalOverflow(page)
})
