import { describe, expect, test } from 'vitest'

import { prunePitchPresentationProgress } from '../../../../../server/domains/judging'

function createEvent(
  state: 'submission_open' | 'judging_preparation' | 'blind_review' | 'shortlist' | 'pitch' | 'pitch_review',
  blindReviewCount: 0 | 1 | 2 = 1,
  pitchReviewEnabled: boolean = blindReviewCount === 0,
  overrides: Partial<{
    pitchFinalistSubmissionIdsJson: string
    activePitchPresentationSubmissionId: string | null
    pitchPresentationsCompletedAt: string | null
  }> = {}
) {
  return {
    id: 'event_1',
    eventType: 'hackathon',
    name: 'Judging Event',
    slug: 'judging-event',
    description: 'Judging Event',
    discordServerUrl: null,
    city: 'Vienna',
    country: 'Austria',
    address: 'Fixture Address',
    registrationOpensAt: '2026-03-20T12:00:00.000Z',
    registrationClosesAt: '2026-03-23T12:00:00.000Z',
    submissionOpensAt: '2026-03-23T12:00:00.000Z',
    submissionClosesAt: '2026-03-25T12:00:00.000Z',
    state,
    blindReviewCount,
    pitchReviewEnabled,
    blindScoreWeightPercent: blindReviewCount === 0 ? 0 : 70,
    pitchScoreWeightPercent: pitchReviewEnabled ? (blindReviewCount === 0 ? 100 : 30) : 0,
    shortlistFinalistCount: 10,
    pitchFinalistSubmissionIdsJson: '[]',
    activePitchPresentationSubmissionId: null,
    pitchPresentationsCompletedAt: null,
    finalRankingSubmissionIdsJson: '[]',
    maxTeamMembers: 4,
    requireXProfile: false,
    requireLinkedinProfile: false,
    requireGithubProfile: false,
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    createdByUserId: 'platform_admin',
    createdAt: '2026-03-20T12:00:00.000Z',
    updatedAt: '2026-03-20T12:00:00.000Z',
    ...overrides
  }
}

describe('judging utilities', () => {
  test('pruning the active pitch presenter advances to the next lineup entry', () => {
    expect(prunePitchPresentationProgress(
      createEvent('pitch', 0, true, {
        pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_1', 'submission_2']),
        activePitchPresentationSubmissionId: 'submission_1'
      }),
      ['submission_1', 'submission_2'],
      ['submission_2'],
      'submission_1',
      '2026-03-26T12:25:00.000Z'
    )).toEqual({
      activePitchPresentationSubmissionId: 'submission_2',
      pitchPresentationsCompletedAt: null
    })

    expect(prunePitchPresentationProgress(
      createEvent('pitch', 0, true, {
        pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_1']),
        activePitchPresentationSubmissionId: 'submission_1'
      }),
      ['submission_1'],
      [],
      'submission_1',
      '2026-03-26T12:25:00.000Z'
    )).toEqual({
      activePitchPresentationSubmissionId: null,
      pitchPresentationsCompletedAt: '2026-03-26T12:25:00.000Z'
    })
  })
})
