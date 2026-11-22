import { describe, expect, test } from 'vitest'

import {
  formatTeamSubmissionStatus,
  getCreateSubmissionAvailability,
  getTeamSubmissionStatusColor,
  getSubmitSubmissionAvailability,
  getUpdateSubmissionPublicVisibilityAvailability,
  getUpdateSubmissionAvailability,
  getWithdrawSubmissionAvailability,
  type TeamSubmissionRecord
} from '../../../../../app/domains/submissions/team-submission'

function createSubmission(status: TeamSubmissionRecord['status']): TeamSubmissionRecord {
  return {
    id: 'submission_fixture',
    teamId: 'team_fixture',
    trackId: null,
    status,
    projectName: 'Launch Console',
    summary: 'Fixture summary',
    repositoryUrl: 'https://github.com/example/launch-console',
    demoUrl: 'https://example.com/launch-console',
    isPubliclyVisible: false,
    submittedAt: status === 'submitted' || status === 'locked' ? '2026-03-24T12:00:00.000Z' : null,
    lockedAt: status === 'locked' ? '2026-03-25T12:00:00.000Z' : null,
    withdrawnAt: status === 'withdrawn' ? '2026-03-24T14:00:00.000Z' : null,
    disqualifiedAt: status === 'disqualified' ? '2026-03-24T14:00:00.000Z' : null,
    createdAt: '2026-03-24T12:00:00.000Z',
    updatedAt: '2026-03-24T12:00:00.000Z'
  }
}

describe('team submission helpers', () => {
  test('allows creating the first draft only for team admins during submission_open', () => {
    expect(getCreateSubmissionAvailability({
      state: 'submission_open'
    }, null, true)).toEqual({
      isAllowed: true
    })

    expect(getCreateSubmissionAvailability({
      state: 'registration_open'
    }, null, true)).toEqual({
      isAllowed: false,
      reason: 'The first submission draft can be created only while submission is open.'
    })

    expect(getCreateSubmissionAvailability({
      state: 'submission_open'
    }, null, false)).toEqual({
      isAllowed: false,
      reason: 'Only team admins can manage the project submission.'
    })
  })

  test('keeps existing submissions mutable during judging preparation until locking begins', () => {
    expect(getUpdateSubmissionAvailability({
      state: 'submission_open'
    }, createSubmission('draft'), true)).toEqual({
      isAllowed: true
    })

    expect(getUpdateSubmissionAvailability({
      state: 'submission_open'
    }, createSubmission('submitted'), true)).toEqual({
      isAllowed: true
    })

    expect(getUpdateSubmissionAvailability({
      state: 'judging_preparation'
    }, createSubmission('submitted'), true)).toEqual({
      isAllowed: true
    })

    expect(getSubmitSubmissionAvailability({
      state: 'submission_open'
    }, createSubmission('draft'), true)).toEqual({
      isAllowed: true
    })

    expect(getSubmitSubmissionAvailability({
      state: 'judging_preparation'
    }, createSubmission('draft'), true)).toEqual({
      isAllowed: true
    })

    expect(getSubmitSubmissionAvailability({
      state: 'submission_open'
    }, createSubmission('submitted'), true)).toEqual({
      isAllowed: false,
      reason: 'This project is already submitted.'
    })

    expect(getWithdrawSubmissionAvailability({
      state: 'judging_preparation'
    }, createSubmission('submitted'), true)).toEqual({
      isAllowed: true
    })

    expect(getWithdrawSubmissionAvailability({
      state: 'submission_open'
    }, createSubmission('submitted'), true)).toEqual({
      isAllowed: true
    })

    expect(getWithdrawSubmissionAvailability({
      state: 'blind_review'
    }, createSubmission('locked'), true)).toEqual({
      isAllowed: false,
      reason: 'Submissions can be withdrawn only until judging starts.'
    })
  })

  test('shows the participant submission status label and color', () => {
    expect(formatTeamSubmissionStatus('none')).toBe('No submission')
    expect(formatTeamSubmissionStatus('withdrawn')).toBe('Withdrawn')
    expect(getTeamSubmissionStatusColor('submitted')).toBe('primary')
    expect(getTeamSubmissionStatusColor('disqualified')).toBe('error')
  })

  test('allows public project publishing only for completed non-winning locked submissions managed by team admins', () => {
    expect(getUpdateSubmissionPublicVisibilityAvailability({
      state: 'completed'
    }, createSubmission('locked'), true, false)).toEqual({
      isAllowed: true
    })

    expect(getUpdateSubmissionPublicVisibilityAvailability({
      state: 'completed'
    }, createSubmission('locked'), true, true)).toEqual({
      isAllowed: false,
      reason: 'Winning projects are already published in the winners showcase.'
    })

    expect(getUpdateSubmissionPublicVisibilityAvailability({
      state: 'final_deliberation'
    }, createSubmission('locked'), true, false)).toEqual({
      isAllowed: false,
      reason: 'Project publishing is available only after the event is completed.'
    })

    expect(getUpdateSubmissionPublicVisibilityAvailability({
      state: 'completed'
    }, createSubmission('submitted'), true, false)).toEqual({
      isAllowed: false,
      reason: 'Only completed competition projects can be published publicly.'
    })
  })
})
