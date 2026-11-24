import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { openBuilderLevel } from '../support/event-builder.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { Given, When, Then } = createBdd()

// The fixtures make the event admin persona the event admin of both registration questions fixture events.
const eventAdminPersona = 'event_admin'

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() =>
    typeof window.useNuxtApp === 'function' && window.useNuxtApp().isHydrating === false
  )
}

/**
 * The question editor on the Registration level of the event builder. The builder keeps visited
 * levels on the page and hides them, so the visible editor is the one of the open level.
 */
async function registrationQuestionEditor(page: Page) {
  await openBuilderLevel(page, 'registration')

  return page.locator('[data-testid="custom-question-editor"]:visible')
}

/** The field of a question. Its label holds the question and, for a required one, the badge "Required". */
function requiredQuestion(page: Page, question: string) {
  return page.getByLabel(question)
}

Given('I open the registration form of {string} as {string}', async ({ page }, eventSlug: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/events/${eventSlug}/register`)
  await waitForNuxtHydration(page)
  await expect(page.getByRole('heading', { name: 'Your application' })).toBeVisible()
})

// The fixture event approves registrations automatically, so the button says "Register".
When('I fill in my name and send my registration', async ({ page }) => {
  await page.getByRole('textbox', { name: /First name/ }).fill('Regular')
  await page.getByRole('textbox', { name: /Family name/ }).fill('User')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
})

Then('I should be asked to answer the question {string}', async ({ page }, question: string) => {
  await expect(requiredQuestion(page, question)).toBeFocused()
  await expect(page.getByText('Answer this required question before submitting.')).toBeVisible()
})

When('I answer the question {string} with {string}', async ({ page }, question: string, answer: string) => {
  await requiredQuestion(page, question).fill(answer)
})

When('I send my registration', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse(candidate => candidate.url().endsWith('/applications') && candidate.request().method() === 'POST'),
    page.getByRole('button', { name: 'Register', exact: true }).click()
  ])

  expect(response.ok(), await response.text()).toBe(true)
})

// This step signs the browser in as the event admin, so it has to be the last step of a scenario.
Then('the event admin should read my answer {string} to {string} in the participant list of {string}', async ({ page }, answer: string, question: string, eventSlug: string) => {
  await signInAs(eventAdminPersona, page)
  await page.goto(`/account/events/${eventSlug}?tab=participants`)
  // Confirmed participants are behind the Approved filter of the admin list.
  await page.getByRole('button', { name: /^Approved/ }).click()

  // The fixture event has one registration: the one that the scenario sent.
  const answers = page.locator('[data-testid^="admin-application-registration-answers-"]')

  await expect(answers.getByText(question)).toBeVisible()
  await expect(answers.getByText(answer, { exact: true })).toBeVisible()
})

When('I add the registration question {string}', async ({ page }, question: string) => {
  const editor = await registrationQuestionEditor(page)

  await editor.getByRole('button', { name: 'Add question' }).click()
  await editor.getByLabel('Question', { exact: true }).fill(question)
})

Then('the builder should keep the registration question {string} after a reload', async ({ page }, question: string) => {
  await page.reload()
  await waitForNuxtHydration(page)

  const editor = await registrationQuestionEditor(page)

  await expect(editor.getByLabel('Question', { exact: true })).toHaveValue(question)
})
