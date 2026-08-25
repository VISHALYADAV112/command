import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/')
})

test('logs today and preserves the single daily entry path', async ({ page }) => {
  await page.getByRole('button', { name: /(log|continue) today/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Log today' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Add 15 minutes to Math' }).click()
  await dialog.getByRole('button', { name: 'Save today' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Today saved')
})

test('captures a learning concept into the library', async ({ page }) => {
  await page.getByRole('group', { name: 'Quick capture' }).getByRole('button', { name: 'Concept' }).click()
  const dialog = page.getByRole('dialog', { name: '+ Concept' })
  await dialog.getByRole('textbox', { name: 'Concept', exact: true }).fill('Monotonic stack invariant')
  await dialog.getByLabel('The note').fill('Keep candidates ordered; pop values that can no longer answer a future query.')
  await dialog.getByRole('button', { name: 'Capture' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Monotonic stack invariant')).toBeVisible()
})

test('shows the complete jobs pipeline and can add an application', async ({ page }) => {
  await page.getByRole('button', { name: 'Jobs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
  await page.getByRole('button', { name: 'Add application' }).click()
  const dialog = page.getByRole('dialog', { name: 'New application' })
  await dialog.getByLabel('Company').fill('Example Labs')
  await dialog.getByLabel('Role').fill('Backend Engineer')
  await dialog.getByLabel('Next action').fill('Tailor resume')
  await dialog.getByRole('button', { name: 'Add application' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Example Labs')).toBeVisible()
})

test('publishes valid installable PWA metadata', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'Command',
    start_url: './',
    scope: './',
    display: 'standalone',
  })
  expect(manifest.icons).toHaveLength(2)
})
