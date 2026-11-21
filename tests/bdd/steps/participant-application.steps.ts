import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

type ScenarioState = {
  response?: APIResponse
  json?: unknown
}

type ParticipantApplicationFixture = {
  eventId: string
  applicationTermsDocumentId?: string
}

const scenarioState = new WeakMap<Page, ScenarioState>()

const participantApplicationFixtures: Record<string, ParticipantApplicationFixture> = {
  'participant-application-fixture-event': {
    eventId: platformFixtureIds.participantApplicationEventId,
    applicationTermsDocumentId: platformFixtureIds.participantApplicationTermsDocumentId
  },
  'participant-profile-requirement-fixture-event': {
    eventId: platformFixtureIds.participantProfileRequirementEventId,
    applicationTermsDocumentId: platformFixtureIds.participantProfileRequirementTermsDocumentId
  },
  'participant-approved-fixture-event': {
    eventId: platformFixtureIds.participantApprovedEventId
  },
  'participant-rejected-fixture-event': {
    eventId: platformFixtureIds.participantRejectedEventId
  }
}

function getScenarioState(page: Page) {
  let state = scenarioState.get(page)

  if (!state) {
    state = {}
    scenarioState.set(page, state)
  }

  return state
}

function resolveParticipantApplicationFixture(slug: string) {
  const fixture = participantApplicationFixtures[slug]

  if (!fixture) {
    throw new Error(`Unknown participant application fixture slug: ${slug}`)
  }

  return fixture
}

When('I open the participant application page for event slug {string} with the saved {string} session', async ({ page }, slug: string, personaKey: string) => {
  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto(`/events/${slug}`)
})

When('the saved {string} session submits a participant application for event slug {string}', async ({ page }, personaKey: string, slug: string) => {
  const fixture = resolveParticipantApplicationFixture(slug)

  if (!fixture.applicationTermsDocumentId) {
    throw new Error(`No application terms document configured for participant application fixture slug: ${slug}`)
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${fixture.eventId}/applications`, {
      data: {
        applicationTermsDocumentId: fixture.applicationTermsDocumentId
      }
    })

    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session loads their participant application for event slug {string}', async ({ page }, personaKey: string, slug: string) => {
  const fixture = resolveParticipantApplicationFixture(slug)
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${fixture.eventId}/applications/me`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the participant application response should have status {string}', async ({ page }, expectedStatus: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      status?: string
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.status).toBe(expectedStatus)
})

Then('the participant application request should fail with API error code {string}', async ({ page }, expectedCode: string) => {
  const payload = getScenarioState(page).json as {
    error?: {
      code?: string
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(false)
  expect(payload.error?.code).toBe(expectedCode)
})

Then('the participant application error should list missing profile field {string}', async ({ page }, fieldName: string) => {
  const payload = getScenarioState(page).json as {
    error?: {
      details?: {
        missingFields?: string[]
      }
    }
  }

  expect(payload.error?.details?.missingFields).toContain(fieldName)
})
