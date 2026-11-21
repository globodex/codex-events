import { describe, expect, test } from 'vitest'

import {
  countAdminOverviewEventsByTab,
  getAdminOverviewEventStartsAt,
  getAdminOverviewTabForEvent
} from '../../../../../app/domains/events/admin-overview'

function createEvent(overrides: Partial<{
  agendaItems: Array<{ startsAt: string }>
  state: 'draft' | 'registration_open' | 'submission_open' | 'judging_preparation' | 'blind_review' | 'shortlist' | 'pitch' | 'pitch_review' | 'final_deliberation' | 'winners_announced' | 'completed'
  submissionOpensAt: string
}> = {}) {
  return {
    agendaItems: [],
    state: 'registration_open' as const,
    submissionOpensAt: '2026-05-20T10:00:00.000Z',
    ...overrides
  }
}

describe('admin overview event helpers', () => {
  test('derives the start time from the earliest agenda item before submission opens', () => {
    expect(getAdminOverviewEventStartsAt(createEvent({
      submissionOpensAt: '2026-05-20T10:00:00.000Z',
      agendaItems: [
        { startsAt: '2026-05-18T09:00:00.000Z' },
        { startsAt: '2026-05-22T09:00:00.000Z' }
      ]
    }))).toBe('2026-05-18T09:00:00.000Z')
  })

  test('classifies completed events as past and future-starting non-registration events as upcoming', () => {
    expect(getAdminOverviewTabForEvent(createEvent({
      state: 'completed',
      submissionOpensAt: '2026-08-01T10:00:00.000Z'
    }), Date.parse('2026-04-01T00:00:00.000Z'))).toBe('past')

    expect(getAdminOverviewTabForEvent(createEvent({
      state: 'submission_open',
      submissionOpensAt: '2026-08-01T10:00:00.000Z'
    }), Date.parse('2026-04-01T00:00:00.000Z'))).toBe('upcoming')
  })

  test('counts events across active upcoming and past tabs', () => {
    expect(countAdminOverviewEventsByTab([
      createEvent({
        state: 'registration_open',
        submissionOpensAt: '2026-08-01T10:00:00.000Z'
      }),
      createEvent({
        state: 'draft',
        submissionOpensAt: '2026-02-10T10:00:00.000Z'
      }),
      createEvent({
        state: 'blind_review',
        submissionOpensAt: '2026-06-01T10:00:00.000Z'
      }),
      createEvent({
        state: 'completed',
        submissionOpensAt: '2026-01-10T10:00:00.000Z'
      })
    ], Date.parse('2026-04-01T00:00:00.000Z'))).toEqual({
      active: 1,
      upcoming: 2,
      past: 1
    })
  })
})
