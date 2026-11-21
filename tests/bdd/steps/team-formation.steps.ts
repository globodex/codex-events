import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import { platformFixtureIds } from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'

const { When, Then } = createBdd()

type ScenarioState = {
  response?: APIResponse
  json?: unknown
  applicationId?: string
  teamId?: string
  joinRequestId?: string
  eventId?: string
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

When('the saved {string} session submits an application for the fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const eventId = platformFixtureIds.apiTeamFormationEventId

  try {
    const response = await apiClient.post(`/api/events/${eventId}/applications`, {
      data: {
        applicationTermsDocumentId: platformFixtureIds.apiTeamFormationApplicationTermsDocumentId
      }
    })
    const json = await response.json()
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.applicationId = (json as { data?: { id?: string } }).data?.id
    state.eventId = eventId
  } finally {
    await apiClient.dispose()
  }
})

Then('the submitted application should accept the current fixture application terms', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      applicationTermsDocumentId?: string
      status?: string
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBeTruthy()
  expect(payload.data?.applicationTermsDocumentId).toBe(platformFixtureIds.apiTeamFormationApplicationTermsDocumentId)
  expect(payload.data?.status).toBe('submitted')
})

When('the saved {string} session approves the remembered application', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.applicationId) {
    throw new Error('No remembered application id is available for approval.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const stageResponse = await apiClient.post(
      `/api/events/${state.eventId}/applications/${state.applicationId}/actions/approve`
    )
    if (!stageResponse.ok()) {
      state.response = stageResponse
      state.json = await stageResponse.json()
      return
    }

    const applyResponse = await apiClient.post(
      `/api/events/${state.eventId}/applications/actions/apply-staged-decisions`
    )
    state.response = applyResponse
    state.json = await applyResponse.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered application should be approved by {string}', async ({ page }, reviewerUserId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      applications: expect.arrayContaining([
        expect.objectContaining({
          id: getScenarioState(page).applicationId,
          status: 'approved',
          reviewedByUserId: reviewerUserId
        })
      ])
    }
  })
})

When('the saved {string} session creates an open team named {string}', async ({ page }, personaKey: string, teamName: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))
  const state = getScenarioState(page)
  const eventId = state.eventId ?? platformFixtureIds.apiSoloTeamEventId

  try {
    const response = await apiClient.post(`/api/events/${eventId}/teams`, {
      data: {
        name: teamName,
        isOpenToJoinRequests: true
      }
    })
    const json = await response.json()
    state.response = response
    state.json = json
    state.teamId = (json as { data?: { id?: string } }).data?.id
    state.eventId = eventId
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered team should be created with admin {string}', async ({ page }, adminUserId: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      members?: Array<{
        userId?: string
        role?: string
      }>
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBe(getScenarioState(page).teamId)
  expect(payload.data?.members).toEqual(expect.arrayContaining([
    expect.objectContaining({
      userId: adminUserId,
      role: 'admin'
    })
  ]))
})

When('the saved {string} session creates a join request for the remembered team', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.teamId) {
    throw new Error('No remembered team id is available for join-request creation.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/team-join-requests`, {
      data: {
        teamId: state.teamId
      }
    })
    const json = await response.json()
    state.response = response
    state.json = json
    state.joinRequestId = (json as { data?: { id?: string } }).data?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered join request should be pending for user {string}', async ({ page }, userId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).joinRequestId,
      teamId: getScenarioState(page).teamId,
      userId,
      status: 'pending'
    }
  })
})

When('the saved {string} session approves the remembered join request', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.joinRequestId) {
    throw new Error('No remembered join request id is available for approval.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${state.eventId}/team-join-requests/${state.joinRequestId}/actions/approve`
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered join request should be approved by {string}', async ({ page }, reviewerUserId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).joinRequestId,
      status: 'approved',
      reviewedByUserId: reviewerUserId
    }
  })
})

When('the saved {string} session loads the remembered team detail', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.teamId) {
    throw new Error('No remembered team id is available for detail lookup.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${state.eventId}/teams/${state.teamId}`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered team should include member {string}', async ({ page }, userId: string) => {
  const payload = getScenarioState(page).json as {
    data?: {
      id?: string
      members?: Array<{
        userId?: string
      }>
    }
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.id).toBe(getScenarioState(page).teamId)
  expect(payload.data?.members).toEqual(expect.arrayContaining([
    expect.objectContaining({
      userId
    })
  ]))
})

When('the saved {string} session leaves the remembered team', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.teamId) {
    throw new Error('No remembered team id is available for leave.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${state.eventId}/teams/${state.teamId}/actions/leave`)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered team action should fail with API error code {string}', async ({ page }, expectedCode: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(false)
  const payload = getScenarioState(page).json as {
    error?: {
      code?: string
    }
  }

  expect(payload.error?.code).toBe(expectedCode)
})

Then('the remembered team leave action should dissolve the solo team', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)

  const payload = getScenarioState(page).json as {
    data?: {
      teamId?: string
      teamDissolved?: boolean
    }
  }

  expect(payload.data?.teamId).toBe(getScenarioState(page).teamId)
  expect(payload.data?.teamDissolved).toBe(true)
})
