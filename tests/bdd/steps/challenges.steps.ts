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

/** The page of a challenge beside the agenda. The Details button of its card opens it. */
function challengePage(page: Page) {
  return page.getByTestId('deck-page')
}

When('I add a challenge in the builder', async ({ page }) => {
  await (await challengeSettings(page)).getByRole('button', { name: 'Add challenge' }).click()
})

// Saving with an open step sends nothing: the note next to the save button names what the
// organizer still has to finish, and the builder stays on the step.
Then('the builder should name the open step {string}', async ({ page }, line: string) => {
  const title = (await challengeSettings(page)).getByLabel('Title', { exact: true })
  const saves: string[] = []
  const trackSave = (request: Request) => {
    if (request.method() === 'PATCH') {
      saves.push(request.url())
    }
  }

  page.on('request', trackSave)
  await page.getByTestId('event-builder-submit').click()
  await expect(page.getByTestId('event-builder-missing-steps')).toContainText(line)
  // The cursor lands in the field that the step names.
  await expect(title).toBeFocused()
  page.off('request', trackSave)
  expect(saves).toEqual([])
})

// The builder scenario writes one challenge, so every field below belongs to the first challenge.
When('I name the challenge {string}', async ({ page }, title: string) => {
  await (await challengeSettings(page)).getByLabel('Title', { exact: true }).fill(title)
})

When('I publish the challenge', async ({ page }) => {
  await (await challengeSettings(page)).getByLabel('Published').check()
})

// The slides and links of a published challenge are written on its page, which the builder links to.
Then('the builder should keep the published challenge {string} with a link to its page after a reload', async ({ page }, title: string) => {
  await page.reload()

  const settings = await challengeSettings(page)

  // The tile of the extra shows how many challenges the event has.
  await settings.getByTestId('event-builder-extras-back').click()
  await expect(page.getByTestId('event-builder-extra-challenges')).toContainText('1')
  await page.getByTestId('event-builder-extra-challenges').click()
  await expect(settings.getByLabel('Title', { exact: true })).toHaveValue(title)
  await expect(settings.getByLabel('Published')).toBeChecked()
  await expect(settings.getByRole('link', { name: 'Edit slides and links' }))
    .toHaveAttribute('href', /\?tab=program&challenge=/u)
})

Then('I should see the challenge {string} with the slide {string}', async ({ page }, title: string, slide: string) => {
  await expect(page).toHaveURL(/tab=program/)
  const challenge = challengesOnEventPage(page).getByRole('listitem').filter({ hasText: title })

  // The card shows the title. Its Details button opens the challenge page with the slides.
  await challenge.getByRole('link', { name: 'Details' }).click()
  await expect(challengePage(page).getByRole('heading', { name: title })).toBeVisible()
  await expect(challengePage(page).getByText(slide)).toBeVisible()
})

// The challenge page is open from the step before. This step closes it.
Then('the challenge page should link to {string} at {string}', async ({ page }, name: string, link: string) => {
  const resource = challengePage(page).getByRole('link', { name })

  await expect(resource).toHaveAttribute('href', link)
  // A link opens in a new tab, so the participant keeps the event page.
  await expect(resource).toHaveAttribute('target', '_blank')
  await challengePage(page).getByRole('button', { name: 'Close page' }).click()
  await expect(challengesOnEventPage(page)).toBeVisible()
})

Then('I should not see the challenge {string}', async ({ page }, title: string) => {
  await expect(challengesOnEventPage(page).getByRole('listitem')).not.toHaveCount(0)
  await expect(challengesOnEventPage(page).getByText(title)).toHaveCount(0)
})
