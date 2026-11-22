import { describe, expect, test } from 'vitest'

import type {
  EventParticipationApplicationSummary,
  EventParticipationRecord
} from '../../../../../app/domains/events/participation'

import {
  formatParticipationStatusLabel,
  getParticipationStatusColor
} from '../../../../../app/domains/events/participation'

function buildApplication(
  overrides: Partial<EventParticipationApplicationSummary> = {}
): EventParticipationApplicationSummary {
  return {
    id: 'application-1',
    userId: 'user-1',
    status: 'submitted',
    lumaSyncStatus: null,
    submittedAt: '2026-03-09T09:00:00Z',
    withdrawnAt: null,
    reviewedAt: null,
    checkedInAt: null,
    isCheckedIn: false,
    certificateHiddenAt: null,
    certificateRevokedAt: null,
    selectedTrackId: null,
    updatedAt: '2026-03-10T09:00:00Z',
    ...overrides
  }
}

function buildRecord(
  overrides: Partial<EventParticipationRecord> = {}
): EventParticipationRecord {
  return {
    event: {
      id: 'event-vienna',
      eventType: 'hackathon',
      name: 'Codex Community Event - Vienna',
      slug: 'vienna',
      city: 'Vienna',
      country: 'Austria',
      state: 'registration_open',
      startsAt: '2026-03-28T09:00:00Z',
      registrationOpensAt: '2026-03-01T09:00:00Z',
      registrationClosesAt: '2026-03-15T09:00:00Z',
      submissionClosesAt: '2026-04-18T18:00:00Z',
      maxTeamMembers: 4
    },
    isPast: false,
    lastActivityAt: '2026-03-10T09:00:00Z',
    application: buildApplication(),
    activeTeam: null,
    latestTeam: null,
    latestSubmission: null,
    outcome: null,
    ...overrides
  }
}

describe('event participation badge helpers', () => {
  test('uses pending review when review is still outstanding', () => {
    const record = buildRecord()

    expect(formatParticipationStatusLabel(record)).toBe('Pending review')
    expect(getParticipationStatusColor(record)).toBe('warning')
  })

  test('uses approved when the application was accepted', () => {
    const record = buildRecord({
      application: buildApplication({
        status: 'approved',
        reviewedAt: '2026-03-12T09:00:00Z',
        updatedAt: '2026-03-12T09:00:00Z'
      })
    })

    expect(formatParticipationStatusLabel(record)).toBe('Approved')
    expect(getParticipationStatusColor(record)).toBe('success')
  })

  test('uses not approved when the application was rejected', () => {
    const record = buildRecord({
      application: buildApplication({
        status: 'rejected',
        reviewedAt: '2026-03-12T09:00:00Z',
        updatedAt: '2026-03-12T09:00:00Z'
      })
    })

    expect(formatParticipationStatusLabel(record)).toBe('Not approved')
    expect(getParticipationStatusColor(record)).toBe('error')
  })

  test('falls back to project state labels when no application record is available', () => {
    const record = buildRecord({
      application: null,
      latestSubmission: {
        id: 'submission-1',
        teamId: 'team-1',
        status: 'submitted',
        projectName: 'Project',
        summary: null,
        repositoryUrl: null,
        demoUrl: null,
        submittedAt: '2026-03-20T09:00:00Z',
        lockedAt: null,
        withdrawnAt: null,
        disqualifiedAt: null,
        createdAt: '2026-03-18T09:00:00Z',
        updatedAt: '2026-03-20T09:00:00Z'
      }
    })

    expect(formatParticipationStatusLabel(record)).toBe('Project submitted')
    expect(getParticipationStatusColor(record)).toBe('primary')
  })
})
