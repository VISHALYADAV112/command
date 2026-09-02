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

test('supports common phone, tablet, and desktop Gazette widths', async ({ page }) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await expectNoHorizontalOverflow(page)
    await expect(page.locator('.view-nav')).toHaveCSS('position', width <= 760 ? 'fixed' : 'static')
  }
})

test('uses the full Gazette navigation rail on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const nav = page.locator('.view-nav')
  await expect(nav.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav).toHaveCSS('position', 'static')
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
  await dialog.getByLabel(/Problem/).fill('Long values remain inside the Gazette sheet without creating a second scroll axis. '.repeat(30))
  await dialog.getByRole('button', { name: 'Capture record' }).click()
  await expectNoHorizontalOverflow(page)
})

test('keeps a large dynamic type registry usable at 380px', async ({ page }) => {
  await page.waitForFunction(() => localStorage.getItem('command.prototype.v3') !== null)
  await page.evaluate(() => {
    const raw = localStorage.getItem('command.prototype.v3')
    if (!raw) throw new Error('Demo cache was not created')
    const envelope = JSON.parse(raw)
    const template = envelope.data.entityTypes[4]
    envelope.data.entityTypes.push(...Array.from({ length: 20 }, (_, index) => ({
      ...template,
      id: crypto.randomUUID(),
      typeKey: `custom_${index}`,
      singularName: `Custom record ${index}`,
      pluralName: `Custom records ${index}`,
    })))
    localStorage.setItem('command.prototype.v3', JSON.stringify(envelope))
  })
  await page.setViewportSize({ width: 380, height: 844 })
  await page.reload()
  await page.goto('/#/t/application')
  await expect(page.getByLabel('Browse type').locator('option')).toHaveCount(25)
  await expectNoHorizontalOverflow(page)
})

test('keeps the Agent inbox review gate usable at 380px', async ({ page }) => {
  await page.waitForFunction(() => localStorage.getItem('command.prototype.v3') !== null)
  await page.evaluate(() => {
    const raw = localStorage.getItem('command.prototype.v3')
    if (!raw) throw new Error('Demo cache was not created')
    const envelope = JSON.parse(raw)
    const note = envelope.data.entityTypes.find((type: { typeKey: string }) => type.typeKey === 'note')
    envelope.data.agentProposals = [{
      id: crypto.randomUUID(), clientId: 'visual-client', operation: 'capture', entityTypeId: note.id,
      targetEntityId: null, targetCommitmentId: null, targetUpdatedAt: null,
      proposedEntity: { id: crypto.randomUUID(), title: 'Review this agent note', fields: { tag: 'idea', status: 'captured' }, schema_version: 2 },
      proposedCommitment: null, state: 'pending', decisionNote: null,
      resultEntityId: null, resultCommitmentId: null, resultEventId: null,
      idempotencyKey: 'visual-proposal-001', expiresAt: '2099-09-09T00:00:00.000Z',
      decidedAt: null, createdAt: '2026-09-02T05:00:00.000Z',
    }]
    localStorage.setItem('command.prototype.v3', JSON.stringify(envelope))
  })
  await page.setViewportSize({ width: 380, height: 844 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Agent inbox · 1' })).toBeInViewport()
  await expect(page.getByRole('group', { name: 'Weekly outcome progress' })).toBeInViewport()
  await expect(page.getByRole('button', { name: /log today|review today/i })).toBeInViewport()
  await page.getByRole('button', { name: 'Agent inbox · 1' }).click()
  await expect(page.getByRole('dialog', { name: 'Agent inbox' })).toBeVisible()
  await expect(page.getByText('Review this agent note')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
