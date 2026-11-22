import { describe, expect, test } from 'vitest'

import {
  accountEventPageNames,
  accountEventPagePaths,
  buildAccountEventPageCacheKey,
  buildAccountEventPagePath,
  buildAccountJudgeAssignmentWorkspacePath
} from '../../../../../app/domains/events/account-workspace-page'

describe('account-event page contract boundary', () => {
  test('keeps the named page set and concrete REST paths aligned', () => {
    expect(accountEventPageNames).toEqual([
      'entry',
      'prizes',
      'operations',
      'submissions',
      'judging',
      'settings',
      'participants',
      'workspace',
      'teams',
      'rosters',
      'program',
      'gallery',
      'feedback',
      'certificates'
    ])

    for (const page of accountEventPageNames) {
      expect(accountEventPagePaths[page]).toBe(`/api/account/events/:slug/${page}`)
      expect(buildAccountEventPagePath('vienna-2026', page)).toBe(`/api/account/events/vienna-2026/${page}`)
    }
  })

  test('encodes the slug and keeps the cache key page-specific', () => {
    expect(buildAccountEventPagePath('event with spaces', 'entry')).toBe(
      '/api/account/events/event%20with%20spaces/entry'
    )
    expect(buildAccountEventPageCacheKey('fixture-event', 'entry')).not.toBe(
      buildAccountEventPageCacheKey('fixture-event', 'prizes')
    )
  })

  test('makes selected-team query state part of the typed teams request', () => {
    expect(buildAccountEventPagePath('fixture event', 'teams', {
      selectedTeamSlug: ' Team Alpha '
    })).toBe('/api/account/events/fixture%20event/teams?selectedTeamSlug=team%20alpha')
    expect(buildAccountEventPageCacheKey('fixture-event', 'teams', {
      selectedTeamSlug: 'team-a'
    })).not.toBe(buildAccountEventPageCacheKey('fixture-event', 'teams', {
      selectedTeamSlug: 'team-b'
    }))
    expect(buildAccountJudgeAssignmentWorkspacePath('fixture event', 'assignment/1')).toBe(
      '/api/account/events/fixture%20event/judging/assignments/assignment%2F1'
    )
  })

  test('makes the participant search text part of the typed participants request', () => {
    expect(buildAccountEventPagePath('fixture-event', 'participants', {
      participantSearch: ' Anna 100% a_b+c '
    })).toBe('/api/account/events/fixture-event/participants?participantSearch=Anna%20100%25%20a_b%2Bc')
    expect(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantSearch: 'anna'
    })).not.toBe(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantSearch: 'ben'
    }))
    expect(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantSearch: '   '
    })).toBe(buildAccountEventPageCacheKey('fixture-event', 'participants'))
    expect(buildAccountEventPagePath('fixture-event', 'teams', {
      participantSearch: 'anna'
    })).toBe('/api/account/events/fixture-event/teams')
  })

  test('makes a longer participant list part of the typed participants request', () => {
    expect(buildAccountEventPagePath('fixture-event', 'participants', {
      participantRows: 200
    })).toBe('/api/account/events/fixture-event/participants?participantRows=200')
    expect(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantRows: 200
    })).not.toBe(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantRows: 300
    }))
    // The first step is what the page lists without a value.
    expect(buildAccountEventPagePath('fixture-event', 'participants', {
      participantRows: 100
    })).toBe('/api/account/events/fixture-event/participants')
    expect(buildAccountEventPageCacheKey('fixture-event', 'participants', {
      participantRows: 100
    })).toBe(buildAccountEventPageCacheKey('fixture-event', 'participants'))
    expect(buildAccountEventPagePath('fixture-event', 'teams', {
      participantRows: 200
    })).toBe('/api/account/events/fixture-event/teams')
  })

  test('makes active admin configuration state part of the prizes contract only', () => {
    expect(buildAccountEventPagePath('fixture-event', 'entry', {
      includeAdminEventConfiguration: true
    })).toBe('/api/account/events/fixture-event/entry')
    expect(buildAccountEventPagePath('fixture-event', 'prizes', {
      includeAdminEventConfiguration: true
    })).toBe('/api/account/events/fixture-event/prizes?includeAdminEventConfiguration=true')
    expect(buildAccountEventPageCacheKey('fixture-event', 'entry', {
      includeAdminEventConfiguration: true
    })).toBe(buildAccountEventPageCacheKey('fixture-event', 'entry'))
    expect(buildAccountEventPagePath('fixture-event', 'settings', {
      includeAdminEventConfiguration: true
    })).toBe('/api/account/events/fixture-event/settings')
  })

  test('makes direct-link shell state part of the selected page path and cache key', () => {
    expect(buildAccountEventPagePath('fixture-event', 'operations', {
      includeEventShell: true
    })).toBe('/api/account/events/fixture-event/operations?includeEventShell=true')
    expect(buildAccountEventPageCacheKey('fixture-event', 'operations', {
      includeEventShell: true
    })).not.toBe(buildAccountEventPageCacheKey('fixture-event', 'operations'))
  })
})
