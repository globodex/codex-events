import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
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

/** The builder settings group for what happens after check-in. */
function afterCheckInSettings(page: Page) {
  return page.getByTestId('event-builder-settings-after-check-in')
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

Then('my next step should be to check in at the entrance', async ({ page }) => {
  await expect(nextStepCard(page).getByRole('heading', { name: 'Check in at the entrance' })).toBeVisible()
})

When('I open the agenda from my next step', async ({ page }) => {
  await nextStepCard(page).getByRole('link', { name: 'View the agenda' }).click()
})

Then('I should see the agenda session {string}', async ({ page }, sessionTitle: string) => {
  const session = page.getByTestId('program-timeline').getByText(sessionTitle).first()

  await expect(page).toHaveURL(/tab=program/)
  await expect(session).toBeVisible()
})

// The page does not notice a check-in by itself. The button reads the page data again.
When('I confirm my check-in', async ({ page }) => {
  await Promise.all([
    page.waitForResponse(response => isEventPageDataUrl(response.url()) && response.ok()),
    nextStepCard(page).getByRole('button', { name: 'I\'ve checked in' }).click()
  ])
})

Then('I should be told that my check-in is not recorded yet', async ({ page }) => {
  await expect(nextStepCard(page).getByText('Your check-in is not recorded yet.')).toBeVisible()
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

Then('my next step should be to answer the event questions', async ({ page }) => {
  await expect(nextStepCard(page).getByRole('heading', { name: 'A few questions before you start' })).toBeVisible()
})

When('I send the event questions', async ({ page }) => {
  await nextStepCard(page).getByRole('button', { name: 'Send answers' }).click()
})

Then('I should be asked to answer the required question', async ({ page }) => {
  await expect(nextStepCard(page).getByText('Answer this required question before submitting.')).toHaveCount(1)
})

When('I answer the event question {string} with {string}', async ({ page }, question: string, answer: string) => {
  await nextStepCard(page).getByLabel(question).fill(answer)
})

Then('my next step should list the activity {string}', async ({ page }, activity: string) => {
  await expectActivity(page, activity)
})

Then('my next step should still list the activity {string} after I reload the page', async ({ page }, activity: string) => {
  await page.reload()
  await expectActivity(page, activity)
})

// This step signs the browser in as the event admin, so it has to be the last step of a scenario.
Then('the event admin should read my answer {string} in the participant list', async ({ page }, answer: string) => {
  await signInAs(eventAdminPersona, page)
  await page.goto('/account/events/check-in-flow-fixture-event?tab=participants')
  // Confirmed participants are behind the Approved filter of the admin list.
  await page.getByRole('button', { name: /^Approved/ }).click()

  const answers = page.getByTestId(`admin-application-questionnaire-${platformFixtureIds.checkInFlowApplicationId}`)

  await expect(answers.getByText('What do you want to build today?')).toBeVisible()
  await expect(answers.getByText(answer, { exact: true })).toBeVisible()
})

Given('I open the event {string} in the builder as its event admin', async ({ page }, eventSlug: string) => {
  await signInAs(eventAdminPersona, page)
  await page.goto(`/admin/events/builder/${eventSlug}`)
  await waitForNuxtHydration(page)
  await expect(afterCheckInSettings(page)).toBeVisible()
})

When('I turn on the next step for participants', async ({ page }) => {
  await afterCheckInSettings(page).getByLabel('Show participants their next step on their event page').check()
})

When('I add the question {string} for after check-in', async ({ page }, question: string) => {
  const settings = afterCheckInSettings(page)

  await settings.getByRole('button', { name: 'Add question' }).click()
  await settings.getByLabel('Question', { exact: true }).fill(question)
})

When('I save the event in the builder', async ({ page }) => {
  await page.getByTestId('event-builder-submit').click()
  // The toast appears after the event was saved and the builder has read it again.
  await expect(page.getByText('Event updated')).toBeVisible()
})

Then('the builder should keep the question {string} after a reload', async ({ page }, question: string) => {
  await page.reload()
  await waitForNuxtHydration(page)

  const settings = afterCheckInSettings(page)

  await expect(settings.getByLabel('Show participants their next step on their event page')).toBeChecked()
  await expect(settings.getByLabel('Question', { exact: true })).toHaveValue(question)
})
