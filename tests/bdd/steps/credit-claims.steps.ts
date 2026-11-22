import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

/** The card of one credit offer on the Credits tab of the participant's event page. */
function creditOffer(page: Page, offerName: string) {
  return page.locator('#account-tab-panel-credits article').filter({
    has: page.getByRole('heading', { name: offerName })
  })
}

/** The note on the Credits tab for a participant who has to finish the check-in first. */
function finishCheckInNote(page: Page) {
  return page.getByTestId('participant-credits-finish-check-in')
}

When('I claim the credit {string}', async ({ page }, offerName: string) => {
  const offer = creditOffer(page, offerName)

  await offer.getByRole('button', { name: 'Expand' }).click()
  await offer.getByRole('button', { name: 'Redeem credit' }).click()
})

Then('I should hold the code {string} of the credit {string}', async ({ page }, code: string, offerName: string) => {
  const offer = creditOffer(page, offerName)

  // The page hides a claimed code until the participant asks for it.
  await offer.getByRole('button', { name: 'Show assigned code' }).click()
  await expect(offer.getByText(code, { exact: true })).toBeVisible()
})

Then('I should be told to finish my check-in before I claim credits', async ({ page }) => {
  await expect(finishCheckInNote(page).getByText('Finish your check-in to claim credits')).toBeVisible()
})

Then('I should not be told to finish my check-in', async ({ page }) => {
  // The heading shows that the Credits tab has its content, so a missing note is really missing.
  await expect(page.getByRole('heading', { name: 'Claim credits' })).toBeVisible()
  await expect(finishCheckInNote(page)).toHaveCount(0)
})

When('I follow the link to my next step', async ({ page }) => {
  await finishCheckInNote(page).getByRole('link', { name: 'See your next step' }).click()
})

Then('the credit {string} should have no credits left', async ({ page }, offerName: string) => {
  const offer = creditOffer(page, offerName)

  // An open offer card shows this text twice, so the first one is enough.
  await expect(offer.getByText('No credits left').first()).toBeVisible()
})

Then('the credit {string} should have no claim button', async ({ page }, offerName: string) => {
  const offer = creditOffer(page, offerName)

  // The claim button only exists in an open offer card, so open the card before looking for it.
  await offer.getByRole('button', { name: 'Expand' }).click()
  await expect(offer.getByRole('button', { name: 'Collapse' })).toBeVisible()
  await expect(offer.getByRole('button', { name: 'Redeem credit' })).toHaveCount(0)
})
