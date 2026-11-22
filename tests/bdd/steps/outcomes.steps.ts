import type { APIResponse, Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

import { createAuthenticatedApiClient } from '../support/api-client'
import {
  platformFixtureIds,
  resetOutcomesFixtureScenarioState
} from '../support/platform-fixtures.ts'
import { parsePersonaKey } from '../support/personas.ts'
import { signInAs } from '../support/session-state.ts'

const { When, Then } = createBdd()

type ActivePitchAssignment = {
  id: string
  submissionId: string
  judgeUserId: string
  reviewStage: 'blind_review' | 'pitch_review'
  status: 'assigned' | 'judge_started' | 'judge_completed' | 'skipped'
}

type ScenarioState = {
  response?: APIResponse
  json?: unknown
  redemptionId?: string
  pitchAssignments?: ActivePitchAssignment[]
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

function parseAuditActions(actions: string) {
  return actions
    .split(',')
    .map(action => action.trim())
    .filter(Boolean)
}

When('the saved {string} session selects outcomes finalists to prefer submission two', async ({ page }, personaKey: string) => {
  await resetOutcomesFixtureScenarioState()
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${platformFixtureIds.outcomesEventId}/shortlist/actions/select-finalists`,
      {
        data: {
          orderedSubmissionIds: [
            platformFixtureIds.outcomesSubmissionTwoId,
            platformFixtureIds.outcomesSubmissionOneId
          ],
          finalistSubmissionIds: [
            platformFixtureIds.outcomesSubmissionTwoId,
            platformFixtureIds.outcomesSubmissionOneId
          ]
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

Then('the outcomes shortlist should save submission two as finalist one and submission one as finalist two', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: [
      {
        submissionId: platformFixtureIds.outcomesSubmissionTwoId,
        rank: 2,
        isPitchFinalist: true,
        pitchFinalistRank: 1
      },
      {
        submissionId: platformFixtureIds.outcomesSubmissionOneId,
        rank: 1,
        isPitchFinalist: true,
        pitchFinalistRank: 2
      }
    ]
  })
})

Then('the outcomes shortlist should remain blind to team identity', async ({ page }) => {
  const payload = getScenarioState(page).json as {
    data?: Array<Record<string, unknown>>
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data?.[0]).not.toHaveProperty('teamId')
  expect(payload.data?.[0]).not.toHaveProperty('teamName')
})

When('the saved {string} session starts pitch review for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/start-pitch-review`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session starts pitch for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/start-pitch`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session completes pitch presentations for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    for (let index = 0; index < 3; index += 1) {
      const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/advance-pitch-presentation`)
      const state = getScenarioState(page)
      state.response = response
      state.json = await response.json()

      expect(response.ok()).toBe(true)
    }
  } finally {
    await apiClient.dispose()
  }
})

Then('the outcomes fixture event state should be {string}', async ({ page }, expectedState: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: platformFixtureIds.outcomesEventId,
      state: expectedState
    }
  })
})

When('the saved {string} session loads the active pitch assignments for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.outcomesEventId}/judging/assignments`)
    const json = await response.json() as {
      data?: ActivePitchAssignment[]
    }
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.pitchAssignments = (json.data ?? []).filter(assignment => assignment.reviewStage === 'pitch_review')
  } finally {
    await apiClient.dispose()
  }
})

Then('the outcomes fixture should expose two active pitch assignments for the saved judge session', async ({ page }) => {
  const state = getScenarioState(page)

  expect(state.response?.ok()).toBe(true)
  expect(state.pitchAssignments).toHaveLength(2)
  expect(state.pitchAssignments?.every(assignment =>
    assignment.reviewStage === 'pitch_review'
    && assignment.status === 'assigned'
    && assignment.judgeUserId === 'user_judge'
  )).toBe(true)
})

When('the saved {string} session completes the remembered outcomes pitch assignments with fixture scores', async ({ page }, personaKey: string) => {
  const state = getScenarioState(page)
  const assignments = state.pitchAssignments ?? []

  if (assignments.length !== 2) {
    throw new Error(`Expected two remembered pitch assignments, received ${assignments.length}.`)
  }

  const pitchScoresBySubmissionId: Record<string, { score: number, comment: string }> = {
    [platformFixtureIds.outcomesSubmissionOneId]: {
      score: 2,
      comment: 'Pitch needed a clearer close.'
    },
    [platformFixtureIds.outcomesSubmissionTwoId]: {
      score: 5,
      comment: 'Pitch landed with a clear live demo.'
    }
  }

  await signInAs(parsePersonaKey(personaKey), page)
  await page.goto('/account/events/e2e-outcomes-fixture-event?tab=judging')
  await expect(page.getByTestId(/^judge-assignment-card-/)).toHaveCount(2)
  await page.getByTestId(`judge-assignment-card-${assignments[0]!.id}`).click()
  const nextPitchVote = page.getByRole('link', { name: 'Start next pitch vote' })

  for (const [index, assignment] of assignments.entries()) {
    const vote = pitchScoresBySubmissionId[assignment.submissionId]!
    if (index === 1) await nextPitchVote.click()
    await expect(page).toHaveURL(url => url.searchParams.get('assignment') === assignment.id)

    const comment = page.getByLabel('Comment', { exact: true })
    const score = page.getByTestId(`judge-pitch-score-option-${vote.score}`)
    await comment.fill(vote.comment)
    await score.click()
    await expect(page.getByTestId('judge-assignment-status')).toContainText('In review')
    await expect(score).toHaveAttribute('aria-checked', 'true')
    await expect(comment).toHaveValue(vote.comment)

    const submitted = page.waitForResponse(response => response.url().endsWith(`/judging/assignments/${assignment.id}/actions/complete`))
    await page.getByTestId('judge-complete-review').click()
    const response = await submitted
    expect(response.ok()).toBe(true)
    expect((await response.json()).data).toMatchObject({ pitchScore: vote.score, pitchComment: vote.comment })
    await expect(page.getByTestId('judge-assignment-status')).toContainText('Completed')
  }
  await expect(nextPitchVote).toHaveCount(0)
  const [queueRead] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/account/events/e2e-outcomes-fixture-event/judging'),
    page.getByRole('link', { name: 'Back to judging queue', exact: true }).click()
  ])
  expect(queueRead.ok()).toBe(true)
  await expect(page.getByText('No active blind reviews for this event')).toBeVisible()
})

Then('the outcomes fixture should expose two remaining active pitch assignments', async ({ page }) => {
  const state = getScenarioState(page)

  expect(state.response?.ok()).toBe(true)
  expect(state.pitchAssignments).toHaveLength(2)
  expect(state.pitchAssignments?.every(assignment =>
    assignment.reviewStage === 'pitch_review'
    && assignment.status === 'assigned'
    && assignment.judgeUserId === 'user_backup_judge'
  )).toBe(true)
})

When('the saved {string} session starts final deliberation for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/start-final-deliberation`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session lists final deliberation for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.outcomesEventId}/final-deliberation`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the outcomes final deliberation should rank submission two first and submission one second by score', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      finalRankingSubmissionIds: [],
      entries: [
        {
          submissionId: platformFixtureIds.outcomesSubmissionTwoId,
          blindScore: 3.5,
          pitchScore: 5,
          scoreTotal: 3.95,
          scoreRank: 1,
          finalRank: 1
        },
        {
          submissionId: platformFixtureIds.outcomesSubmissionOneId,
          blindScore: 4.5,
          pitchScore: 2,
          scoreTotal: 3.75,
          scoreRank: 2,
          finalRank: 2
        }
      ]
    }
  })
})

When('the saved {string} session reorders the outcomes final ranking to prefer submission one', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/events/${platformFixtureIds.outcomesEventId}/final-deliberation/actions/reorder`,
      {
        data: {
          orderedSubmissionIds: [
            platformFixtureIds.outcomesSubmissionOneId,
            platformFixtureIds.outcomesSubmissionTwoId
          ]
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

Then('the outcomes final deliberation should rank submission one first and submission two second by final order', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      finalRankingSubmissionIds: [
        platformFixtureIds.outcomesSubmissionOneId,
        platformFixtureIds.outcomesSubmissionTwoId
      ],
      entries: [
        {
          submissionId: platformFixtureIds.outcomesSubmissionOneId,
          scoreRank: 2,
          finalRank: 1
        },
        {
          submissionId: platformFixtureIds.outcomesSubmissionTwoId,
          scoreRank: 1,
          finalRank: 2
        }
      ]
    }
  })
})

When('the saved {string} session announces winners for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/announce-winners`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session completes the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(`/api/events/${platformFixtureIds.outcomesEventId}/actions/complete`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

When('the saved {string} session lists winners for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.outcomesEventId}/winners`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the outcomes fixture winners should rank team one first and team two second', async ({ page }) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: [
      {
        teamId: 'team_outcomes_fixture_one',
        finalRank: 1
      },
      {
        teamId: 'team_outcomes_fixture_two',
        finalRank: 2
      }
    ]
  })
})

When('the saved {string} session lists pending prize redemptions for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get('/api/prize-redemptions/me')
    const json = await response.json() as {
      data?: Array<{
        id?: string
        teamId?: string | null
        prize?: {
          id?: string
        }
        event?: {
          id?: string
        }
      }>
    }
    const state = getScenarioState(page)
    state.response = response
    state.json = json
    state.redemptionId = json.data?.find(redemption =>
      redemption.event?.id === platformFixtureIds.outcomesEventId
      && redemption.teamId === 'team_outcomes_fixture_one'
      && redemption.prize?.id === platformFixtureIds.outcomesTeamRedemptionPrizeId
    )?.id
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered outcomes prize redemption should target team {string} and prize {string}', async ({ page }, teamId: string, prizeId: string) => {
  const payload = getScenarioState(page).json as {
    data?: Array<{
      id?: string
      teamId?: string | null
      status?: string
      prize?: {
        id?: string
      }
      event?: {
        id?: string
      }
    }>
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).redemptionId).toBeTruthy()
  expect(payload.data).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: getScenarioState(page).redemptionId,
      teamId,
      status: 'pending',
      prize: expect.objectContaining({
        id: prizeId
      }),
      event: expect.objectContaining({
        id: platformFixtureIds.outcomesEventId
      })
    })
  ]))
})

When('the saved {string} session redeems the remembered outcomes prize redemption as {string}', async ({ page }, personaKey: string, legalName: string) => {
  const state = getScenarioState(page)

  if (!state.redemptionId) {
    throw new Error('No remembered outcomes redemption is available to redeem.')
  }

  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.post(
      `/api/prize-redemptions/${state.redemptionId}/actions/redeem`,
      {
        data: {
          legalName,
          winnerTermsDocumentId: platformFixtureIds.outcomesWinnerTermsDocumentId
        }
      }
    )
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the remembered outcomes prize redemption should be redeemed by {string}', async ({ page }, userId: string) => {
  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      id: getScenarioState(page).redemptionId,
      status: 'redeemed',
      userId
    }
  })
})

Then('the redeemed outcomes prize redemption should accept the current outcomes winner terms document', async ({ page }) => {
  expect(getScenarioState(page).json).toMatchObject({
    data: {
      winnerTermsDocumentId: platformFixtureIds.outcomesWinnerTermsDocumentId
    }
  })
})

When('the saved {string} session lists audit logs for the outcomes fixture event', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get(`/api/events/${platformFixtureIds.outcomesEventId}/audit`)
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the outcomes fixture event audit should include actions {string}', async ({ page }, actions: string) => {
  const payload = getScenarioState(page).json as {
    data?: Array<{
      action?: string
    }>
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data).toEqual(expect.arrayContaining(
    parseAuditActions(actions).map(action => expect.objectContaining({ action }))
  ))
})

When('the saved {string} session lists platform audit logs', async ({ page }, personaKey: string) => {
  const apiClient = await createAuthenticatedApiClient(parsePersonaKey(personaKey))

  try {
    const response = await apiClient.get('/api/audit')
    const state = getScenarioState(page)
    state.response = response
    state.json = await response.json()
  } finally {
    await apiClient.dispose()
  }
})

Then('the platform audit should include actions {string}', async ({ page }, actions: string) => {
  const payload = getScenarioState(page).json as {
    data?: Array<{
      action?: string
    }>
  }

  expect(getScenarioState(page).response?.ok()).toBe(true)
  expect(payload.data).toEqual(expect.arrayContaining(
    parseAuditActions(actions).map(action => expect.objectContaining({ action }))
  ))
})
