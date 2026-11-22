import { expect, type Page, type Route } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import {
  platformFixtureIds,
  resetJudgeWorkspaceFixtureScenarioState
} from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()
const judgeWorkspaceEventSlug = 'e2e-judge-workspace-fixture-event'

const pendingJudgeInboxes = new WeakMap<Page, Promise<Route>>()

When('I open the judge dashboard with a delayed inbox response', async ({ page }) => {
  await signInAs('judge', page)
  const held = Promise.withResolvers<Route>()
  pendingJudgeInboxes.set(page, held.promise)
  await page.route('**/api/account/judging', held.resolve)
  await page.goto('/account/judging', { waitUntil: 'domcontentloaded' })
})

Then('the judge dashboard should show {string} without assignment results', async ({ page }, message: string) => {
  await expect(page.getByText(message, { exact: true })).toBeVisible()
  await expect(page.getByText('Active assignments', { exact: true })).toHaveCount(0)
  await expect(page.getByText('No judge assignments yet')).toHaveCount(0)
})

When('the judge inbox request fails', async ({ page }) => {
  const route = await pendingJudgeInboxes.get(page)
  if (!route) throw new Error('No judge inbox request is pending.')
  await route.fulfill({ status: 503, json: { message: 'Judge inbox unavailable' } })
})

const directAssignmentReads = new WeakMap<Page, string[]>()

When('I open the fixture blind assignment from its saved link', async ({ page }) => {
  await signInAs('judge', page)
  const reads: string[] = []
  directAssignmentReads.set(page, reads)
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (request.method() === 'GET' && (pathname === '/api/session' || pathname.startsWith('/api/account/'))) {
      reads.push(pathname)
    }
  })
  await page.goto(`/account/events/${judgeWorkspaceEventSlug}?tab=judging&assignment=${platformFixtureIds.judgeWorkspaceAssignmentId}`)
})

Then('the assignment should load with one session read and one assignment read', async ({ page }) => {
  expect(directAssignmentReads.get(page)).toEqual([
    '/api/session',
    `/api/account/events/${judgeWorkspaceEventSlug}/judging/assignments/${platformFixtureIds.judgeWorkspaceAssignmentId}`
  ])
})

async function waitForJudgeWorkspaceInbox(page: Page) {
  await expect(page.getByText('Active assignments', { exact: true })).toBeVisible({ timeout: 15_000 })
}

function getAssignmentCard(page: Page, assignmentId: string) {
  return page.getByTestId(`judge-assignment-card-${assignmentId}`)
}

When('I open the judge workspace with the saved {string} session', async ({ page }, personaKey: string) => {
  await resetJudgeWorkspaceFixtureScenarioState()
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/account/events/${judgeWorkspaceEventSlug}?tab=judging`)
  await waitForJudgeWorkspaceInbox(page)
})

Then('I should see the fixture blind workspace assignment card', async ({ page }) => {
  await expect(getAssignmentCard(page, platformFixtureIds.judgeWorkspaceAssignmentId)).toBeVisible()
})

Then('the fixture blind workspace assignment card should show title {string}', async ({ page }, title: string) => {
  await expect(
    getAssignmentCard(page, platformFixtureIds.judgeWorkspaceAssignmentId).getByRole('heading', { name: title })
  ).toBeVisible()
})

Then('the fixture blind workspace assignment card should show context label {string}', async ({ page }, label: string) => {
  await expect(
    getAssignmentCard(page, platformFixtureIds.judgeWorkspaceAssignmentId).getByText(label, { exact: true })
  ).toBeVisible()
})

Then('I should not see the fixture blind workspace assignment card', async ({ page }) => {
  await expect(getAssignmentCard(page, platformFixtureIds.judgeWorkspaceAssignmentId)).toHaveCount(0)
})

Then('I should see the in-progress blind workspace assignment card', async ({ page }) => {
  await expect(getAssignmentCard(page, platformFixtureIds.judgeWorkspaceStartedAssignmentId)).toBeVisible()
})

Then('I should not see the in-progress blind workspace assignment card', async ({ page }) => {
  await expect(getAssignmentCard(page, platformFixtureIds.judgeWorkspaceStartedAssignmentId)).toHaveCount(0)
})

Then('I should not see the judge workspace text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toHaveCount(0)
})

When('I open the fixture blind workspace assignment', async ({ page }) => {
  const card = getAssignmentCard(page, platformFixtureIds.judgeWorkspaceAssignmentId)

  await expect(card).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/account/events/${judgeWorkspaceEventSlug}\\?tab=judging&assignment=`))
})

When('I open the in-progress blind workspace assignment', async ({ page }) => {
  const card = getAssignmentCard(page, platformFixtureIds.judgeWorkspaceStartedAssignmentId)

  await expect(card).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(new RegExp(`/account/events/${judgeWorkspaceEventSlug}\\?tab=judging&assignment=`))
})

Then('I should see the blind assignment title {string}', async ({ page }, title: string) => {
  await expect(page.getByTestId('judge-assignment-project-name')).toHaveText(title)
})

When('I start the opened blind review', async ({ page }) => {
  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${platformFixtureIds.judgeWorkspaceEventId}/judging/assignments/${platformFixtureIds.judgeWorkspaceAssignmentId}/actions/start`)
      && response.ok()
    ),
    page.getByTestId(`judge-criterion-score-option-${platformFixtureIds.judgeWorkspaceCriterionOneId}-5`).click()
  ])
})

Then('the opened blind assignment should show status {string}', async ({ page }, statusLabel: string) => {
  await expect(page.getByTestId('judge-assignment-status')).toContainText(statusLabel)
})

Then('the opened blind assignment should hide the complete action and show the queue return action', async ({ page }) => {
  await expect(page.getByTestId('judge-complete-review')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back to queue' })).toBeVisible()
})

When('I complete the opened blind review with workspace fixture scores', async ({ page }) => {
  await page.getByTestId(`judge-criterion-score-option-${platformFixtureIds.judgeWorkspaceCriterionOneId}-5`).click()
  await page.getByTestId(`judge-criterion-score-option-${platformFixtureIds.judgeWorkspaceCriterionTwoId}-5`).click()

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${platformFixtureIds.judgeWorkspaceEventId}/judging/assignments/${platformFixtureIds.judgeWorkspaceAssignmentId}/actions/complete`)
      && response.ok()
    ),
    page.getByTestId('judge-complete-review').click()
  ])
})

When('I mark the opened blind assignment ineligible with reason {string}', async ({ page }, reason: string) => {
  await page.getByTestId('judge-ineligibility-reason').fill(reason)

  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/${platformFixtureIds.judgeWorkspaceEventId}/judging/assignments/${platformFixtureIds.judgeWorkspaceAssignmentId}/actions/mark-ineligible`)
      && response.ok()
    ),
    page.getByTestId('judge-mark-ineligible').click()
  ])
})

Then('the opened blind assignment should show ineligibility {string}', async ({ page }, label: string) => {
  await expect(page.getByTestId('judge-assignment-ineligibility')).toContainText(label)
})

When('I skip the opened blind review with reason {string}', async ({ page }, reason: string) => {
  const showSkipButton = page.getByTestId('judge-show-skip-review')

  if (await showSkipButton.isVisible().catch(() => false)) {
    await showSkipButton.click()
  }

  await page.getByTestId('judge-skip-reason').fill(reason)

  await Promise.all([
    page.waitForURL(`**/account/events/${judgeWorkspaceEventSlug}?tab=judging`),
    page.getByTestId('judge-skip-review').click()
  ])
  await page.waitForLoadState('domcontentloaded')
})

Then('I should be returned to the event judging tab', async ({ page }) => {
  await expect(page).toHaveURL(new RegExp(`/account/events/${judgeWorkspaceEventSlug}\\?tab=judging$`))
  await expect(page.getByRole('tab', { name: 'Judging', exact: true })).toHaveAttribute('aria-selected', 'true')
})

When('I reopen the judge workspace for the fixture event', async ({ page }) => {
  await page.goto(`/account/events/${judgeWorkspaceEventSlug}?tab=judging`)
  await waitForJudgeWorkspaceInbox(page)
})
