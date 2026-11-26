import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { openBuilderExtra } from '../support/event-builder.ts'
import { platformFixtureIds } from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

// The fixtures make the event admin persona the event admin of every check-in flow fixture event.
const eventAdminPersona = 'event_admin'

/** The card at the top of the participant's event page that shows the next step. */
function nextStepCard(page: Page) {
  return page.getByTestId('account-event-next-step')
}

/** Opens the extra "Check-in" of the event builder and returns the frame around its editor. */
function checkInSettings(page: Page) {
  return openBuilderExtra(page, 'check-in')
}

function isEventPageDataUrl(url: string) {
  return new URL(url).pathname.endsWith('/entry')
}

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

async function expectActivity(page: Page, activity: string) {
  const card = nextStepCard(page)

  await expect(card.getByRole('heading', { name: 'You\'re checked in' })).toBeVisible()
  await expect(card.getByRole('link', { name: activity })).toBeVisible()
}

Given('I open my event page of {string} as {string}', async ({ page }, eventSlug: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${eventSlug}`)
  // A confirmed participant can withdraw, so this text shows that the page has its data.
  await expect(page.getByText('Withdraw from this event')).toBeVisible()
})

Then('I should see no next step', async ({ page }) => {
  await expect(nextStepCard(page)).toHaveCount(0)
})

// Before check-in the next step shows how to get there.
Then('my next step should be to check in with the event team', async ({ page }) => {
  await expect(nextStepCard(page).getByRole('heading', { name: 'How to get there' })).toBeVisible()
  await expect(nextStepCard(page).getByRole('link', { name: 'Show the way' })).toBeVisible()
})

// "Show the way" opens the Agenda tab with the first session or agenda item that has a room selected.
// The link names it `first`, and the address then names the selected one by its id.
When('I open the agenda from my next step', async ({ page }) => {
  await nextStepCard(page).getByRole('link', { name: 'Show the way' }).click()
  await expect(page).toHaveURL(/tab=program&session=/)
})

Then('I should see the agenda session {string}', async ({ page }, sessionTitle: string) => {
  const session = page.getByTestId('program-timeline').getByText(sessionTitle).first()

  await expect(page).toHaveURL(/tab=program/)
  await expect(session).toBeVisible()
})

// The staff check-in of the regular user in the check-in flow fixture event, as its event admin.
When('the event team checks me in', async () => {
  const api = await createAuthenticatedApiClient(eventAdminPersona)

  try {
    const response = await api.post(
      `/api/events/${platformFixtureIds.checkInFlowEventId}/applications/${platformFixtureIds.checkInFlowApplicationId}/actions/check-in`
    )

    expect(response.ok()).toBe(true)
  } finally {
    await api.dispose()
  }
})

Then('my next step should list the activity {string}', async ({ page }, activity: string) => {
  await expectActivity(page, activity)
})

// Until the check-in, the page reads its data again 6 to 8 seconds after each read.
Then('my next step should list the activity {string} without a reload', async ({ page }, activity: string) => {
  await expect(nextStepCard(page).getByRole('heading', { name: 'You\'re checked in' })).toBeVisible({ timeout: 15_000 })
  await expectActivity(page, activity)
})

// After the check-in the page no longer reads its data by itself. A read would come within 8 seconds.
Then('my event page should stop checking my check-in', async ({ page }) => {
  const reads: string[] = []
  page.on('request', (request) => {
    if (isEventPageDataUrl(request.url())) reads.push(request.url())
  })
  await page.waitForTimeout(9_000)
  expect(reads).toEqual([])
})

Then('my next step should still list the activity {string} after I reload the page', async ({ page }, activity: string) => {
  await page.reload()
  await expectActivity(page, activity)
})

When('I open the activity {string} from my next step', async ({ page }, activity: string) => {
  await nextStepCard(page).getByRole('link', { name: activity }).click()
})

Given('I open the event {string} in the builder as its event admin', async ({ page }, eventSlug: string) => {
  await signInAs(eventAdminPersona, page)
  await page.goto(`/admin/events/builder/${eventSlug}`)
  await waitForNuxtHydration(page)
  await expect(page.getByTestId('event-builder-level-extras')).toBeVisible()
})

When('I turn on the next step for participants', async ({ page }) => {
  await (await checkInSettings(page)).getByLabel('Show participants their next step on their event page').check()
})

When('I save the event in the builder', async ({ page }) => {
  await page.getByTestId('event-builder-submit').click()
  // The toast appears after the event was saved and the builder has read it again.
  await expect(page.getByText('Event saved')).toBeVisible()
})

Then('the builder should keep the next step on after a reload', async ({ page }) => {
  await page.reload()
  await waitForNuxtHydration(page)

  const settings = await checkInSettings(page)

  await expect(settings.getByLabel('Show participants their next step on their event page')).toBeChecked()
})
