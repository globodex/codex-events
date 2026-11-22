import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

/** The builder settings group for the challenges of the event. */
function challengeSettings(page: Page) {
  return page.getByTestId('event-builder-settings-challenges')
}

/** One challenge on the Challenges tab of the participant's event page. */
function challengeOnEventPage(page: Page, title: string) {
  return page.getByTestId('account-event-challenges').locator('article').filter({
    has: page.getByRole('heading', { name: title })
  })
}

When('I add a challenge in the builder', async ({ page }) => {
  await challengeSettings(page).getByRole('button', { name: 'Add challenge' }).click()
})

// The builder checklist names what the organizer still has to finish before the event can be saved.
Then('the builder checklist should say {string}', async ({ page }, line: string) => {
  await expect(page.getByTestId('event-builder-checklist-challenges')).toHaveText(line)
  await expect(page.getByTestId('event-builder-submit')).toBeDisabled()
})

// The builder scenario writes one challenge, so every field below belongs to the first challenge.
When('I write the challenge {string} with the instructions {string}', async ({ page }, title: string, instructions: string) => {
  const settings = challengeSettings(page)

  await settings.getByLabel('Title', { exact: true }).fill(title)
  await settings.getByTestId('event-builder-challenge-instructions-0').getByRole('textbox').fill(instructions)
})

When('I add the challenge resource {string} with the link {string}', async ({ page }, name: string, link: string) => {
  const settings = challengeSettings(page)

  await settings.getByRole('button', { name: 'Add resource' }).click()
  await settings.getByLabel('Name of resource 1').fill(name)
  await settings.getByLabel('Link of resource 1').fill(link)
})

When('I publish the challenge', async ({ page }) => {
  await challengeSettings(page).getByLabel('Published').check()
})

Then('the builder should keep the published challenge {string} with the link {string} after a reload', async ({ page }, title: string, link: string) => {
  await page.reload()

  const settings = challengeSettings(page)

  await expect(settings.getByLabel('Title', { exact: true })).toHaveValue(title)
  await expect(settings.getByLabel('Published')).toBeChecked()
  await expect(settings.getByLabel('Link of resource 1')).toHaveValue(link)
})

Then('I should see the challenge {string} with the instructions {string}', async ({ page }, title: string, instructions: string) => {
  await expect(page).toHaveURL(/tab=challenges/)
  await expect(challengeOnEventPage(page, title).getByText(instructions)).toBeVisible()
})

Then('the challenge {string} should link to {string} at {string}', async ({ page }, title: string, name: string, link: string) => {
  const resource = challengeOnEventPage(page, title).getByRole('link', { name })

  await expect(resource).toHaveAttribute('href', link)
  // A resource opens in a new tab, so the participant keeps the event page.
  await expect(resource).toHaveAttribute('target', '_blank')
})

Then('I should not see the challenge {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
})

Then('I should have no account event tab {string}', async ({ page }, tabLabel: string) => {
  // The Details tab shows that the tab list has its data, so a missing tab is really missing.
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: tabLabel, exact: true })).toHaveCount(0)
})
