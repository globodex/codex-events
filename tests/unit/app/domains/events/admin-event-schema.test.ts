import { describe, expect, test } from 'vitest'

import {
  buildEventConfigurationPatch,
  createEmptyEventFormState,
  eventConfigFormSchema,
  eventDetailsFormSchema,
  formatParticipantsLimitInput,
  parseParticipantsLimitInput
} from '../../../../../app/domains/events/admin-event'

function createValidEventFormState() {
  return {
    ...createEmptyEventFormState(),
    name: 'Codex Spring Builders 2026',
    slug: 'codex-spring-builders-2026',
    description: 'Canonical fixture event.',
    city: 'Vienna',
    country: 'Austria',
    address: 'Operngasse 20, 1040 Vienna',
    registrationOpensAt: '2026-03-20T12:00',
    registrationClosesAt: '2026-03-22T12:00',
    submissionOpensAt: '2026-03-22T12:00',
    submissionClosesAt: '2026-03-24T12:00',
    requireChatgptEmail: false,
    requireOpenaiOrgId: false,
    requireLumaEmail: false
  }
}

describe('event config form schema', () => {
  test('allows an empty luma event URL', () => {
    const result = eventConfigFormSchema.safeParse(createValidEventFormState())

    expect(result.success).toBe(true)
  })

  test('validates the simplified Meetup claiming toggle and includes it in patches', () => {
    const meetup = {
      ...createValidEventFormState(),
      eventType: 'meetup' as const,
      submissionOpensAt: '',
      submissionClosesAt: '',
      simplifiedClaimingEnabled: true
    }
    expect(eventConfigFormSchema.safeParse(meetup).success).toBe(true)
    expect(buildEventConfigurationPatch(meetup, 'meetup')).toMatchObject({
      simplifiedClaimingEnabled: true
    })
    expect(eventConfigFormSchema.safeParse({
      ...meetup,
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'secret',
      applicationLumaEmailVisible: true,
      requireLumaEmail: true
    }).success).toBe(false)
    expect(eventConfigFormSchema.safeParse({
      ...meetup,
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'secret'
    }).success).toBe(true)
    expect(eventConfigFormSchema.safeParse({
      ...meetup,
      lumaEventApiId: 'evt-123'
    }).success).toBe(false)
    expect(buildEventConfigurationPatch({
      ...meetup,
      eventType: 'build'
    }, 'build')).toMatchObject({
      simplifiedClaimingEnabled: false
    })
  })

  test('validates Meetup Call for talks settings and includes its window in patches', () => {
    const meetup = {
      ...createValidEventFormState(),
      eventType: 'meetup' as const,
      talkProposalsEnabled: true,
      talkProposalOpensAt: '2026-03-20T12:00',
      talkProposalClosesAt: '2026-03-21T12:00',
      talkProposalQuestions: [{
        id: 'phone',
        type: 'short_text' as const,
        prompt: 'Phone number',
        required: true,
        options: []
      }]
    }

    expect(eventConfigFormSchema.safeParse(meetup).success).toBe(true)
    expect(buildEventConfigurationPatch(meetup, 'meetup')).toMatchObject({
      talkProposalsEnabled: true,
      talkProposalOpensAt: expect.any(String),
      talkProposalClosesAt: expect.any(String),
      talkProposalQuestions: meetup.talkProposalQuestions
    })
    expect(eventConfigFormSchema.safeParse({
      ...meetup,
      talkProposalClosesAt: meetup.talkProposalOpensAt
    }).success).toBe(false)
    expect(buildEventConfigurationPatch({
      ...meetup,
      eventType: 'build'
    }, 'build')).toMatchObject({
      talkProposalsEnabled: false,
      talkProposalOpensAt: null,
      talkProposalClosesAt: null,
      talkProposalQuestions: []
    })
  })

  test('rejects non-http Discord server URLs', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      discordServerUrl: 'discord://codex-builders'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid Discord server URL.')
  })

  test('accepts markdown-formatted descriptions', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      description: '  ## Overview\n\n- Build\n- Demo  '
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.description).toBe('## Overview\n\n- Build\n- Demo')
  })

  test('rejects non-http luma event URLs', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      lumaEventUrl: 'ftp://lu.ma/codex-builders'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid Luma event URL.')
  })

  test('rejects non-http slides URLs', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      slidesUrl: 'file:///slides.pdf'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid slides URL.')
  })

  test('rejects invalid luma event API ids', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      lumaEventApiId: 'abc-123'
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid Luma event API ID like evt-123.')
  })

  test('includes the event Luma API key in configuration patches', () => {
    expect(buildEventConfigurationPatch({
      ...createValidEventFormState(),
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key'
    }, 'hackathon')).toMatchObject({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key'
    })

    expect(buildEventConfigurationPatch({
      ...createValidEventFormState(),
      lumaApiKey: '   '
    }, 'hackathon')).toMatchObject({
      lumaApiKey: null
    })
  })

  test('includes the slides URL in configuration patches', () => {
    expect(buildEventConfigurationPatch({
      ...createValidEventFormState(),
      slidesUrl: ' https://example.com/slides '
    }, 'hackathon')).toMatchObject({
      slidesUrl: 'https://example.com/slides'
    })

    expect(buildEventConfigurationPatch({
      ...createValidEventFormState(),
      slidesUrl: '   '
    }, 'hackathon')).toMatchObject({
      slidesUrl: null
    })
  })

  test('accepts configured submission tracks with markdown descriptions', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      tracks: [
        {
          id: 'track-1',
          name: 'Best AI Agent',
          shortDescription: '  **Projects** focused on autonomous workflows.  ',
          fullDescription: '  ## Guidelines\n\n- Agents\n- Tools  ',
          staffInstructions: '  Help this track choose starter resources.  ',
          resources: [{
            id: 'resource-1',
            title: 'Starter guide',
            url: 'https://example.com/guide',
            description: 'Read before choosing this track.',
            displayOrder: 1
          }],
          displayOrder: 1
        }
      ]
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.tracks[0]?.shortDescription).toBe('**Projects** focused on autonomous workflows.')
    expect(result.data.tracks[0]?.fullDescription).toBe('## Guidelines\n\n- Agents\n- Tools')
    expect(result.data.tracks[0]?.staffInstructions).toBe('Help this track choose starter resources.')
  })

  test('ignores hidden hackathon fields for non-hackathon events', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      eventType: 'meetup',
      tracks: [
        {
          id: 'track-1',
          name: '',
          shortDescription: '',
          fullDescription: '',
          staffInstructions: '',
          resources: [],
          displayOrder: 1
        }
      ],
      submissionOpensAt: undefined,
      submissionClosesAt: undefined,
      maxTeamMembers: undefined,
      blindReviewCount: undefined,
      pitchReviewEnabled: undefined,
      blindScoreWeightPercent: undefined,
      pitchScoreWeightPercent: undefined,
      shortlistFinalistCount: undefined,
      requireSubmissionSummary: undefined,
      requireSubmissionRepositoryUrl: undefined,
      requireSubmissionDemoUrl: undefined
    })

    expect(result.success).toBe(true)

    if (!result.success) {
      return
    }

    expect(result.data.tracks).toEqual([])
    expect(result.data.maxTeamMembers).toBe(1)
    expect(result.data.pitchReviewEnabled).toBe(false)
  })

  test('rejects application fields required while hidden', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      applicationGithubProfileVisible: false,
      requireGithubProfile: true
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.requireGithubProfile).toEqual([
      'GitHub profile cannot be required while hidden from the application form.'
    ])

    const aiKnowledgeResult = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      applicationAiKnowledgeVisible: false,
      requireAiKnowledge: true
    })

    expect(aiKnowledgeResult.success).toBe(false)

    if (aiKnowledgeResult.success) {
      return
    }

    expect(aiKnowledgeResult.error.flatten().fieldErrors.requireAiKnowledge).toEqual([
      'AI Knowledge cannot be required while hidden from the application form.'
    ])
  })

  test('keeps AI Knowledge hidden by default and includes it in configuration patches', () => {
    expect(createEmptyEventFormState().applicationAiKnowledgeVisible).toBe(false)
    expect(createEmptyEventFormState().requireAiKnowledge).toBe(false)

    expect(buildEventConfigurationPatch({
      ...createValidEventFormState(),
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true
    }, 'hackathon')).toMatchObject({
      applicationAiKnowledgeVisible: true,
      requireAiKnowledge: true
    })
  })

  test('keeps Luma email disabled by default and includes it when Luma Sync is enabled', () => {
    expect(createEmptyEventFormState().applicationLumaEmailVisible).toBe(false)
    expect(createEmptyEventFormState().requireLumaEmail).toBe(false)

    const lumaSyncState = {
      ...createValidEventFormState(),
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      applicationLumaEmailVisible: true,
      requireLumaEmail: true
    }

    expect(eventConfigFormSchema.safeParse(lumaSyncState).success).toBe(true)
    expect(buildEventConfigurationPatch(lumaSyncState, 'hackathon')).toMatchObject({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      applicationLumaEmailVisible: true,
      requireLumaEmail: true
    })
  })

  test('requires complete Luma Sync configuration', () => {
    const missingLumaCredentials = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      applicationLumaEmailVisible: true,
      requireLumaEmail: true
    })

    expect(missingLumaCredentials.success).toBe(false)

    if (missingLumaCredentials.success) {
      return
    }

    expect(missingLumaCredentials.error.flatten().fieldErrors.lumaEventApiId).toEqual([
      'Enter the Luma event API ID to enable Luma Sync.'
    ])
    expect(missingLumaCredentials.error.flatten().fieldErrors.lumaApiKey).toEqual([
      'Enter the Luma API key to enable Luma Sync.'
    ])

    const missingLumaEmail = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key'
    })

    expect(missingLumaEmail.success).toBe(false)

    if (missingLumaEmail.success) {
      return
    }

    expect(missingLumaEmail.error.flatten().fieldErrors.applicationLumaEmailVisible).toEqual([
      'Luma email must be shown when Luma Sync is enabled.'
    ])
    expect(missingLumaEmail.error.flatten().fieldErrors.requireLumaEmail).toEqual([
      'Luma email must be required when Luma Sync is enabled.'
    ])
  })

  test('normalizes nullable participant limit input values', () => {
    expect(formatParticipantsLimitInput(null)).toBe('')
    expect(formatParticipantsLimitInput(80)).toBe('80')
    expect(parseParticipantsLimitInput('')).toBeNull()
    expect(parseParticipantsLimitInput('  ')).toBeNull()
    expect(parseParticipantsLimitInput('80')).toBe(80)
    expect(parseParticipantsLimitInput('invalid')).toBeNull()
  })

  test('omits competition fields from registration-only configuration patches', () => {
    const patch = buildEventConfigurationPatch({
      ...createValidEventFormState(),
      eventType: 'meetup',
      tracks: [
        {
          id: 'track-1',
          name: 'Track',
          shortDescription: 'Track description',
          fullDescription: '',
          staffInstructions: '',
          resources: [],
          displayOrder: 1
        }
      ],
      maxTeamMembers: 9,
      participantsLimit: 80,
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 40,
      shortlistFinalistCount: 12,
      requireProofOfExecution: true,
      requireSubmissionSummary: true,
      requireSubmissionRepositoryUrl: true,
      requireSubmissionDemoUrl: true
    }, 'meetup')

    expect(patch).toMatchObject({
      participantsLimit: 80,
      requireProofOfExecution: true
    })
    expect(patch).not.toHaveProperty('tracks')
    expect(patch).not.toHaveProperty('submissionOpensAt')
    expect(patch).not.toHaveProperty('submissionClosesAt')
    expect(patch).not.toHaveProperty('maxTeamMembers')
    expect(patch).not.toHaveProperty('blindReviewCount')
    expect(patch).not.toHaveProperty('pitchReviewEnabled')
    expect(patch).not.toHaveProperty('blindScoreWeightPercent')
    expect(patch).not.toHaveProperty('pitchScoreWeightPercent')
    expect(patch).not.toHaveProperty('shortlistFinalistCount')
    expect(patch).not.toHaveProperty('requireSubmissionSummary')
    expect(patch).not.toHaveProperty('requireSubmissionRepositoryUrl')
    expect(patch).not.toHaveProperty('requireSubmissionDemoUrl')
  })

  test('includes build event tracks with resources in configuration patches', () => {
    const patch = buildEventConfigurationPatch({
      ...createValidEventFormState(),
      eventType: 'build',
      tracks: [
        {
          id: 'track-1',
          name: 'Agents',
          shortDescription: 'Build with agents.',
          fullDescription: 'Use the agent track guidelines.',
          staffInstructions: 'Route agent questions to the mentor desk.',
          resources: [{
            id: 'resource-1',
            title: 'Starter guide',
            url: 'https://example.com/guide',
            description: 'Read before the event.',
            displayOrder: 1
          }],
          displayOrder: 1
        }
      ]
    }, 'build')

    expect(patch).toMatchObject({
      tracks: [{
        id: 'track-1',
        name: 'Agents',
        shortDescription: 'Build with agents.',
        fullDescription: 'Use the agent track guidelines.',
        staffInstructions: 'Route agent questions to the mentor desk.',
        resources: [{
          id: 'resource-1',
          title: 'Starter guide',
          url: 'https://example.com/guide',
          description: 'Read before the event.',
          displayOrder: 1
        }],
        displayOrder: 1
      }]
    })
    expect(patch).not.toHaveProperty('submissionOpensAt')
    expect(patch).not.toHaveProperty('maxTeamMembers')
  })

  test('rejects invalid hackathon tracks', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      tracks: [
        {
          id: 'track-1',
          name: '',
          shortDescription: 'Projects focused on autonomous workflows.',
          fullDescription: '',
          staffInstructions: '',
          resources: [],
          displayOrder: 1
        }
      ]
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.tracks).toEqual(['Enter a track name.'])
  })

  test('requires at least one judging stage', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      blindReviewCount: 0,
      pitchReviewEnabled: false
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.blindReviewCount).toEqual(['Enable at least one judging stage.'])
    expect(result.error.flatten().fieldErrors.pitchReviewEnabled).toEqual(['Enable at least one judging stage.'])
  })

  test('requires score weights to add up to 100 when both judging stages are enabled', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      blindReviewCount: 2,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 60,
      pitchScoreWeightPercent: 30
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.blindScoreWeightPercent).toEqual(['Blind and pitch score weights must add up to 100.'])
    expect(result.error.flatten().fieldErrors.pitchScoreWeightPercent).toEqual(['Blind and pitch score weights must add up to 100.'])
  })

  test('accepts pitch review without blind review', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      blindReviewCount: 0,
      pitchReviewEnabled: true,
      blindScoreWeightPercent: 0,
      pitchScoreWeightPercent: 100
    })

    expect(result.success).toBe(true)
  })

  test('requires at least one preselected finalist when shortlist is configured', () => {
    const result = eventConfigFormSchema.safeParse({
      ...createValidEventFormState(),
      shortlistFinalistCount: 0
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.shortlistFinalistCount).toEqual([
      'Too small: expected number to be >=1'
    ])
  })
})

describe('event details form schema', () => {
  test('ignores hidden full-configuration fields', () => {
    const result = eventDetailsFormSchema.safeParse({
      ...createValidEventFormState(),
      slug: 'Invalid Slug',
      registrationOpensAt: '',
      registrationClosesAt: '',
      submissionOpensAt: '',
      submissionClosesAt: '',
      blindReviewCount: 0,
      pitchReviewEnabled: false,
      agendaItems: [],
      city: 'Tokyo',
      country: 'Japan',
      address: 'Shibuya'
    })

    expect(result.success).toBe(true)
  })

  test('rejects invalid visible details fields', () => {
    const result = eventDetailsFormSchema.safeParse({
      ...createValidEventFormState(),
      agendaItems: [
        {
          id: 'agenda-item-1',
          startsAt: '2026-03-22T13:00',
          endsAt: '2026-03-22T12:00',
          title: 'Opening',
          details: '',
          displayOrder: 1
        }
      ],
      city: '',
      country: 'Japan',
      address: 'Shibuya'
    })

    expect(result.success).toBe(false)

    if (result.success) {
      return
    }

    expect(result.error.flatten().fieldErrors.agendaItems).toEqual([
      'Agenda end time must be on or after the start time.'
    ])
    expect(result.error.flatten().fieldErrors.city).toEqual([
      'Too small: expected string to have >=1 characters'
    ])
  })
})
