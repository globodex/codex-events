import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

// The fixtures make the judge persona event staff of the participant photos fixture event.
const eventStaffPersona = 'judge'

/** A PNG image of one pixel. */
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64'
)

/** The gallery section with the photos that participants added. */
function participantPhotoSection(page: Page) {
  return page.getByTestId('event-gallery-group-participants')
}

/** One photo in that section, found by its file name. */
function participantPhoto(page: Page, fileName: string) {
  return participantPhotoSection(page).locator('article').filter({ hasText: fileName })
}

/** The builder checkbox that lets participants add photos. */
function participantPhotosCheckbox(page: Page) {
  return page.getByTestId('event-builder-settings-after-check-in')
    .getByLabel('Participants can add photos to the gallery')
}

When('I add the photo {string} to the gallery', async ({ page }, fileName: string) => {
  await expect(page).toHaveURL(/tab=gallery/)

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    participantPhotoSection(page).getByRole('button', { name: 'Add photos' }).click()
  ])

  await fileChooser.setFiles({ name: fileName, mimeType: 'image/png', buffer: png })
})

Then('I should see the photo {string} under {string}', async ({ page }, fileName: string, sectionTitle: string) => {
  await expect(participantPhotoSection(page).getByRole('heading', { name: sectionTitle })).toBeVisible()
  await expect(participantPhoto(page, fileName).getByRole('img')).toBeVisible()
})

// This step signs the browser in as event staff.
When('event staff hide the photo {string} in the gallery of {string}', async ({ page }, fileName: string, eventSlug: string) => {
  await signInAs(eventStaffPersona, page)
  await page.goto(`/account/events/${eventSlug}?tab=gallery`)

  const photo = participantPhoto(page, fileName)

  // Event staff see who added a participant photo.
  await expect(photo.getByText('Added by')).toBeVisible()
  await photo.getByRole('button', { name: 'Hide' }).click()
  await expect(photo.getByText('Hidden', { exact: true })).toBeVisible()
})

// This step signs the browser in as the given persona.
Then('the gallery of {string} should not show the photo {string} to {string}', async ({ page }, eventSlug: string, fileName: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${eventSlug}?tab=gallery`)

  // The upload action shows that the gallery has its data, so a missing photo is really missing.
  await expect(participantPhotoSection(page).getByRole('button', { name: 'Add photos' })).toBeVisible()
  await expect(page.getByText(fileName)).toHaveCount(0)
})

When('I let participants add photos to the gallery', async ({ page }) => {
  await participantPhotosCheckbox(page).check()
})

Then('the builder should still let participants add photos after a reload', async ({ page }) => {
  await page.reload()
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )

  await expect(participantPhotosCheckbox(page)).toBeChecked()
})
