import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { openBuilderExtra } from '../support/event-builder.ts'
import { platformFixtureIds } from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

// The fixtures seed the private guest list directly. No scenario calls the real Luma API.
const guestListEventIds: Record<string, string> = {
  'luma-guest-list-fixture-event': platformFixtureIds.lumaGuestListEventId,
  'luma-guest-list-empty-fixture-event': platformFixtureIds.lumaGuestListEmptyEventId
}

const registrations = new WeakMap<Page, { response: APIResponse, json: unknown }>()

/** Opens the extra "Luma" of the event builder and returns the controls of its guest list. */
async function guestListControls(page: Page) {
  return (await openBuilderExtra(page, 'luma')).getByTestId('event-builder-luma-guest-list')
}

When('I open the Luma guest list event {string} in the builder', async ({ page }, slug: string) => {
  await signInAs('event_admin', page)
  await page.goto(`/admin/events/builder/${slug}`)
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
})

Then('I should see the Luma guest list with {int} approved and {int} waiting guests', async ({ page }, approved: number, waiting: number) => {
  const controls = await guestListControls(page)

  await expect(controls.getByLabel('Confirm registrations from the Luma guest list')).toBeChecked()
  await expect(controls.getByText(`${approved} approved · ${waiting} waiting`)).toBeVisible()
  await expect(controls.getByText('Last update')).toBeVisible()
  await expect(controls.getByRole('button', { name: 'Refresh guest list' })).toBeEnabled()
})

Then('I should not see any Luma guest email', async ({ page }) => {
  await expect(await openBuilderExtra(page, 'luma')).not.toContainText('@')
})

Then('I should be asked to import the Luma guest list', async ({ page }) => {
  const controls = await guestListControls(page)

  await expect(controls.getByText('0 approved · 0 waiting')).toBeVisible()
  await expect(controls.getByText('Import the guest list', { exact: true })).toBeVisible()
  await expect(controls.getByRole('button', { name: 'Import guest list' })).toBeEnabled()
})

// TASK-499: the upload fixture event has no Luma connection, so the CSV is the only way to fill the list.
When('I upload a Luma guest CSV with {int} approved, {int} waiting and {int} declined guests', async ({ page }, approved: number, waiting: number, declined: number) => {
  const controls = await guestListControls(page)
  const rows = [
    ...Array.from({ length: approved }, (_, index) => `gst-a${index},"Guest, Approved ${index}",approved-${index}@example.com,approved`),
    ...Array.from({ length: waiting }, (_, index) => `gst-w${index},Waiting ${index},waiting-${index}@example.com,pending_approval`),
    ...Array.from({ length: declined }, (_, index) => `gst-d${index},Declined ${index},declined-${index}@example.com,declined`)
  ]

  await controls.getByTestId('event-builder-luma-guest-list-file').setInputFiles({
    name: 'guests.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['guest_id,name,email,approval_status', ...rows].join('\n'))
  })
})

Then('the uploaded Luma guest list should show {int} approved and {int} waiting guests', async ({ page }, approved: number, waiting: number) => {
  const controls = await guestListControls(page)

  await expect(controls.getByText(`${approved} approved · ${waiting} waiting`)).toBeVisible()
  await expect(controls.getByText('Last update')).toBeVisible()
  // Without a Luma connection, only an upload updates the list.
  await expect(controls.getByRole('button', { name: 'Refresh guest list' })).toHaveCount(0)
  await expect(controls.getByRole('button', { name: 'Upload Luma CSV' })).toBeEnabled()
})

When('the saved {string} session registers for the Luma guest list event {string}', async ({ page }, personaKey: string, slug: string) => {
  const eventId = guestListEventIds[slug]

  if (!eventId) {
    throw new Error(`Unknown Luma guest list fixture slug: ${slug}`)
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${eventId}/applications`, { data: {} })
    registrations.set(page, { response, json: await response.json() })
  } finally {
    await apiClient.dispose()
  }
})

Then('the Luma guest list registration should be approved', async ({ page }) => {
  const registration = registrations.get(page)!
  const payload = registration.json as { data?: { status?: string, lumaSyncStatus?: string | null } }

  expect(registration.response.ok()).toBe(true)
  expect(payload.data?.status).toBe('approved')
  expect(payload.data?.lumaSyncStatus).toBeNull()
})

Then('the Luma guest list registration should be refused until the participant registers on Luma', async ({ page }) => {
  const registration = registrations.get(page)!
  const payload = registration.json as { error?: { code?: string, message?: string } }

  expect(registration.response.status()).toBe(409)
  expect(payload.error?.code).toBe('luma_registration_required')
  expect(payload.error?.message).toContain('Register for this event on Luma first')
})
