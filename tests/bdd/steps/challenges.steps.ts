import type { Page, Request } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { openBuilderExtra } from '../support/event-builder.ts'

const { When, Then } = createBdd()

/** Opens the extra "Challenges" of the event builder and returns the frame around its editor. */
function challengeSettings(page: Page) {
  return openBuilderExtra(page, 'challenges')
}

/** The challenges on the Agenda tab of the participant's event page. */
function challengesOnEventPage(page: Page) {
  return page.getByTestId('program-challenges')
}

/** The popup with the instructions and links of one challenge. Its Details button opens it. */
function challengeDetails(page: Page, title: string) {
  return page.getByRole('dialog', { name: title })
}

When('I add a challenge in the builder', async ({ page }) => {
  await (await challengeSettings(page)).getByRole('button', { name: 'Add challenge' }).click()
})

// The level names what the organizer still has to finish. Saving with such an open step sends
// nothing: the builder stays on the step.
Then('the builder should name the open step {string}', async ({ page }, line: string) => {
  const step = page.getByTestId('event-builder-step-challenges')
  const title = (await challengeSettings(page)).getByLabel('Title', { exact: true })
  const saves: string[] = []
  const trackSave = (request: Request) => {
    if (request.method() === 'PATCH') {
      saves.push(request.url())
    }
  }

  await expect(step).toHaveText(line)
  page.on('request', trackSave)
  await page.getByTestId('event-builder-submit').click()
  // The cursor lands in the field that the step names.
  await expect(title).toBeFocused()
  page.off('request', trackSave)
  expect(saves).toEqual([])
})

// The builder scenario writes one challenge, so every field below belongs to the first challenge.
When('I write the challenge {string} with the instructions {string}', async ({ page }, title: string, instructions: string) => {
  const settings = await challengeSettings(page)

  await settings.getByLabel('Title', { exact: true }).fill(title)
  await settings.getByTestId('event-builder-challenge-instructions-0').getByRole('textbox').fill(instructions)
})

When('I add the challenge resource {string} with the link {string}', async ({ page }, name: string, link: string) => {
  const settings = await challengeSettings(page)

  await settings.getByRole('button', { name: 'Add resource' }).click()
  await settings.getByLabel('Name of resource 1').fill(name)
  await settings.getByLabel('Link of resource 1').fill(link)
})

When('I publish the challenge', async ({ page }) => {
  await (await challengeSettings(page)).getByLabel('Published').check()
})

Then('the builder should keep the published challenge {string} with the link {string} after a reload', async ({ page }, title: string, link: string) => {
  await page.reload()

  const settings = await challengeSettings(page)

  // The tile of the extra shows how many challenges the event has.
  await settings.getByTestId('event-builder-extras-back').click()
  await expect(page.getByTestId('event-builder-extra-challenges')).toContainText('1')
  await page.getByTestId('event-builder-extra-challenges').click()
  await expect(settings.getByLabel('Title', { exact: true })).toHaveValue(title)
  await expect(settings.getByLabel('Published')).toBeChecked()
  await expect(settings.getByLabel('Link of resource 1')).toHaveValue(link)
})

Then('I should see the challenge {string} with the instructions {string}', async ({ page }, title: string, instructions: string) => {
  await expect(page).toHaveURL(/tab=program/)
  const challenge = challengesOnEventPage(page).getByRole('listitem').filter({ hasText: title })

  // The card shows the title. The instructions are in the details of the challenge.
  await challenge.getByRole('button', { name: 'Details' }).click()
  await expect(challengeDetails(page, title).getByText(instructions)).toBeVisible()
})

// The details of the challenge are open from the step before. This step closes them.
Then('the challenge {string} should link to {string} at {string}', async ({ page }, title: string, name: string, link: string) => {
  const resource = challengeDetails(page, title).getByRole('link', { name })

  await expect(resource).toHaveAttribute('href', link)
  // A resource opens in a new tab, so the participant keeps the event page.
  await expect(resource).toHaveAttribute('target', '_blank')
  await challengeDetails(page, title).getByRole('button', { name: 'Close' }).click()
})

Then('I should not see the challenge {string}', async ({ page }, title: string) => {
  await expect(challengesOnEventPage(page).getByRole('listitem')).not.toHaveCount(0)
  await expect(challengesOnEventPage(page).getByText(title)).toHaveCount(0)
})
