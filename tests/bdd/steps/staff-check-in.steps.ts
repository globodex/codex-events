import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

// The fixtures make the judge persona event staff of the staff check-in fixture event.
const eventStaffPersona = 'judge'

// Longer than the delay after which the participant search can ask the server.
const searchSettleMs = 800

/** What a scenario notes about its page in one step and checks in a later step. */
interface ParticipantListNotes {
  /** Participant list requests that started after the list was opened. */
  listReadsSinceOpened: number
  checkedInCountBeforeCheckIn?: number
}

const notesByPage = new WeakMap<Page, ParticipantListNotes>()

function notesOf(page: Page) {
  const notes = notesByPage.get(page)

  if (!notes) {
    throw new Error('Open the participant list first.')
  }

  return notes
}

function isParticipantListUrl(url: string) {
  return new URL(url).pathname.endsWith('/participants')
}

/** Resolves when the participant list of the open event has loaded. */
function participantListLoaded(page: Page) {
  return page.waitForResponse(response => isParticipantListUrl(response.url()) && response.ok())
}

function participantRow(page: Page, participantName: string) {
  return page.locator('article[data-testid^="admin-application-"]').filter({ hasText: participantName })
}

/** Reads the first number of the Checked in card, which shows "checked in / confirmed". */
async function readCheckedInCount(page: Page) {
  const card = page.getByText('Of approved participants', { exact: true }).locator('..')
  const [, checkedInCount] = (await card.innerText()).match(/(\d+) \/ \d+/) ?? []

  return Number(checkedInCount)
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

  const notes: ParticipantListNotes = { listReadsSinceOpened: 0 }
  notesByPage.set(page, notes)
  page.on('request', (request) => {
    if (isParticipantListUrl(request.url())) {
      notes.listReadsSinceOpened += 1
    }
  })
})

// The staff list opens on confirmed participants, so the step chooses no filter first.
When('I search the confirmed participants for {string}', async ({ page }, participantName: string) => {
  await page.getByPlaceholder('Search participants').fill(participantName)
  await expect(participantRow(page, participantName)).toHaveCount(1)
})

// Every registration of the fixture event fits in the first load, so the search stays in the browser.
Then('the search should not load the participant list again', async ({ page }) => {
  await page.waitForTimeout(searchSettleMs)
  expect(notesOf(page).listReadsSinceOpened).toBe(0)
})

When('I check in the participant {string}', async ({ page }, participantName: string) => {
  notesOf(page).checkedInCountBeforeCheckIn = await readCheckedInCount(page)

  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/actions/check-in') && response.ok()),
    // The list is read again after a check-in, for its counts.
    participantListLoaded(page),
    participantRow(page, participantName).getByRole('button', { name: 'Check in' }).click()
  ])
})

Then('the participant {string} should be shown as checked in', async ({ page }, participantName: string) => {
  await expectCheckedIn(page, participantName)
})

Then('the checked-in count should be one higher than before the check-in', async ({ page }) => {
  const countBeforeCheckIn = notesOf(page).checkedInCountBeforeCheckIn

  expect(countBeforeCheckIn).toEqual(expect.any(Number))
  await expect.poll(() => readCheckedInCount(page)).toBe(Number(countBeforeCheckIn) + 1)
})

Then('the participant {string} should still be checked in after I reload the list', async ({ page }, participantName: string) => {
  await Promise.all([participantListLoaded(page), page.reload()])
  await expectCheckedIn(page, participantName)
})

// A new registration is behind the New filter.
Then('the pending participant {string} should have no check-in action', async ({ page }, participantName: string) => {
  await page.getByRole('button', { name: /^New/ }).click()
  const row = participantRow(page, participantName)

  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: 'Check in' })).toHaveCount(0)
})
