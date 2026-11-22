import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

import { accountEventEntryPageRoute } from '../../../../../server/domains/events/account-event-entry-page'
import { accountEventPrizesPageRoute } from '../../../../../server/domains/events/account-event-prizes-page'

const entrySource = readFileSync(
  new URL('../../../../../server/domains/events/account-event-entry-page.ts', import.meta.url),
  'utf8'
)
const prizesSource = readFileSync(
  new URL('../../../../../server/domains/events/account-event-prizes-page.ts', import.meta.url),
  'utf8'
)

describe('account-event entry/prizes server assemblers', () => {
  test('register named concrete page routes through the shared boundary', () => {
    expect(accountEventEntryPageRoute.page).toBe('entry')
    expect(accountEventPrizesPageRoute.page).toBe('prizes')
    expect(accountEventEntryPageRoute.schema).toBeDefined()
    expect(accountEventPrizesPageRoute.schema).toBeDefined()
  })

  test('does not resolve request context twice or call an internal HTTP route', () => {
    for (const source of [entrySource, prizesSource]) {
      expect(source).not.toContain('getRequestActor')
      expect(source).not.toContain('getDatabase(')
      expect(source).not.toContain('resolveEventAuthorization(')
      expect(source).not.toContain('apiFetch(')
      expect(source).not.toContain('$fetch(')
      expect(source).not.toContain('/api/events/')
      expect(source).not.toContain('inArray(')
    }
    expect(entrySource).toContain('context.database')
    expect(entrySource).toContain('context.authorization')
    expect(prizesSource).toContain('context.database')
  })

  test('keeps authorization and visibility decisions server-owned', () => {
    expect(entrySource).toContain('context.authorization.canViewParticipantsAndTeams')
    expect(entrySource).toContain('getEventCreditClaimAccess({')
    expect(prizesSource).toContain('assertCompetitionEvent(context.event)')
    expect(entrySource).not.toContain('capabilities')
    expect(prizesSource).not.toContain('capabilities')
  })
})
