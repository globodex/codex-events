import { describe, expect, test } from 'vitest'

import { ApiError } from '../../../../../server/http/api-error'
import {
  assertEventSchedule,
  buildEventUpdatePayload,
  assertOpenRegistrationAllowed,
  assertOpenSubmissionAllowed,
  assertRoleCapabilityInvariant,
  computeEventBalanceColumns,
  createEventBodySchema,
  getPublicEventBySlugOrThrow,
  isEventRolePublishedInRoster,
  parseEventAgendaItems,
  parseEventBalanceBreakdown,
  serializeAccountEvent,
  serializeAdminEvent,
  serializeEvent,
  serializeEventAgendaItems,
  serializePublicEvent,
  serializePublishedEventRosterMember,
  updateEventBodySchema
} from '../../../../../server/domains/events'

function buildEventRecord(
  overrides: Partial<Parameters<typeof serializeEvent>[0]> = {}
): Parameters<typeof serializeEvent>[0] {
  return {
    id: 'event_1',
    eventType: 'hackathon',
    name: 'Fixture Event',
    slug: 'fixture-event',
    description: 'Fixture event',
    agendaItemsJson: '[]',
    backgroundImageUrl: null,
    backgroundImageObjectKey: null,
    backgroundImageRevision: 0,
    bannerImageUrl: null,
    bannerImageObjectKey: null,
    bannerImageRevision: 0,
    publicContentRevision: 0,
    discordServerUrl: null,
    lumaEventUrl: null,
    slidesUrl: null,
    lumaEventApiId: null,
    city: 'Vienna',
    country: 'Austria',
    address: 'Fixture Address',
    registrationOpensAt: '2026-03-20T12:00:00.000Z',
    registrationClosesAt: '2026-03-23T12:00:00.000Z',
    submissionOpensAt: '2026-03-23T12:00:00.000Z',
    submissionClosesAt: '2026-03-25T12:00:00.000Z',
    state: 'draft',
    blindReviewCount: 1,
    pitchReviewEnabled: false,
    blindScoreWeightPercent: 70,
    pitchScoreWeightPercent: 30,
    shortlistFinalistCount: 10,
    pitchFinalistSubmissionIdsJson: '[]',
    activePitchPresentationSubmissionId: null,
    pitchPresentationsCompletedAt: null,
    maxTeamMembers: 5,
    participantsLimit: null,
    autoApproveApplications: false,
    simplifiedClaimingEnabled: false,
    talkProposalsEnabled: false,
    talkProposalOpensAt: null,
    talkProposalClosesAt: null,
    talkProposalQuestionsJson: '[]',
    talkProposalQuestionsRevision: 0,
    inPersonEvent: false,
    applicationXProfileVisible: true,
    applicationLinkedinProfileVisible: true,
    applicationGithubProfileVisible: true,
    applicationChatgptEmailVisible: false,
    applicationOpenaiOrgIdVisible: false,
    applicationLumaEmailVisible: false,
    applicationWhyThisEventVisible: true,
    applicationProofOfExecutionVisible: true,
    applicationTeamIntentVisible: true,
    applicationAiKnowledgeVisible: false,
    requireXProfile: false,
    requireLinkedinProfile: false,
    requireGithubProfile: false,
    requireChatgptEmail: false,
    requireOpenaiOrgId: false,
    requireLumaEmail: false,
    requireWhyThisEvent: false,
    requireProofOfExecution: false,
    requireTeamIntent: false,
    requireAiKnowledge: false,
    requireSubmissionSummary: false,
    requireSubmissionRepositoryUrl: false,
    requireSubmissionDemoUrl: false,
    currentApplicationTermsDocumentId: null,
    currentWinnerTermsDocumentId: null,
    creationFlow: 'classic',
    balanceScore: null,
    balanceBreakdownJson: null,
    createdByUserId: 'creator_1',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-20T10:00:00.000Z',
    ...overrides
  }
}

const builderAgendaItemsJson = JSON.stringify([
  {
    id: 'agenda_1',
    startsAt: '2026-03-24T09:00:00.000Z',
    endsAt: '2026-03-24T09:30:00.000Z',
    title: 'Opening Talk',
    details: null,
    displayOrder: 0,
    builderBlockType: 'talk'
  },
  {
    id: 'agenda_2',
    startsAt: '2026-03-24T09:30:00.000Z',
    endsAt: '2026-03-24T10:15:00.000Z',
    title: 'Networking',
    details: null,
    displayOrder: 1,
    builderBlockType: 'networking'
  }
])

function collectDrizzleParamValues(node: unknown, values: string[] = []) {
  if (!node || typeof node !== 'object') {
    return values
  }

  if (Array.isArray(node)) {
    node.forEach(item => collectDrizzleParamValues(item, values))
    return values
  }

  const sqlNode = node as {
    constructor?: { name?: string }
    queryChunks?: unknown[]
    value?: unknown
  }

  if (sqlNode.constructor?.name === 'Param' && typeof sqlNode.value === 'string') {
    values.push(sqlNode.value)
    return values
  }

  if (Array.isArray(sqlNode.queryChunks)) {
    collectDrizzleParamValues(sqlNode.queryChunks, values)
  }

  return values
}

describe('event management utilities', () => {
  test('enforces canonical role capability combinations', () => {
    expect(() => assertRoleCapabilityInvariant('judge', {
      isInJudgePool: false,
      isStaff: false
    })).toThrowError(ApiError)
    expect(() => assertRoleCapabilityInvariant('judge', {
      isInJudgePool: true,
      isStaff: false
    })).not.toThrow()

    expect(() => assertRoleCapabilityInvariant('staff', {
      isInJudgePool: false,
      isStaff: false
    })).toThrowError(ApiError)
    expect(() => assertRoleCapabilityInvariant('staff', {
      isInJudgePool: false,
      isStaff: true
    })).not.toThrow()

    expect(() => assertRoleCapabilityInvariant('event_admin', {
      isInJudgePool: false,
      isStaff: false
    })).not.toThrow()
    expect(() => assertRoleCapabilityInvariant('event_admin', {
      isInJudgePool: true,
      isStaff: true
    })).not.toThrow()
  })

  test('validates canonical event schedule ordering', () => {
    expect(() => assertEventSchedule({
      eventType: 'hackathon',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z'
    })).not.toThrow()

    expect(() => assertEventSchedule({
      eventType: 'hackathon',
      registrationOpensAt: '2026-03-24T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z'
    })).toThrowError(ApiError)
  })

  test('allows registration-only event schedules without submission windows', () => {
    expect(() => assertEventSchedule({
      eventType: 'meetup',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z'
    })).not.toThrow()
  })

  test('allows opening submission only after registration closes and while the submission window is open', () => {
    const now = new Date('2026-03-23T13:00:00.000Z')

    expect(() => assertOpenSubmissionAllowed({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItemsJson: '[]',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      discordServerUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      talkProposalsEnabled: false,
      talkProposalOpensAt: null,
      talkProposalClosesAt: null,
      talkProposalQuestionsJson: '[]',
      talkProposalQuestionsRevision: 0,
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: false,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, now)).not.toThrow()

    expect(() => assertOpenSubmissionAllowed({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItemsJson: '[]',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      discordServerUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-24T12:00:00.000Z',
      submissionOpensAt: '2026-03-24T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: false,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, now)).toThrowError(ApiError)
  })

  test('allows opening registration only from draft while the registration window is active', () => {
    const now = new Date('2026-03-21T13:00:00.000Z')

    expect(() => assertOpenRegistrationAllowed({
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItemsJson: '[]',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      discordServerUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'draft',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, now)).not.toThrow()

    expect(() => assertOpenRegistrationAllowed({
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItemsJson: '[]',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      discordServerUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-24T12:00:00.000Z',
      registrationClosesAt: '2026-03-25T12:00:00.000Z',
      submissionOpensAt: '2026-03-25T12:00:00.000Z',
      submissionClosesAt: '2026-03-27T12:00:00.000Z',
      state: 'draft',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, now)).toThrowError(ApiError)
  })

  test('builds partial event updates from agenda-only patch bodies', () => {
    const patch = buildEventUpdatePayload({
      id: 'event_1',
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItemsJson: '[]',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      discordServerUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      talkProposalsEnabled: false,
      talkProposalOpensAt: null,
      talkProposalClosesAt: null,
      talkProposalQuestionsJson: '[]',
      talkProposalQuestionsRevision: 0,
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, {
      agendaItems: [
        {
          id: 'agenda_item_1',
          startsAt: '2026-03-24T09:00:00.000Z',
          endsAt: '2026-03-24T10:00:00.000Z',
          title: 'Kickoff',
          details: 'Welcome and orientation.',
          displayOrder: 1
        }
      ]
    })

    expect(patch).toMatchObject({
      agendaItemsJson: JSON.stringify([
        {
          id: 'agenda_item_1',
          startsAt: '2026-03-24T09:00:00.000Z',
          endsAt: '2026-03-24T10:00:00.000Z',
          title: 'Kickoff',
          details: 'Welcome and orientation.',
          displayOrder: 1
        }
      ])
    })
    expect(patch).not.toHaveProperty('agendaItems')
    expect(patch).not.toHaveProperty('name')
    expect(typeof patch.updatedAt).toBe('string')
  })

  test('parses configurable judging fields in create and update request schemas', () => {
    expect(createEventBodySchema.parse({
      eventType: 'hackathon',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItems: [],
      tracks: [],
      discordServerUrl: 'https://discord.gg/codex',
      slidesUrl: 'https://example.com/slides',
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      blindReviewCount: '2',
      pitchReviewEnabled: 'true',
      blindScoreWeightPercent: '60',
      pitchScoreWeightPercent: '40',
      shortlistFinalistCount: '12'
    })).toMatchObject({
      eventType: 'hackathon',
      discordServerUrl: 'https://discord.gg/codex',
      slidesUrl: 'https://example.com/slides',
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      shortlistFinalistCount: 12
    })

    expect(updateEventBodySchema.parse({
      discordServerUrl: 'https://discord.gg/codex',
      slidesUrl: 'https://example.com/slides',
      blindReviewCount: '0',
      pitchReviewEnabled: false,
      blindScoreWeightPercent: '100',
      pitchScoreWeightPercent: '0',
      shortlistFinalistCount: '8'
    })).toMatchObject({
      discordServerUrl: 'https://discord.gg/codex',
      slidesUrl: 'https://example.com/slides',
      blindReviewCount: 0,
      pitchReviewEnabled: false,
      blindScoreWeightPercent: 100,
      pitchScoreWeightPercent: 0,
      shortlistFinalistCount: 8
    })
  })

  test('generic event updates do not accept managed image mutations', () => {
    const parsed = updateEventBodySchema.parse({
      slug: 'renamed-event',
      backgroundImageUrl: 'http://localhost/api/public/events/another-event/images/background',
      bannerImageUrl: 'http://localhost/api/public/events/another-event/images/banner'
    })
    const patch = buildEventUpdatePayload(buildEventRecord({
      backgroundImageUrl: 'http://localhost/api/public/events/fixture-event/images/background',
      backgroundImageObjectKey: 'events/event_1/background/current-object',
      backgroundImageRevision: 4,
      bannerImageUrl: 'http://localhost/api/public/events/fixture-event/images/banner',
      bannerImageObjectKey: 'events/event_1/banner/current-object',
      bannerImageRevision: 3
    }), parsed)

    expect(parsed).toEqual({ slug: 'renamed-event' })
    expect(patch).not.toHaveProperty('backgroundImageUrl')
    expect(patch).not.toHaveProperty('bannerImageUrl')
    expect(patch).not.toHaveProperty('backgroundImageObjectKey')
    expect(patch).not.toHaveProperty('bannerImageObjectKey')
    expect(patch).not.toHaveProperty('backgroundImageRevision')
    expect(patch).not.toHaveProperty('bannerImageRevision')
    expect(patch.publicContentRevision).toBeDefined()
  })

  test('does not materialize create defaults in update request schemas', () => {
    const patch = updateEventBodySchema.parse({
      address: 'Updated Address'
    })

    expect(patch).toEqual({
      address: 'Updated Address'
    })
    expect(patch).not.toHaveProperty('tracks')
    expect(patch).not.toHaveProperty('participantsLimit')
    expect(patch).not.toHaveProperty('maxTeamMembers')
    expect(patch).not.toHaveProperty('autoApproveApplications')
    expect(patch).not.toHaveProperty('inPersonEvent')
    expect(patch).not.toHaveProperty('requireChatgptEmail')
  })

  test('accepts meetup creation without hackathon-only submission fields', () => {
    expect(createEventBodySchema.parse({
      eventType: 'meetup',
      name: 'Fixture Meetup',
      slug: 'fixture-meetup',
      description: 'Fixture meetup',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z'
    })).toMatchObject({
      eventType: 'meetup',
      tracks: []
    })
  })

  test('accepts simplified claiming only for compatible Meetups', () => {
    expect(createEventBodySchema.parse({
      eventType: 'meetup',
      name: 'Fixture Meetup',
      slug: 'fixture-meetup',
      description: 'Fixture meetup',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      simplifiedClaimingEnabled: true
    })).toMatchObject({ simplifiedClaimingEnabled: true })

    expect(() => createEventBodySchema.parse({
      eventType: 'build',
      name: 'Fixture Build',
      slug: 'fixture-build',
      description: 'Fixture build',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      simplifiedClaimingEnabled: true
    })).toThrow('Simplified claiming is available only for Meetup events.')

    expect(updateEventBodySchema.parse({
      simplifiedClaimingEnabled: true
    })).toEqual({ simplifiedClaimingEnabled: true })
  })

  test('rejects required fields, incomplete Luma credentials, and terms while simplified claiming is enabled', () => {
    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup',
      submissionOpensAt: null,
      submissionClosesAt: null,
      simplifiedClaimingEnabled: true,
      applicationChatgptEmailVisible: true,
      requireChatgptEmail: true
    }), {})).toThrow('Remove required registration fields before enabling simplified claiming.')

    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup',
      submissionOpensAt: null,
      submissionClosesAt: null,
      simplifiedClaimingEnabled: true,
      lumaEventApiId: 'evt-123'
    }), {})).toThrow('Enter both the Luma event ID and API key to connect Luma.')

    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup',
      submissionOpensAt: null,
      submissionClosesAt: null,
      simplifiedClaimingEnabled: true,
      currentApplicationTermsDocumentId: 'terms-1'
    }), {})).toThrow('Remove the application terms before enabling simplified claiming.')
  })

  test('allows paired Luma credentials with simplified claiming', () => {
    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup', submissionOpensAt: null, submissionClosesAt: null,
      simplifiedClaimingEnabled: true, lumaEventApiId: 'evt-123', lumaApiKey: 'secret'
    }), {})).not.toThrow()
  })

  test('requires event type on creation', () => {
    expect(() => createEventBodySchema.parse({
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z'
    })).toThrow()
  })

  test('rejects competition configuration patches on registration-only events', () => {
    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup'
    }), {
      tracks: [{
        id: 'track_1',
        name: 'Track',
        shortDescription: 'Track description',
        resources: [],
        displayOrder: 1
      }]
    })).toThrowError(ApiError)
  })

  test('accepts track configuration patches on build events', () => {
    const patch = buildEventUpdatePayload(buildEventRecord({
      eventType: 'build'
    }), {
      tracks: [{
        id: 'track_1',
        name: 'Track',
        shortDescription: 'Track description',
        resources: [{
          id: 'resource_1',
          title: 'Starter guide',
          url: 'https://example.com/guide',
          description: null,
          displayOrder: 1
        }],
        displayOrder: 1
      }]
    })

    expect(patch).not.toHaveProperty('tracks')
  })

  test('allows common application requirement patches on registration-only events', () => {
    expect(buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup'
    }), {
      autoApproveApplications: true,
      inPersonEvent: true,
      applicationChatgptEmailVisible: true,
      applicationOpenaiOrgIdVisible: true,
      applicationLumaEmailVisible: true,
      applicationAiKnowledgeVisible: true,
      requireChatgptEmail: true,
      requireOpenaiOrgId: true,
      requireLumaEmail: true,
      requireWhyThisEvent: true,
      requireProofOfExecution: true,
      requireAiKnowledge: true
    })).toMatchObject({
      autoApproveApplications: true,
      inPersonEvent: true,
      applicationChatgptEmailVisible: true,
      applicationOpenaiOrgIdVisible: true,
      applicationLumaEmailVisible: true,
      applicationAiKnowledgeVisible: true,
      requireChatgptEmail: true,
      requireOpenaiOrgId: true,
      requireLumaEmail: true,
      requireWhyThisEvent: true,
      requireProofOfExecution: true,
      requireAiKnowledge: true
    })
  })

  test('rejects required application fields hidden from the application form', () => {
    expect(() => buildEventUpdatePayload(buildEventRecord(), {
      applicationProofOfExecutionVisible: false,
      requireProofOfExecution: true
    })).toThrowError(ApiError)
    expect(() => buildEventUpdatePayload(buildEventRecord(), {
      applicationAiKnowledgeVisible: false,
      requireAiKnowledge: true
    })).toThrowError(ApiError)
  })

  test('allows participant limit patches on registration-only events', () => {
    expect(buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup'
    }), {
      participantsLimit: 80
    })).toMatchObject({
      participantsLimit: 80
    })
  })

  test('ignores scalar competition fields on registration-only event patches', () => {
    const event = buildEventRecord({
      eventType: 'meetup',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-23T12:00:01.000Z',
      maxTeamMembers: 5,
      blindReviewCount: 1,
      pitchReviewEnabled: false,
      blindScoreWeightPercent: 70,
      pitchScoreWeightPercent: 30,
      shortlistFinalistCount: 10,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false
    })

    const patch = buildEventUpdatePayload(event, {
      participantsLimit: 80,
      tracks: [],
      submissionOpensAt: '2026-03-24T12:00:00.000Z',
      submissionClosesAt: '2026-03-24T12:00:01.000Z',
      maxTeamMembers: 1,
      blindReviewCount: event.blindReviewCount,
      pitchReviewEnabled: event.pitchReviewEnabled,
      blindScoreWeightPercent: 100,
      pitchScoreWeightPercent: 0,
      shortlistFinalistCount: 1,
      requireSubmissionSummary: true,
      requireSubmissionRepositoryUrl: true,
      requireSubmissionDemoUrl: true
    })

    expect(patch).toMatchObject({
      participantsLimit: 80
    })
    expect(patch).not.toHaveProperty('tracks')
    expect(patch).not.toHaveProperty('maxTeamMembers')
    expect(patch).not.toHaveProperty('blindReviewCount')
    expect(patch).not.toHaveProperty('requireSubmissionSummary')
  })

  test('rejects non-empty tracks on registration-only event patches', () => {
    expect(() => buildEventUpdatePayload(buildEventRecord({
      eventType: 'meetup',
      maxTeamMembers: 1
    }), {
      participantsLimit: 80,
      tracks: [{
        id: 'track_1',
        name: 'Track',
        shortDescription: 'Track description',
        resources: [],
        displayOrder: 1
      }]
    })).toThrowError(ApiError)
  })

  test('serializes track guidelines internally and keeps public tracks short-only by default', () => {
    const tracks = [{
      id: 'track_1',
      eventId: 'event_1',
      name: 'Agents',
      shortDescription: 'Build with agents.',
      fullDescription: 'Read the full track guidelines.',
      staffInstructions: 'Help participants find the right starter guide.',
      resourcesJson: JSON.stringify([{
        id: 'resource_1',
        title: 'Starter guide',
        url: 'https://example.com/guide',
        description: 'Read this before the event.',
        displayOrder: 1
      }]),
      displayOrder: 1,
      createdAt: '2026-03-20T10:00:00.000Z'
    }]

    expect(serializeEvent(buildEventRecord(), undefined, tracks)).toMatchObject({
      tracks: [{
        id: 'track_1',
        shortDescription: 'Build with agents.',
        fullDescription: 'Read the full track guidelines.',
        resources: [{
          id: 'resource_1',
          title: 'Starter guide',
          url: 'https://example.com/guide',
          description: 'Read this before the event.',
          displayOrder: 1
        }]
      }]
    })
    expect(serializeEvent(buildEventRecord(), undefined, tracks).tracks?.[0]).not.toHaveProperty('staffInstructions')
    expect(serializeEvent(buildEventRecord(), undefined, tracks, {
      trackStaffInstructionIds: 'all'
    }).tracks?.[0]).toMatchObject({
      staffInstructions: 'Help participants find the right starter guide.'
    })
    const accountEventTrack = serializeAccountEvent(buildEventRecord(), tracks, {
      trackStaffInstructionIds: 'all'
    }).tracks?.[0]
    expect(accountEventTrack).toEqual({
      id: 'track_1',
      name: 'Agents',
      shortDescription: 'Build with agents.',
      fullDescription: 'Read the full track guidelines.',
      staffInstructions: 'Help participants find the right starter guide.',
      resources: [{
        id: 'resource_1',
        title: 'Starter guide',
        url: 'https://example.com/guide',
        description: 'Read this before the event.',
        displayOrder: 1
      }],
      displayOrder: 1
    })
    expect(accountEventTrack).not.toHaveProperty('eventId')
    expect(accountEventTrack).not.toHaveProperty('createdAt')
    expect(serializePublicEvent(buildEventRecord({
      eventType: 'build'
    }), undefined, tracks).tracks).toEqual([{
      name: 'Agents',
      shortDescription: 'Build with agents.',
      displayOrder: 1
    }])
    expect(serializePublicEvent(buildEventRecord({
      eventType: 'build'
    }), undefined, tracks)).not.toMatchObject({
      tracks: [{
        resources: expect.any(Array)
      }]
    })

    const fullPublicTrack = serializePublicEvent(buildEventRecord({
      eventType: 'build'
    }), undefined, tracks, {
      includeFullTrackDetails: true
    }).tracks?.[0]

    expect(fullPublicTrack).toEqual({
      name: 'Agents',
      shortDescription: 'Build with agents.',
      fullDescription: 'Read the full track guidelines.',
      resources: [{
        title: 'Starter guide',
        url: 'https://example.com/guide',
        description: 'Read this before the event.',
        displayOrder: 1
      }],
      displayOrder: 1
    })
    expect(fullPublicTrack).not.toHaveProperty('id')
    expect(fullPublicTrack).not.toHaveProperty('eventId')
    expect(fullPublicTrack).not.toHaveProperty('staffInstructions')
    expect(fullPublicTrack?.resources[0]).not.toHaveProperty('id')
  })

  test('serializes configurable judging fields for internal event responses', () => {
    expect(serializeEvent(buildEventRecord({
      state: 'blind_review',
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      shortlistFinalistCount: 6,
      pitchFinalistSubmissionIdsJson: JSON.stringify(['submission_2', 'submission_1']),
      activePitchPresentationSubmissionId: 'submission_2',
      pitchPresentationsCompletedAt: null
    }))).toMatchObject({
      state: 'blind_review',
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      shortlistFinalistCount: 6,
      pitchPresentationSubmissionIds: ['submission_2', 'submission_1'],
      activePitchPresentationSubmissionId: 'submission_2',
      pitchPresentationsCompletedAt: null
    })
  })

  test('serializes event-specific and default display background URLs separately', () => {
    expect(serializeEvent(buildEventRecord(), undefined, undefined, {
      defaultEventBackgroundImageUrl: 'https://example.com/default-background.png'
    })).toMatchObject({
      backgroundImageUrl: null,
      displayBackgroundImageUrl: 'https://example.com/default-background.png'
    })

    expect(serializeEvent(buildEventRecord({
      backgroundImageUrl: 'https://example.com/event-background.png'
    }), undefined, undefined, {
      defaultEventBackgroundImageUrl: 'https://example.com/default-background.png'
    })).toMatchObject({
      backgroundImageUrl: 'https://example.com/event-background.png',
      displayBackgroundImageUrl: 'https://example.com/event-background.png'
    })

    const serializedManagedImages = serializeEvent(buildEventRecord({
      backgroundImageUrl: 'https://example.com/api/public/events/fixture/images/background',
      backgroundImageObjectKey: 'events/event_1/background/current-object',
      backgroundImageRevision: 4,
      bannerImageUrl: 'https://example.com/api/public/events/fixture/images/banner',
      bannerImageObjectKey: 'events/event_1/banner/current-object',
      bannerImageRevision: 7
    }))

    expect(serializedManagedImages).toMatchObject({
      backgroundImageUrl: 'https://example.com/api/public/events/fixture-event/images/background?variant=background&v=4',
      bannerImageUrl: 'https://example.com/api/public/events/fixture-event/images/banner?variant=banner&v=7',
      displayBackgroundImageUrl: 'https://example.com/api/public/events/fixture-event/images/background?variant=background&v=4'
    })
  })

  test('serializes common application requirements for registration-only events', () => {
    expect(serializeEvent(buildEventRecord({
      eventType: 'build',
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true,
      requireProofOfExecution: true,
      requireSubmissionSummary: true,
      requireSubmissionRepositoryUrl: true,
      requireSubmissionDemoUrl: true
    }))).toMatchObject({
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true,
      requireProofOfExecution: true,
      requireSubmissionSummary: false,
      requireSubmissionRepositoryUrl: false,
      requireSubmissionDemoUrl: false
    })
  })

  test('hides street address in public event responses', () => {
    expect(serializePublicEvent(buildEventRecord({
      address: 'Fixture Address'
    }))).toMatchObject({
      city: 'Vienna',
      country: 'Austria',
      address: ''
    })
  })

  test('serializes public event display background without replacing stored event fields', () => {
    expect(serializePublicEvent(buildEventRecord({
      bannerImageUrl: 'https://example.com/api/public/events/fixture-event/images/banner',
      bannerImageObjectKey: 'events/fixture-event/banner/immutable-1',
      bannerImageRevision: 1
    }), undefined, undefined, {
      defaultEventBackgroundImageUrl: 'https://example.com/api/public/platform/event-default-background-image',
      defaultEventBackgroundImageObjectKey: 'platform/default-event-background/immutable-1',
      defaultEventBackgroundImageRevision: 1
    })).toMatchObject({
      backgroundImageUrl: null,
      displayBackgroundImageUrl: 'https://example.com/api/public/platform/event-default-background-image?variant=background&v=1',
      bannerImageUrl: 'https://example.com/api/public/events/fixture-event/images/banner?variant=banner&v=1'
    })
  })

  test('includes canonical judging review states in public event visibility queries', async () => {
    let capturedWhere: unknown

    const database = {
      query: {
        events: {
          findFirst: async ({ where }: { where: unknown }) => {
            capturedWhere = where
            return buildEventRecord({
              state: 'blind_review'
            })
          }
        }
      }
    } as Parameters<typeof getPublicEventBySlugOrThrow>[0]

    await expect(getPublicEventBySlugOrThrow(database, 'fixture-event')).resolves.toMatchObject({
      slug: 'fixture-event',
      state: 'blind_review'
    })

    const visibilityValues = collectDrizzleParamValues(capturedWhere)

    expect(visibilityValues).toContain('blind_review')
    expect(visibilityValues).toContain('pitch')
    expect(visibilityValues).toContain('pitch_review')
    expect(visibilityValues).toContain('final_deliberation')
    expect(visibilityValues).not.toContain('judge_review')
  })

  test('derives published judge and staff rosters from canonical role assignments', () => {
    expect(isEventRolePublishedInRoster({
      role: 'judge',
      isInJudgePool: true,
      isStaff: false
    }, 'judge')).toBe(true)

    expect(isEventRolePublishedInRoster({
      role: 'event_admin',
      isInJudgePool: true,
      isStaff: false
    }, 'judge')).toBe(true)

    expect(isEventRolePublishedInRoster({
      role: 'event_admin',
      isInJudgePool: false,
      isStaff: true
    }, 'staff')).toBe(true)

    expect(isEventRolePublishedInRoster({
      role: 'staff',
      isInJudgePool: false,
      isStaff: true
    }, 'judge')).toBe(false)
  })

  test('serializes published roster members with full-name fallback and public profile fields only', () => {
    expect(serializePublishedEventRosterMember({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'hidden@example.com',
      displayName: 'Display Name',
      firstName: 'Display',
      familyName: 'Name',
      company: 'Codex Labs',
      bio: 'Builds careful systems.',
      isPlatformAdmin: true,
      xProfileUrl: 'https://x.com/display-name',
      linkedinProfileUrl: 'https://linkedin.com/in/display-name',
      githubProfileUrl: 'https://github.com/display-name',
      chatgptEmail: 'hidden-chatgpt@example.com',
      openaiOrgId: 'org-hidden',
      lumaEmail: 'hidden-luma@example.com',
      lumaUsername: 'hidden-luma',
      profileIconUpdatedAt: '2026-03-20T12:00:00.000Z',
      profileIconObjectKey: 'users/user_1/profile-icon/fixture-1',
      profileIconRevision: 1,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      deletedAt: null
    })).toEqual({
      id: 'user_1',
      fullName: 'Display Name',
      company: 'Codex Labs',
      bio: 'Builds careful systems.',
      xProfileUrl: 'https://x.com/display-name',
      linkedinProfileUrl: 'https://linkedin.com/in/display-name',
      githubProfileUrl: 'https://github.com/display-name',
      profileIconUpdatedAt: '2026-03-20T12:00:00.000Z',
      profileIconRevision: 1
    })

    expect(serializePublishedEventRosterMember({
      id: 'user_2',
      auth0Subject: 'auth0|user_2',
      email: 'fallback@example.com',
      displayName: 'Fallback Display',
      firstName: '',
      familyName: '',
      company: null,
      bio: null,
      isPlatformAdmin: false,
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      chatgptEmail: null,
      openaiOrgId: null,
      lumaEmail: null,
      lumaUsername: null,
      profileIconUpdatedAt: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-02T00:00:00.000Z',
      deletedAt: null
    }).fullName).toBe('Fallback Display')
  })
})

describe('event builder metadata', () => {
  test('agenda items round-trip builderBlockType and stay key-free when absent', () => {
    const parsed = parseEventAgendaItems(builderAgendaItemsJson)

    expect(parsed[0]?.builderBlockType).toBe('talk')

    const reserialized = parseEventAgendaItems(serializeEventAgendaItems(parsed))

    expect(reserialized[1]?.builderBlockType).toBe('networking')

    const plainItem = JSON.stringify([{
      id: 'agenda_plain',
      startsAt: '2026-03-24T09:00:00.000Z',
      endsAt: null,
      title: 'Classic Item',
      details: null,
      displayOrder: 0
    }])
    const parsedPlain = parseEventAgendaItems(plainItem)

    expect(parsedPlain[0]).toBeDefined()
    expect('builderBlockType' in parsedPlain[0]!).toBe(false)
    expect(serializeEventAgendaItems(parsedPlain)).not.toContain('builderBlockType')
  })

  test('a malformed builderBlockType drops the annotation, never the agenda', () => {
    const malformed = JSON.stringify([{
      id: 'agenda_1',
      startsAt: '2026-03-24T09:00:00.000Z',
      endsAt: null,
      title: 'Session',
      details: null,
      displayOrder: 0,
      builderBlockType: 'x'.repeat(60)
    }])
    const parsed = parseEventAgendaItems(malformed)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.builderBlockType).toBeUndefined()
  })

  test('custom-block scoring dials round-trip and malformed dials drop themselves', () => {
    const withDials = JSON.stringify([{
      id: 'agenda_custom',
      startsAt: '2026-03-24T09:00:00.000Z',
      endsAt: '2026-03-24T10:00:00.000Z',
      title: 'Rooftop Mixing',
      details: null,
      displayOrder: 0,
      builderFocusCost: 14,
      builderEnergyDelta: -6
    }])
    const parsed = parseEventAgendaItems(withDials)

    expect(parsed[0]?.builderFocusCost).toBe(14)
    expect(parsed[0]?.builderEnergyDelta).toBe(-6)

    const reserialized = parseEventAgendaItems(serializeEventAgendaItems(parsed))

    expect(reserialized[0]?.builderFocusCost).toBe(14)
    expect(reserialized[0]?.builderEnergyDelta).toBe(-6)

    const malformed = JSON.stringify([{
      id: 'agenda_custom',
      startsAt: '2026-03-24T09:00:00.000Z',
      endsAt: null,
      title: 'Rooftop Mixing',
      details: null,
      displayOrder: 0,
      builderFocusCost: 'a lot',
      builderEnergyDelta: 250
    }])
    const parsedMalformed = parseEventAgendaItems(malformed)

    expect(parsedMalformed).toHaveLength(1)
    expect(parsedMalformed[0]?.builderFocusCost).toBeUndefined()
    expect(parsedMalformed[0]?.builderEnergyDelta).toBeUndefined()
  })

  test('createEventBodySchema defaults creationFlow to classic and accepts builder', () => {
    const baseBody = {
      eventType: 'meetup',
      name: 'Flow Event',
      slug: 'flow-event',
      description: 'Testing flows',
      agendaItems: [],
      tracks: [],
      city: 'Vienna',
      country: 'Austria',
      address: 'Somewhere 1',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z'
    }

    expect(createEventBodySchema.parse(baseBody)).toMatchObject({ creationFlow: 'classic' })
    expect(createEventBodySchema.parse({ ...baseBody, creationFlow: 'builder' }))
      .toMatchObject({ creationFlow: 'builder' })
    expect(() => createEventBodySchema.parse({ ...baseBody, creationFlow: 'wizard' })).toThrow()
  })

  test('updateEventBodySchema strips creationFlow so the flow is immutable', () => {
    const parsed = updateEventBodySchema.parse({
      name: 'Renamed',
      creationFlow: 'classic'
    })

    expect(parsed).toMatchObject({ name: 'Renamed' })
    expect('creationFlow' in parsed).toBe(false)
  })

  test('serializeEvent exposes creationFlow and admin payloads carry balance data', () => {
    const record = buildEventRecord({
      creationFlow: 'builder',
      agendaItemsJson: builderAgendaItemsJson,
      ...computeEventBalanceColumns(buildEventRecord({ agendaItemsJson: builderAgendaItemsJson }))
    })

    expect(serializeEvent(record).creationFlow).toBe('builder')

    const admin = serializeAdminEvent(record)

    expect(admin.balanceScore).toBe(record.balanceScore)
    expect(admin.balanceBreakdown).toEqual(parseEventBalanceBreakdown(record.balanceBreakdownJson))
    expect(admin.balanceBreakdown?.engineVersion).toBeGreaterThanOrEqual(1)
    expect(admin.agendaItems[0]?.builderBlockType).toBe('talk')
  })

  test('serializeAdminEvent tolerates legacy rows and corrupt breakdown JSON', () => {
    expect(serializeAdminEvent(buildEventRecord()).balanceScore).toBeNull()
    expect(serializeAdminEvent(buildEventRecord()).balanceBreakdown).toBeNull()
    expect(serializeAdminEvent(buildEventRecord({ balanceBreakdownJson: '{not json' })).balanceBreakdown).toBeNull()
  })

  test('keeps Call for talks questions private to admin and account contracts', () => {
    const questions = [{ id: 'phone', type: 'short_text', prompt: 'Phone number', required: true, options: [] }]
    const record = buildEventRecord({
      eventType: 'meetup',
      talkProposalsEnabled: true,
      talkProposalQuestionsJson: JSON.stringify(questions),
      talkProposalQuestionsRevision: 2
    })

    expect(serializeAdminEvent(record)).toMatchObject({
      talkProposalQuestions: questions,
      talkProposalQuestionsRevision: 2
    })
    expect(serializeEvent(record)).not.toHaveProperty('talkProposalQuestions')
    expect(serializePublicEvent(record)).not.toHaveProperty('talkProposalQuestions')
  })

  test('public payloads never expose builder metadata', () => {
    const record = buildEventRecord({
      creationFlow: 'builder',
      agendaItemsJson: builderAgendaItemsJson,
      balanceScore: 80,
      balanceBreakdownJson: '{}'
    })
    const publicEvent = serializePublicEvent(record) as Record<string, unknown>

    expect('creationFlow' in publicEvent).toBe(false)
    expect('balanceScore' in publicEvent).toBe(false)
    expect('balanceBreakdown' in publicEvent).toBe(false)

    const agendaItems = publicEvent.agendaItems as Array<Record<string, unknown>>

    expect(agendaItems).toHaveLength(2)

    for (const item of agendaItems) {
      expect('builderBlockType' in item).toBe(false)
    }
  })

  test('computeEventBalanceColumns matches the shared engine and stays deterministic', () => {
    const record = buildEventRecord({ agendaItemsJson: builderAgendaItemsJson })
    const first = computeEventBalanceColumns(record)
    const second = computeEventBalanceColumns(record)

    expect(first).toEqual(second)
    expect(Number.isInteger(first.balanceScore)).toBe(true)
    expect(first.balanceScore).toBeGreaterThanOrEqual(0)
    expect(first.balanceScore).toBeLessThanOrEqual(100)
    expect(parseEventBalanceBreakdown(first.balanceBreakdownJson)).not.toBeNull()
  })
})
