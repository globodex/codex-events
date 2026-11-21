import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

type PrizeWorkspaceRequestState = {
  bootstrapCount: number
  pageReadCount: number
  legacyTermsReadCount: number
}

const prizeWorkspaceRequestCounts = new WeakMap<Page, PrizeWorkspaceRequestState>()

When('I open the prize redemptions page with the saved {string} session', async ({ page }, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)

  const state = {
    bootstrapCount: 0,
    pageReadCount: 0,
    legacyTermsReadCount: 0
  }
  prizeWorkspaceRequestCounts.set(page, state)
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname

    if (pathname === '/api/session') {
      state.bootstrapCount += 1
    }

    if (pathname === '/api/prize-redemptions/workspace') {
      state.pageReadCount += 1
    }

    if (/^\/api\/events\/[^/]+\/terms\/current$/u.test(pathname)) {
      state.legacyTermsReadCount += 1
    }
  })

  await page.goto('/prize-redemptions')
})

Then('I should see the prize redemption task for event slug {string} and prize {string}', async ({ page }, eventSlug: string, prizeId: string) => {
  await expect(page.getByTestId(`prize-redemption-card-${eventSlug}-${prizeId}`)).toBeVisible()
})

Then('the prize redemption workspace should request one bootstrap and one page read without terms fan-out', async ({ page }) => {
  const state = prizeWorkspaceRequestCounts.get(page)

  if (!state) {
    throw new Error('The prize redemption request counter was not initialized.')
  }

  await expect.poll(() => state.bootstrapCount).toBe(1)
  await expect.poll(() => state.pageReadCount).toBe(1)
  expect(state.legacyTermsReadCount).toBe(0)
})

When('I submit the prize redemption task for event slug {string} and prize {string} as {string}', async ({ page }, eventSlug: string, prizeId: string, legalName: string) => {
  const scope = page.getByTestId(`prize-redemption-card-${eventSlug}-${prizeId}`)
  const responsePath = '/actions/redeem'

  await expect(scope).toBeVisible()
  await scope.getByPlaceholder('Enter the legal recipient name').fill(legalName)
  await scope.getByRole('checkbox').check()

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(responsePath)
      && response.ok()
    ),
    scope.getByTestId(`prize-redemption-submit-${eventSlug}-${prizeId}`).click()
  ])
})

Then('I should see the completed prize redemption for event slug {string} and prize {string}', async ({ page }, eventSlug: string, prizeId: string) => {
  await expect(page.getByTestId(`prize-redemption-complete-${eventSlug}-${prizeId}`)).toBeVisible()
})
