import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { holdBrowserGet } from '../support/hold-browser-get.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()
const legalSettingsReads = new WeakMap<Page, Awaited<ReturnType<typeof holdBrowserGet>>>()

When('I follow the {string} link while the legal document service is unavailable', async ({ page }, link: string) => {
  await page.route('/api/platform-documents/current', route => route.fulfill({
    status: 503,
    json: { error: { code: 'unavailable', message: 'Documents temporarily unavailable.' } }
  }))
  await page.goto('/')
  await page.waitForFunction(() => typeof window.useNuxtApp === 'function' && !window.useNuxtApp().isHydrating)
  await page.getByRole('link', { name: link, exact: true }).click()
})

Then('I see {string} without a claim that the document is unpublished', async ({ page }, error: string) => {
  await expect(page.getByText(error, { exact: true })).toBeVisible()
  await expect(page.getByText(/operator has not published/i)).toHaveCount(0)
})

When('I open platform legal settings while the saved settings are loading', async ({ page }) => {
  await signInAs('platform_admin', page)
  const read = await holdBrowserGet(page, '/api/platform-legal-settings/current')
  legalSettingsReads.set(page, read)
  await page.goto('/account/platform-settings?tab=legal', { waitUntil: 'domcontentloaded' })
  await read.first
})

Then('I can edit the support email only after its saved value appears', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Platform settings', exact: true })).toBeVisible()
  const email = page.locator('input[type="email"]')
  await expect(email).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save legal settings' })).toBeHidden()
  const read = legalSettingsReads.get(page)!
  const route = await read.first
  const supportEmail = 'operator@example.test'
  await route.fulfill({ json: { data: {
    id: 'configured-settings',
    supportEmail,
    imprintContent: 'Example imprint.',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  } } })
  await expect(email).toHaveValue(supportEmail)
  await expect(email).toBeEditable()
  expect(read.count()).toBe(1)
})
