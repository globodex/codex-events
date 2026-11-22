import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

// The fixtures make the judge persona event staff of the staff check-in fixture event.
const eventStaffPersona = 'judge'

/** Resolves when the participant list of the open event has loaded. */
function participantListLoaded(page: Page) {
  return page.waitForResponse(response =>
    new URL(response.url()).pathname.endsWith('/participants') && response.ok()
  )
}

/** The list opens on new registrations. Confirmed participants are behind the Approved filter. */
async function showConfirmedParticipants(page: Page) {
  await page.getByRole('button', { name: /^Approved/ }).click()
}

function participantRow(page: Page, participantName: string) {
  return page.locator('article[data-testid^="admin-application-"]').filter({ hasText: participantName })
}

async function expectCheckedIn(page: Page, participantName: string) {
  const row = participantRow(page, participantName)

  await expect(row.getByText('Checked in', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Check in' })).toHaveCount(0)
}

Given('I open the participant list of event {string} as event staff', async ({ page }, eventSlug: string) => {
  await signInAs(eventStaffPersona, page)
  await Promise.all([
    participantListLoaded(page),
    page.goto(`/account/events/${eventSlug}?tab=participants`)
  ])
})

When('I search the confirmed participants for {string}', async ({ page }, participantName: string) => {
  await showConfirmedParticipants(page)
  await page.getByPlaceholder('Search participants').fill(participantName)
  await expect(participantRow(page, participantName)).toHaveCount(1)
})

When('I check in the participant {string}', async ({ page }, participantName: string) => {
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/actions/check-in') && response.ok()),
    participantRow(page, participantName).getByRole('button', { name: 'Check in' }).click()
  ])
})

Then('the participant {string} should be shown as checked in', async ({ page }, participantName: string) => {
  await expectCheckedIn(page, participantName)
})

Then('the participant {string} should still be checked in after I reload the list', async ({ page }, participantName: string) => {
  await Promise.all([participantListLoaded(page), page.reload()])
  await showConfirmedParticipants(page)
  await expectCheckedIn(page, participantName)
})

Then('the pending participant {string} should have no check-in action', async ({ page }, participantName: string) => {
  const row = participantRow(page, participantName)

  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: 'Check in' })).toHaveCount(0)
})
