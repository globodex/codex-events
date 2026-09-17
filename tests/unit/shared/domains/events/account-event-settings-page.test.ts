import { describe, expect, test } from 'vitest'

import { accountEventSettingsPageSchema } from '../../../../../shared/domains/events/account-event-settings-page'

describe('account-event-settings page contract', () => {
  test('requires an absolute HTTP or HTTPS redemption URL', () => {
    const schema = accountEventSettingsPageSchema.shape.simplifiedClaiming.shape.redemptionUrl
    expect(schema.safeParse('https://events.example.com/events/meetup/redeem').success).toBe(true)
    expect(schema.safeParse('http://localhost:3100/events/meetup/redeem').success).toBe(true)
    expect(schema.safeParse('/events/meetup/redeem').success).toBe(false)
    expect(schema.safeParse('javascript:alert(1)').success).toBe(false)
  })

  test('keeps the page-shaped payload concrete and bounded', () => {
    expect(Object.keys(accountEventSettingsPageSchema.shape)).toEqual([
      'event',
      'criteria',
      'prizes',
      'terms',
      'roles',
      'credits',
      'simplifiedClaiming',
      'talkProposals',
      'builder'
    ])
    expect(Object.keys(accountEventSettingsPageSchema.shape.terms.shape)).toEqual([
      'application',
      'winner'
    ])
    expect(Object.keys(accountEventSettingsPageSchema.shape.roles.shape)).toEqual([
      'assignments',
      'counts'
    ])
    expect(Object.keys(accountEventSettingsPageSchema.shape.builder.shape)).toEqual([
      'creationFlow',
      'agendaBlockCount',
      'typedAgendaBlockCount',
      'balanceScore',
      'balanceBreakdown'
    ])
  })

  test('includes bounded regular credit inventory for builder management', () => {
    const offerSchema = accountEventSettingsPageSchema.shape.credits.element

    expect(offerSchema.safeParse({
      id: 'offer-1',
      eventId: 'event-1',
      name: 'OpenAI credits',
      description: 'Claim one code.',
      displayOrder: 0,
      createdAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z',
      availableCount: 1,
      claimedCount: 0,
      totalCount: 1
    }).success).toBe(true)
  })

  test('does not make version metadata a second content payload', () => {
    const versionSchema = accountEventSettingsPageSchema.shape.terms.shape.application.shape.versions.element

    expect(versionSchema.safeParse({
      id: 'terms-v1',
      eventId: 'event-1',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms v1',
      publishedAt: '2026-08-19T12:00:00.000Z',
      createdAt: '2026-08-19T12:00:00.000Z'
    }).success).toBe(true)
    expect(versionSchema.safeParse({
      id: 'terms-v1',
      eventId: 'event-1',
      documentType: 'application_terms',
      version: 1,
      title: 'Application Terms v1',
      content: 'This belongs only to the current document.',
      publishedAt: '2026-08-19T12:00:00.000Z',
      createdAt: '2026-08-19T12:00:00.000Z'
    }).data).not.toHaveProperty('content')
  })
})
