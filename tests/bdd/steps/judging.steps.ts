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
  assignmentId?: string
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

When('the saved {string} session lists active assignments for the judging fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.judgingEventId}/judging/assignments`)
    const json = await response.json()
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.assignmentId = (json as { data?: Array<{ id?: string }> }).data
      ?.find(assignment => assignment.id === platformFixtureIds.judgingAssignmentId)
      ?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the judging assignment list should expose the fixture blind assignment without team identity', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: Array<{
      id?: string
      blindSubmission?: Record<string, unknown>
    }>
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).assignmentId).toBe(platformFixtureIds.judgingAssignmentId)

  const fixtureAssignment = payload.data?.find(assignment => assignment.id === platformFixtureIds.judgingAssignmentId)
  expect(fixtureAssignment?.blindSubmission).toMatchObject({
    projectName: 'Fixture Project One'
  })
  expect(fixtureAssignment?.blindSubmission).not.toHaveProperty('teamId')
  expect(fixtureAssignment?.blindSubmission).not.toHaveProperty('teamName')
})

When('the saved {string} session starts the remembered judging assignment', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.assignmentId) {
    throw new Error('No remembered judging assignment is available to start.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${platformFixtureIds.judgingEventId}/judging/assignments/${state.assignmentId}/actions/start`
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered judging assignment should report status {string}', async ({ page }, expectedStatus: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).assignmentId,
      status: expectedStatus
    }
  })
})

When('the saved {string} session completes the remembered judging assignment with fixture criterion scores', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)

  if (!state.assignmentId) {
    throw new Error('No remembered judging assignment is available to complete.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${platformFixtureIds.judgingEventId}/judging/assignments/${state.assignmentId}/actions/complete`,
      {
        data: {
          criterionScores: [
            {
              evaluationCriterionId: platformFixtureIds.judgingCriterionOneId,
              score: 5,
              comment: 'Strong novelty'
            },
            {
              evaluationCriterionId: platformFixtureIds.judgingCriterionTwoId,
              score: 5,
              comment: 'Strong execution'
            }
          ]
        }
      }
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered judging assignment should include both fixture judging criterion scores', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: {
      criterionScores?: Array<{
        evaluationCriterionId?: string
      }>
    }
  }

  expect(payload.data?.criterionScores).toEqual(expect.arrayContaining([
    expect.objectContaining({
      evaluationCriterionId: platformFixtureIds.judgingCriterionOneId
    }),
    expect.objectContaining({
      evaluationCriterionId: platformFixtureIds.judgingCriterionTwoId
    })
  ]))
})

When('the saved {string} session force-skips the started judging fixture assignment', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${platformFixtureIds.judgingEventId}/judging/assignments/${platformFixtureIds.judgingStartedAssignmentId}/actions/force-skip`,
      {
        data: {
          reason: 'Unavailable'
        }
      }
    )
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the force-skip response should reassign the started judging fixture submission to {string}', async ({ page }, judgeUserId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      submissionId: 'submission_judging_fixture_two',
      judgeUserId,
      status: 'assigned'
    }
  })
})
