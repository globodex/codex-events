import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

// The fixtures make the event admin persona the event admin of the challenge choice fixture event.
const eventAdminPersona = 'event_admin'

/** The card of an open track or challenge on the Overview tab. */
function choiceCard(page: Page, title: string) {
  return page.getByTestId('overview-challenges').locator('article').filter({ hasText: title })
}

When('I show more of {string} on my event page', async ({ page }, title: string) => {
  await choiceCard(page, title).getByRole('button', { name: 'Show more' }).click()
})

Then('I should read {string} on my event page', async ({ page }, text: string) => {
  await expect(page.getByTestId('overview-challenges').getByText(text)).toBeVisible()
})

When('I choose {string} on my event page', async ({ page }, title: string) => {
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.url().endsWith('/actions/select-challenge') && candidate.request().method() === 'POST'),
    choiceCard(page, title).getByRole('button', { name: 'Choose', exact: true }).click()
  ])

  expect(response.ok(), await response.text()).toBe(true)
})

Then('{string} should be my choice after I reload the page', async ({ page }, title: string) => {
  await page.reload()
  await expect(choiceCard(page, title).getByText('Your choice', { exact: true })).toBeVisible()
})

// This step signs the browser in as the event admin, so it has to be the last step of a scenario.
Then('the event admin should see {int} choice(s) for {string} on the Participants tab of {string}', async ({ page }, count: number, title: string, eventSlug: string) => {
  await signInAs(eventAdminPersona, page)
  await page.goto(`/account/events/${eventSlug}?tab=participants`)

  const choice = page.getByTestId('participant-challenge-choices').getByRole('button', { name: new RegExp(title) })

  await expect(choice).toContainText(String(count))
})
