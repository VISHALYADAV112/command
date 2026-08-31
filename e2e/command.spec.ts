import { expect, test, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }))
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewport)
}

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

test('keeps the shell usable at the approved 380px width', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  await expect(page.locator('.view-nav')).toBeVisible()
  const primary = page.getByRole('button', { name: /(log|continue) today/i })
  const floors = page.locator('.floor-field')
  const progress = page.getByRole('group', { name: 'Weekly job-hunt progress' })
  await expect(primary).toBeVisible()
  await expect(floors).toBeInViewport()
  await expect(progress).toBeInViewport()
  await expect(primary).toBeInViewport()
  await expectNoHorizontalOverflow(page)
})

test('uses the full Gazette navigation rail on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const nav = page.locator('.view-nav')
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav).toHaveCSS('position', 'static')
})

test('supports common phone, tablet, and desktop shell widths', async ({ page }) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expectNoHorizontalOverflow(page)
    await expect(page.locator('.view-nav')).toHaveCSS('position', width <= 760 ? 'fixed' : 'static')
  }
})

test('keeps every legacy route inside the approved narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  for (const route of ['', 'jobs', 'people', 'projects', 'ideas', 'learning']) {
    await page.goto(route ? `/#/${route}` : '/#/')
    await expectNoHorizontalOverflow(page)
  }
})

test('renders empty sections safely across every type route', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('command.prototype.v1', JSON.stringify({
    logs: [], applications: [], people: [], projects: [], ideas: [], learning: [],
  })))
  await page.goto('/')
  await page.setViewportSize({ width: 380, height: 844 })
  for (const route of ['jobs', 'people', 'projects', 'ideas', 'learning']) {
    await page.goto(`/#/${route}`)
    await expect(page.locator('.empty-state')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('handles long captured values without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 844 })
  await page.getByRole('group', { name: 'Quick capture' }).getByRole('button', { name: 'Concept' }).click()
  const dialog = page.getByRole('dialog', { name: '+ Concept' })
  await dialog.getByLabel('Concept', { exact: true }).fill('x'.repeat(200))
  await dialog.getByLabel('The note').fill('Long values remain inside the sheet and do not create a second scroll axis. '.repeat(30))
  await dialog.getByRole('button', { name: 'Capture' }).click()
  await expectNoHorizontalOverflow(page)
})
