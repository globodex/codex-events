import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { parsePersonaKey } from '../support/personas.ts'

const { When, Then } = createBdd()
const pngFixtureBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64'
)

type ScenarioState = {
  response?: APIResponse
  json?: unknown
  eventId?: string
  eventSlug?: string
  criterionId?: string
  eventTermsDocumentId?: string
  backgroundImageUrl?: string
  backgroundImageRevision?: number
}

const scenarioState = new WeakMap<Page, ScenarioState>()

function getScenarioState(page: Page) {
  let state = scenarioState.get(page)

  if (!state) {
    state = {}
    scenarioState.set(page, state)
  }

  return state
}

When('the saved {string} session creates a managed event named {string}', async ({ page }, personaKey: string, name: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const now = Date.now()

  try {
    const response = await apiClient.post('/api/events', {
      data: {
        eventType: 'hackathon',
        name,
        slug: `bdd-managed-event-${now}`,
        description: 'Event created by TASK-3.9 authenticated release-gate coverage.',
        agendaItems: [],
        city: 'Vienna',
        country: 'Austria',
        address: 'BDD Fixture Address',
        registrationOpensAt: new Date(now - 3_600_000).toISOString(),
        registrationClosesAt: new Date(now + 86_400_000).toISOString(),
        submissionOpensAt: new Date(now + 86_400_000).toISOString(),
        submissionClosesAt: new Date(now + 172_800_000).toISOString(),
        maxTeamMembers: 5,
        requireXProfile: false,
        requireLinkedinProfile: false,
        requireGithubProfile: false,
        requireLumaEmail: false
      }
    })
    const json = await response.json() as {
      data?: {
        id?: string
      }
    }
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.eventId = json.data?.id
    state.eventSlug = json.data?.slug
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should be created in state {string}', async ({ page }, expectedState: string) => {
  const state = getScenarioState(page)

  expect(state.response?.ok(), `Expected event creation to succeed, received HTTP ${state.response?.status()} with ${JSON.stringify(state.json)}`).toBe(true)
  expect(state.eventId).toBeTruthy()
  expect(state.json).toMatchObject({
    data: {
      id: state.eventId,
      state: expectedState
    }
  })
})

When('the saved {string} session uploads a background image for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for image upload.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/images/background`, {
      multipart: {
        file: {
          name: 'background.png',
          mimeType: 'image/png',
          buffer: pngFixtureBytes
        }
      }
    })
    const json = await response.json() as {
      data?: {
        backgroundImageUrl?: string
        backgroundImageRevision?: number
      }
    }
    const backgroundImageUrl = json.data?.backgroundImageUrl
    const backgroundImageRevision = json.data?.backgroundImageRevision

    if (!backgroundImageUrl || !Number.isInteger(backgroundImageRevision) || backgroundImageRevision < 0) {
      throw new Error('The background image upload did not return a managed URL and background image revision.')
    }

    const versionedBackgroundImageUrl = new URL(backgroundImageUrl)
    versionedBackgroundImageUrl.searchParams.set('variant', 'background')
    versionedBackgroundImageUrl.searchParams.set('v', String(backgroundImageRevision))

    state.response = response
    state.json = json
    state.backgroundImageUrl = versionedBackgroundImageUrl.toString()
    state.backgroundImageRevision = backgroundImageRevision
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session opens registration for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available to open registration.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/actions/open-registration`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should expose a managed background image URL', async ({ page }) => {
  const state = getScenarioState(page)

  expect(state.response?.ok()).toBe(true)
  expect(state.backgroundImageUrl).toMatch(/^https?:\/\/.+\/api\/public\/events\/.+\/images\/background\?variant=background&v=\d+$/)

  const imageUrl = new URL(state.backgroundImageUrl!)
  expect(imageUrl.searchParams.get('variant')).toBe('background')
  expect(imageUrl.searchParams.get('v')).toBe(String(state.backgroundImageRevision))
})

Then('the remembered managed event background image endpoint should return the uploaded image', async ({ page }) => {
  const state = getScenarioState(page)

  if (!state.backgroundImageUrl) {
    throw new Error('No remembered background image URL is available for image validation.')
  }

  const apiClient = await createAuthenticatedApiClient('platform_admin')

  try {
    const imageUrl = new URL(state.backgroundImageUrl)
    const response = await apiClient.get(`${imageUrl.pathname}${imageUrl.search}`, {
      headers: {
        accept: 'image/webp'
      }
    })

    expect(response.ok(), `Expected transformed public background delivery, received HTTP ${response.status()}`).toBe(true)
    expect(response.headers()['content-type']).toBe('image/webp')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['cache-control']).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers()['cloudflare-cdn-cache-control']).toBe('public, max-age=30, stale-if-error=0')
    expect(response.headers()['vary']).toBe('Accept')

    const responseBody = await response.body()
    expect(responseBody.equals(pngFixtureBytes)).toBe(false)
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session adds evaluation criterion {string} with weight {int} and display order {int} to the remembered managed event', async ({ page }, personaKey: string, name: string, weight: number, displayOrder: number) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for criterion creation.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/evaluation-criteria`, {
      data: {
        name,
        description: `${name} criterion for TASK-3.9 release-gate coverage.`,
        weight,
        displayOrder
      }
    })
    const json = await response.json() as {
      data?: {
        id?: string
      }
    }
    state.response = response
    state.json = json
    state.criterionId = json.data?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event criterion should be created with display order {int}', async ({ page }, displayOrder: number) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).criterionId).toBeTruthy()
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).criterionId,
      displayOrder
    }
  })
})

When('the saved {string} session publishes application terms titled {string} for the remembered managed event', async ({ page }, personaKey: string, title: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for terms creation.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${state.eventId}/terms/application_terms/versions`,
      {
        data: {
          title,
          content: `${title} content`
        }
      }
    )
    const json = await response.json() as {
      data?: {
        id?: string
      }
    }
    state.response = response
    state.json = json
    state.eventTermsDocumentId = json.data?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event terms document should be {string} version {int}', async ({ page }, documentType: string, version: number) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).eventTermsDocumentId).toBeTruthy()
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).eventTermsDocumentId,
      documentType,
      version
    }
  })
})

When('the saved {string} session sets the remembered managed event application terms as current', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId || !state.eventTermsDocumentId) {
    throw new Error('No remembered managed event terms document is available to set current.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${state.eventId}/terms/application_terms/actions/set-current`,
      {
        data: {
          eventTermsDocumentId: state.eventTermsDocumentId
        }
      }
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered managed event should reference the remembered current application terms document', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).eventId,
      currentApplicationTermsDocumentId: getScenarioState(page).eventTermsDocumentId
    }
  })
})

When('the saved {string} session loads current terms for the remembered managed event', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.eventId) {
    throw new Error('No remembered managed event is available for current-terms lookup.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${state.eventId}/terms/current`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the current terms response should expose the remembered current application terms document', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      application_terms: {
        id: getScenarioState(page).eventTermsDocumentId
      }
    }
  })
})
