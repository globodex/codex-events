import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

function getCurrentEventId(page: Page) {
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  return segments[segments.indexOf('events') + 1] ?? ''
}

When('I open the admin competition page for event {string} with the saved {string} session', async ({ page }, eventId: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/admin/events/${eventId}/competition`)
})

Then('I should see the admin competition text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('I should see the admin competition state {string}', async ({ page }, state: string) => {
  await expect(page.getByTestId('admin-competition-event-state')).toHaveText(state)
})

Then('I should see the competition assignment {string} assigned to judge {string}', async ({ page }, submissionId: string, judgeUserId: string) => {
  const assignment = page.getByTestId(`admin-competition-assignment-${submissionId}`)

  await expect(assignment).toBeVisible()
  await expect(page.getByTestId(`admin-competition-assignment-judge-${submissionId}`)).toHaveText(judgeUserId)
})

When('I reassign the competition assignment {string} to judge {string} with note {string}', async ({ page }, submissionId: string, judgeUserId: string, note: string) => {
  const eventId = getCurrentEventId(page)
  const scope = page.getByTestId(`admin-competition-assignment-${submissionId}`)

  await expect(scope).toBeVisible()
  await scope.getByTestId(`admin-competition-reassign-select-${submissionId}`).selectOption(judgeUserId)
  await scope.getByPlaceholder('Reassignment note').fill(note)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${eventId}/judging/assignments/`)
      && response.url().includes('/actions/reassign')
      && response.ok()
    ),
    scope.getByTestId(`admin-competition-reassign-submit-${submissionId}`).click()
  ])
})

When('I force-skip the competition assignment {string} with note {string}', async ({ page }, submissionId: string, note: string) => {
  const eventId = getCurrentEventId(page)
  const scope = page.getByTestId(`admin-competition-assignment-${submissionId}`)

  await expect(scope).toBeVisible()
  await scope.getByPlaceholder('Force-skip note').fill(note)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${eventId}/judging/assignments/`)
      && response.url().includes('/actions/force-skip')
      && response.ok()
    ),
    scope.getByTestId(`admin-competition-force-skip-submit-${submissionId}`).click()
  ])
})

When('I move the competition shortlist entry {string} up', async ({ page }, submissionId: string) => {
  await page.getByTestId(`admin-competition-shortlist-move-up-${submissionId}`).click()
})

When('I save the competition shortlist order', async ({ page }) => {
  const eventId = getCurrentEventId(page)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${eventId}/shortlist/actions/select-finalists`)
      && response.ok()
    ),
    page.getByTestId('admin-competition-shortlist-save').click()
  ])
})

Then('I should see the competition shortlist entry {string} at rank {string}', async ({ page }, submissionId: string, rank: string) => {
  await expect(page.getByTestId(`admin-competition-shortlist-rank-${submissionId}`)).toHaveText(`#${rank}`)
})

When('I announce competition winners', async ({ page }) => {
  const eventId = getCurrentEventId(page)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${eventId}/actions/announce-winners`)
      && response.ok()
    ),
    page.getByTestId('admin-competition-announce-winners').click()
  ])
})

When('I complete the competition event', async ({ page }) => {
  const eventId = getCurrentEventId(page)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${eventId}/actions/complete`)
      && response.ok()
    ),
    page.getByTestId('admin-competition-complete-event').click()
  ])
})

Then('I should see the competition winner {string}', async ({ page }, submissionId: string) => {
  await expect(page.getByTestId(`admin-competition-winner-${submissionId}`)).toBeVisible()
})

Then('I should see the competition redemption {string} with status {string}', async ({ page }, redemptionId: string, status: string) => {
  await expect(page.getByTestId(`admin-competition-redemption-${redemptionId}`)).toBeVisible()
  await expect(page.getByTestId(`admin-competition-redemption-status-${redemptionId}`)).toHaveText(status)
})
