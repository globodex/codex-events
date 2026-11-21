import type { APIResponse, Page } from '@playwright/test'

import { expect, request } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { fixtureEventVisibilitySlug, platformFixtureIds } from '../support/platform-fixtures.ts'
import { getBaseUrl, parsePersonaKey } from '../support/personas.ts'

const { When, Then } = createBdd()

type ScenarioState = {
  response?: APIResponse
  json?: unknown
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

function parseBooleanString(value: string) {
  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new Error(`Unsupported boolean string: ${value}`)
}

When('the saved {string} session requests the current API actor context', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get('/api/session')
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the API actor kind should be {string}', async ({ page }, actorKind: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      actor?: {
        kind?: string
      }
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.actor?.kind).toBe(actorKind)
})

Then('the API actor platform-account flag should be {string}', async ({ page }, hasPlatformAccount: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      actor?: {
        hasPlatformAccount?: boolean
      }
    }
  }

  expect(payload.data?.actor?.hasPlatformAccount).toBe(parseBooleanString(hasPlatformAccount))
})

Then('the API actor platform-admin flag should be {string}', async ({ page }, isPlatformAdmin: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      actor?: {
        isPlatformAdmin?: boolean
      }
    }
  }

  expect(payload.data?.actor?.isPlatformAdmin).toBe(parseBooleanString(isPlatformAdmin))
})

Then('the API actor should expose the fixture event role {string}', async ({ page }, expectedRole: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      actor?: {
        eventRoles?: Array<{
          eventId: string
          role: string
        }>
      }
    }
  }
  const roles = payload.data?.actor?.eventRoles ?? []
  const fixtureRole = roles.find((role: { eventId: string }) => role.eventId === platformFixtureIds.eventId)

  if (expectedRole === 'none') {
    expect(fixtureRole ?? null).toBeNull()
    return
  }

  expect(fixtureRole).toMatchObject({
    eventId: platformFixtureIds.eventId,
    role: expectedRole
  })
})

When('the saved {string} session accepts the fixture platform terms document', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post('/api/platform-document-acceptances', {
      data: {
        platformDocumentId: platformFixtureIds.platformTermsDocumentId
      }
    })
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the platform document acceptance response should reference the fixture platform terms document', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      acceptance: {
        platformDocumentId: platformFixtureIds.platformTermsDocumentId
      },
      document: {
        id: platformFixtureIds.platformTermsDocumentId
      }
    }
  })
})

When('the saved {string} session lists fixture event roles', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.eventId}/roles`)
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the fixture role response should include user {string} as {string}', async ({ page }, userId: string, role: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  const payload = getScenarioState(page).json as {
    data?: Array<{
      userId: string
      role: string
    }>
  }

  expect(payload.data).toEqual(expect.arrayContaining([
    expect.objectContaining({
      userId,
      role
    })
  ]))
})

When('the saved {string} session grants platform-admin access to {string}', async ({ page }, personaKey: string, userId: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.put(`/api/platform-admins/${userId}`)
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the platform-admin grant response should promote user {string}', async ({ page }, userId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      user: {
        id: userId,
        isPlatformAdmin: true
      }
    }
  })
})

When('the saved {string} session lists platform admins', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get('/api/platform-admins')
    scenarioState.set(page, { response, json: await response.json() })
  } finally {
    await apiClient.dispose()
  }
})

Then('the platform-admin list should include {string}', ({ page }, userId: string) => {
  const { response, json } = getScenarioState(page)
  expect(response?.ok()).toBe(true)
  expect(json).toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({ id: userId, isPlatformAdmin: true })
    ])
  })
})

When('the saved {string} session opens submission for the fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.eventId}/actions/open-submission`)
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the fixture event state should be {string}', async ({ page }, expectedState: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      state?: string
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBe(platformFixtureIds.eventId)
  expect(payload.data?.state).toBe(expectedState)
})

When('the saved {string} session hides the visibility fixture with reason {string}', async ({ page }, personaKey: string, reason: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.eventVisibilityId}/actions/hide`, {
      data: { reason }
    })
    scenarioState.set(page, { response, json: await response.json() })
  } finally {
    await apiClient.dispose()
  }
})

Then('the hidden visibility fixture should include reason {string}', async ({ page }, reason: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      hiddenAt?: string | null
      hiddenReason?: string | null
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBe(platformFixtureIds.eventVisibilityId)
  expect(payload.data?.hiddenAt).toBeTruthy()
  expect(payload.data?.hiddenReason).toBe(reason)
})

When('the public API requests the visibility fixture', async ({ page }) => {
  const apiClient = await request.newContext({
    baseURL: getBaseUrl(process.env)
  })

  try {
    const response = await apiClient.get(`/api/public/events/${fixtureEventVisibilitySlug}`)
    scenarioState.set(page, { response, json: await response.json() })
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session restores the visibility fixture', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.eventVisibilityId}/actions/unhide`)
    scenarioState.set(page, { response, json: await response.json() })
  } finally {
    await apiClient.dispose()
  }
})

Then('the visibility fixture should be restored', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      hiddenAt?: string | null
      hiddenByUserId?: string | null
      hiddenReason?: string | null
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBe(platformFixtureIds.eventVisibilityId)
  expect(payload.data?.hiddenAt).toBeNull()
  expect(payload.data?.hiddenByUserId).toBeNull()
  expect(payload.data?.hiddenReason).toBeNull()
})

Then('the public API should show the visibility fixture', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: {
      slug?: string
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.slug).toBe(fixtureEventVisibilitySlug)
})

Then('the API error code should be {string}', async ({ page }, expectedCode: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(false)
  const payload = getScenarioState(page).json as {
    error?: {
      code?: string
    }
  }

  expect(payload.error?.code).toBe(expectedCode)
})

When('the saved {string} session deletes the current platform account', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.delete('/api/account')
    getScenarioState(page).response = response
    getScenarioState(page).json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the account deletion response should succeed for {string}', async ({ page: _page }, personaKey: string) => {
  void personaKey
  expect(getScenarioState(_page).response?.ok()).toBe(true)
  const payload = getScenarioState(_page).json as {
    data?: {
      userId?: string
      deletedAt?: string
    }
  }
  expect(payload.data?.userId).toBeTruthy()
  expect(payload.data?.deletedAt).toBeTruthy()
})

Then('the saved {string} session should resolve to an authenticated identity without a platform account', async ({ request: _request }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get('/api/session')
    const payload = await response.json()

    expect(response.ok()).toBe(true)
    expect(payload).toMatchObject({
      data: {
        actor: {
          kind: 'authenticated_identity',
          isAuthenticated: true,
          hasPlatformAccount: false,
          platformUser: null,
          isPlatformAdmin: false,
          eventRoles: []
        }
      }
    })
  } finally {
    await apiClient.dispose()
  }
})
