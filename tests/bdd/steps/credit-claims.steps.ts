import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { When, Then } = createBdd()

/** The credits card on the Overview tab of the participant's event page. */
function creditsCard(page: Page) {
  return page.getByTestId('participant-credits')
}

/** One credit offer in the credits card. */
function creditOffer(page: Page, offerName: string) {
  return creditsCard(page).locator('article').filter({
    has: page.getByRole('heading', { name: offerName })
  })
}

When('I claim the credit {string}', async ({ page }, offerName: string) => {
  await creditOffer(page, offerName).getByRole('button', { name: 'Claim credit' }).click()
})

Then('I should hold the code {string} of the credit {string}', async ({ page }, code: string, offerName: string) => {
  const offer = creditOffer(page, offerName)

  // The page hides a claimed code until the participant asks for it.
  await offer.getByRole('button', { name: 'Show code' }).click()
  await expect(offer.getByText(code, { exact: true })).toBeVisible()
})

Then('I should see the credit {string} on my event page', async ({ page }, offerName: string) => {
  await expect(creditOffer(page, offerName)).toBeVisible()
})

// Use this step after a step that waits for the next-step card. The card and the credits come
// with the same page data, so missing credits are then really missing.
Then('I should see no credits on my event page', async ({ page }) => {
  await expect(creditsCard(page)).toHaveCount(0)
})

Then('the credit {string} should have no credits left', async ({ page }, offerName: string) => {
  await expect(creditOffer(page, offerName).getByText('No credits left')).toBeVisible()
})

Then('the credit {string} should have no claim button', async ({ page }, offerName: string) => {
  const offer = creditOffer(page, offerName)

  // The offer is on the page, so a missing claim button is really missing.
  await expect(offer).toBeVisible()
  await expect(offer.getByRole('button', { name: 'Claim credit' })).toHaveCount(0)
})
