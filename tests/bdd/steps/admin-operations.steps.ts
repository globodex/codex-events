import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

function formatParticipantViewLabel(status: string) {
  switch (status) {
    case 'submitted':
      return 'New'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Rejected'
    case 'withdrawn':
      return 'Withdrawn'
    default:
      return null
  }
}

function getCurrentEventSlug(page: Page) {
  const segments = new URL(page.url()).pathname.split('/').filter(Boolean)
  return segments[segments.indexOf('events') + 1] ?? ''
}

export function resolveEventSlug(eventId: string) {
  switch (eventId) {
    case 'event_e2e_fixture':
      return 'e2e-fixture-event'
    case 'event_e2e_operations_fixture':
      return 'operations-fixture-event'
    default:
      throw new Error(`No account-workspace slug mapping is configured for event "${eventId}".`)
  }
}

function waitForParticipantListRead(page: Page) {
  const path = `/api/account/events/${getCurrentEventSlug(page)}/participants`
  return page.waitForResponse(response => new URL(response.url()).pathname === path
    && response.request().method() === 'GET' && response.ok())
}

async function waitForApplicationStatus(page: Page, applicationId: string, status: 'submitted' | 'approved' | 'rejected' | 'withdrawn') {
  const apiClient = await createAuthenticatedApiClient('event_admin')
  const eventSlug = getCurrentEventSlug(page)

  try {
    await expect.poll(async () => {
      const response = await apiClient.get(`/api/account/events/${eventSlug}/participants`)

      if (!response.ok()) {
        return null
      }

      const payload = await response.json() as {
        data?: {
          page?: {
            applications?: Array<{
              id?: string
              status?: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null
            }>
          }
        }
      }

      return payload.data?.page?.applications?.find(application => application.id === applicationId)?.status ?? null
    }, {
      timeout: 10_000
    }).toBe(status)
  } finally {
    await apiClient.dispose()
  }
}

async function openParticipantReviewView(page: Page, status: string) {
  const participantViewLabel = formatParticipantViewLabel(status)

  if (!participantViewLabel) {
    throw new Error(`Unsupported admin application status assertion: ${status}`)
  }

  await page.getByRole('button', {
    name: participantViewLabel,
    exact: false
  }).click()
}

async function waitForAdminApplication(page: Page, applicationId: string) {
  const application = page.getByTestId(`admin-application-${applicationId}`)

  await expect(application).toBeVisible({
    timeout: 15_000
  })

  return application
}

When('I open the admin operations page for event {string} with the saved {string} session', async ({ page }, eventId: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  const eventSlug = resolveEventSlug(eventId)

  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url())

      return url.pathname === `/api/account/events/${eventSlug}/participants`
        && response.ok()
    }),
    page.goto(`/account/events/${eventSlug}?tab=participants`)
  ])
})

Then('I should see the admin operations text {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible()
})

Then('I should see the admin application {string} with status {string}', async ({ page }, applicationId: string, status: string) => {
  await openParticipantReviewView(page, status)
  await waitForApplicationStatus(page, applicationId, status as 'submitted' | 'approved' | 'rejected' | 'withdrawn')
  await waitForAdminApplication(page, applicationId)
})

When('I save the staged application decisions', async ({ page }) => {
  const saveButton = page.getByTestId('admin-application-save-decisions')
  await expect(saveButton).toBeEnabled()
  const [response] = await Promise.all([
    page.waitForResponse(response =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/applications/actions/apply-staged-decisions')
    ),
    saveButton.click()
  ])
  expect(response.ok(), `Apply staged decisions returned HTTP ${response.status()}`).toBe(true)
})

When('I stage approval for the admin application {string}', async ({ page }, applicationId: string) => {
  const application = await waitForAdminApplication(page, applicationId)
  const approveButton = application.getByTestId(`admin-application-approve-${applicationId}`)

  await approveButton.scrollIntoViewIfNeeded()
  await expect(approveButton).toBeInViewport()
  await expect(approveButton).toBeEnabled()

  if ((await approveButton.getAttribute('aria-pressed')) !== 'true') {
    await Promise.all([waitForParticipantListRead(page), approveButton.click()])
  }

  await expect(approveButton).toHaveAttribute('aria-pressed', 'true')
})

When('I stage rejection for the admin application {string}', async ({ page }, applicationId: string) => {
  const application = await waitForAdminApplication(page, applicationId)
  const rejectButton = application.getByTestId(`admin-application-reject-${applicationId}`)

  await expect(rejectButton).toBeEnabled()

  if ((await rejectButton.getAttribute('aria-pressed')) !== 'true') {
    await rejectButton.focus()
    await Promise.all([waitForParticipantListRead(page), rejectButton.press('Enter')])
  }

  await expect(rejectButton).toHaveAttribute('aria-pressed', 'true')
})

Then('approval for {string} should still be staged after I reopen Participants', async ({ page }, applicationId: string) => {
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Overview' })).toBeVisible()
  await page.getByRole('tab', { name: 'Participants', exact: true }).click()
  await expect(page.getByTestId(`admin-application-approve-${applicationId}`)).toHaveAttribute('aria-pressed', 'true')
})

Then('I should see the admin team {string} with submission status {string}', async ({ page }, teamId: string, status: string) => {
  const team = page.getByTestId(`admin-team-${teamId}`)

  await expect(team).toBeVisible()
  await expect(team.getByText(status, {
    exact: false
  }).first()).toBeVisible()
})

Then('I should not see the admin team {string}', async ({ page }, teamId: string) => {
  await expect(page.getByTestId(`admin-team-${teamId}`)).toHaveCount(0)
})

When('I load more admin teams', async ({ page }) => {
  const loadMoreButton = page.getByTestId('admin-operations-load-more-teams')
  const eventId = getCurrentEventSlug(page)

  await expect(loadMoreButton).toBeVisible()
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url())

      return url.pathname === `/api/events/${eventId}/teams`
        && url.searchParams.get('page') === '2'
        && response.ok()
    }),
    loadMoreButton.click()
  ])
})

When('I admin-withdraw the team submission for {string} with note {string}', async ({ page }, teamId: string, note: string) => {
  await page.getByTestId(`admin-team-expand-toggle-${teamId}`).click()

  const team = page.getByTestId(`admin-withdraw-team-${teamId}`)

  await expect(team).toBeVisible()
  await team.getByPlaceholder('Requested by team due to...').fill(note)
  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/`)
      && response.url().includes(`/teams/${teamId}/submission/actions/admin-withdraw`)
      && response.ok()
    ),
    team.getByTestId(`admin-withdraw-submit-${teamId}`).click()
  ])
})

When('I disqualify the admin team submission for {string} with note {string}', async ({ page }, teamId: string, note: string) => {
  const interventionsToggle = page.getByTestId('admin-submission-interventions-toggle')
  const interventionsPanel = page.getByTestId('admin-submission-interventions-panel')

  if (await interventionsPanel.count() === 0) {
    await interventionsToggle.click()
  }

  const team = page.getByTestId(`admin-disqualify-team-${teamId}`)

  await expect(team).toBeVisible()
  await team.getByPlaceholder('Competition removal reason').fill(note)
  await Promise.all([
    page.waitForResponse(response =>
      response.url().includes(`/api/events/`)
      && response.url().includes(`/teams/${teamId}/submission/actions/disqualify`)
      && response.ok()
    ),
    team.getByTestId(`admin-disqualify-submit-${teamId}`).click()
  ])
})
