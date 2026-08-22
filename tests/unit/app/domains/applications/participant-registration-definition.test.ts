import { describe, expect, test } from 'vitest'

import type {
  ParticipantRegistrationDefinitionInput,
  ParticipantRegistrationDraft
} from '../../../../../app/domains/applications/participant-registration-definition'

import {
  createParticipantRegistrationDraft,
  evaluateParticipantRegistration,
  normalizeParticipantRegistrationProfileForm,
  participantRegistrationProfileFieldId,
  participantRegistrationSectionDomId,
  participantRegistrationTalkQuestionFieldId,
  participantRegistrationTeammateFieldId,
  projectParticipantRegistrationAccountPatch,
  projectParticipantRegistrationApplicationPayload,
  resolveParticipantRegistrationDefinition
} from '../../../../../app/domains/applications/participant-registration-definition'

function createInput(overrides: Partial<ParticipantRegistrationDefinitionInput> = {}): ParticipantRegistrationDefinitionInput {
  return {
    event: {
      eventType: 'meetup',
      inPersonEvent: false,
      applicationWhyThisEventVisible: false,
      applicationProofOfExecutionVisible: false,
      applicationTeamIntentVisible: false,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    },
    profileFields: [],
    trackOptions: [],
    maxTeamMembers: 1,
    currentApplicationTerms: null,
    talkProposal: null,
    ...overrides
  }
}

function completeIdentity(draft: ParticipantRegistrationDraft) {
  draft.profileForm.firstName = 'Ada'
  draft.profileForm.familyName = 'Lovelace'
  return draft
}

describe('participant registration definition', () => {
  test('resolves minimal Meetup visibility and progress from one definition', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput())
    const draft = createParticipantRegistrationDraft()

    expect(definition.sections.map(section => section.id)).toEqual(['details'])
    expect(draft.talkProposal).toBeNull()
    expect(evaluateParticipantRegistration(definition, draft)).toMatchObject({
      requiredCount: 2,
      completedRequiredCount: 0,
      readyToSubmit: false
    })
    expect(evaluateParticipantRegistration(definition, completeIdentity(draft))).toMatchObject({
      requiredCount: 2,
      completedRequiredCount: 2,
      readyToSubmit: true
    })
  })

  test('uses Build tracks instead of AI Knowledge and validates the configured track', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      event: {
        ...createInput().event,
        eventType: 'build',
        applicationAiKnowledgeVisible: true,
        requireAiKnowledge: true
      },
      trackOptions: [
        { id: 'second', name: 'Zebra', shortDescription: 'Second', displayOrder: 2 },
        { id: 'agents', name: 'Agents', shortDescription: '**Build agents.**', displayOrder: 1 }
      ]
    }))
    const draft = completeIdentity(createParticipantRegistrationDraft())
    draft.aiKnowledgeLevel = 'advanced'
    draft.selectedTrackId = 'missing'
    const evaluation = evaluateParticipantRegistration(definition, draft, true)

    expect(definition.application).toMatchObject({ showTrackSelection: true, showAiKnowledge: false })
    expect(definition.application.trackOptions.map(track => track.id)).toEqual(['agents', 'second'])
    expect(definition.application.fields.map(field => field.id)).toEqual(['selectedTrackId'])
    expect(evaluation.errors.selectedTrackId).toBe('Choose a track.')
    expect(evaluation.errors.aiKnowledgeLevel).toBeUndefined()
  })

  test('uses configured AI Knowledge for Build without tracks', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      event: {
        ...createInput().event,
        eventType: 'build',
        applicationAiKnowledgeVisible: true,
        applicationWhyThisEventVisible: true,
        requireAiKnowledge: true,
        requireWhyThisEvent: false
      }
    }))
    const draft = completeIdentity(createParticipantRegistrationDraft())
    draft.aiKnowledgeLevel = 'intermediate'
    const evaluation = evaluateParticipantRegistration(definition, draft)

    expect(definition.application.fields.map(field => field.id)).toEqual(['aiKnowledgeLevel', 'whyThisEvent'])
    expect(evaluation.sections.find(section => section.id === 'application')?.fields).toMatchObject([
      { id: 'aiKnowledgeLevel', required: true, complete: true },
      { id: 'whyThisEvent', required: false, complete: true }
    ])
    expect(evaluation.readyToSubmit).toBe(true)
  })

  test('validates Hackathon participation, teammate hints, attendance, and terms', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      event: {
        ...createInput().event,
        eventType: 'hackathon',
        inPersonEvent: true,
        applicationTeamIntentVisible: true,
        applicationAiKnowledgeVisible: true,
        requireTeamIntent: true,
        requireAiKnowledge: true
      },
      maxTeamMembers: 3,
      currentApplicationTerms: {
        id: 'terms-1',
        eventId: 'event-1',
        documentType: 'application_terms',
        version: 1,
        title: 'Terms',
        content: 'Terms',
        publishedAt: '2026-08-22T00:00:00.000Z',
        createdAt: '2026-08-22T00:00:00.000Z'
      }
    }))
    const draft = completeIdentity(createParticipantRegistrationDraft())
    draft.aiKnowledgeLevel = 'advanced'
    draft.teamIntent = 'team'
    draft.teamMemberHints = [
      { fullName: 'Grace Hopper', email: 'not-an-email' },
      { fullName: '', email: '' }
    ]
    const evaluation = evaluateParticipantRegistration(definition, draft, true)

    expect(definition.application.fields.map(field => field.id)).toEqual(['aiKnowledgeLevel'])
    expect(definition.participation.maxTeammates).toBe(2)
    expect(evaluation.errors[participantRegistrationTeammateFieldId(0, 'email')]).toBe('Enter a valid email address.')
    expect(evaluation.errors.inPersonAttendanceCommitment).toBe('Confirm in-person attendance commitment to submit.')
    expect(evaluation.errors.termsAccepted).toBe('Accept Application Terms to submit.')
    expect(evaluation.firstInvalidFieldId).toBe(participantRegistrationTeammateFieldId(0, 'email'))
  })

  test.each(['meetup', 'build', 'hackathon'] as const)('shows teammate hints for visible %s team participation', (eventType) => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      event: { ...createInput().event, eventType, applicationTeamIntentVisible: true },
      maxTeamMembers: 4
    }))
    const draft = createParticipantRegistrationDraft()
    draft.teamIntent = 'team'
    draft.teamMemberHints = [
      { fullName: '', email: '' },
      { fullName: '', email: '' },
      { fullName: '', email: '' }
    ]
    const fields = evaluateParticipantRegistration(definition, draft).sections
      .find(section => section.id === 'participation')?.fields.map(field => field.id)

    expect(definition.participation).toMatchObject({ visible: true, maxTeammates: 3 })
    expect(definition.participation.teammateHintsVisible(draft)).toBe(true)
    expect(fields).toContain(participantRegistrationTeammateFieldId(2, 'fullName'))
  })

  test('ignores hidden malformed profile values and flags visible optional malformed values', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      profileFields: [
        { key: 'githubProfileUrl', label: 'GitHub profile URL', visible: false, required: false },
        { key: 'linkedinProfileUrl', label: 'LinkedIn profile URL', visible: true, required: false }
      ]
    }))
    const draft = completeIdentity(createParticipantRegistrationDraft())
    draft.profileForm.githubProfileUrl = 'not-a-url'
    draft.profileForm.linkedinProfileUrl = 'not-a-url'
    const evaluation = evaluateParticipantRegistration(definition, draft, true)

    expect(evaluation.errors[participantRegistrationProfileFieldId('githubProfileUrl')]).toBeUndefined()
    expect(evaluation.errors[participantRegistrationProfileFieldId('linkedinProfileUrl')]).toBe('Use a linkedin.com profile URL.')
    expect(evaluation.sections.find(section => section.id === 'links')?.state).toBe('error')
  })

  test('projects only visible account and application fields', () => {
    const definition = resolveParticipantRegistrationDefinition(createInput({
      event: {
        ...createInput().event,
        eventType: 'build',
        applicationWhyThisEventVisible: true,
        applicationProofOfExecutionVisible: false,
        applicationTeamIntentVisible: true,
        applicationAiKnowledgeVisible: true
      },
      profileFields: [
        { key: 'githubProfileUrl', label: 'GitHub', visible: true, required: false },
        { key: 'xProfileUrl', label: 'X', visible: false, required: false }
      ],
      trackOptions: [{ id: 'agents', name: 'Agents', shortDescription: 'Agents', displayOrder: 0 }],
      maxTeamMembers: 3
    }))
    const draft = completeIdentity(createParticipantRegistrationDraft())
    draft.profileForm.githubProfileUrl = 'https://github.com/ada/'
    draft.profileForm.xProfileUrl = 'https://x.com/hidden'
    draft.whyThisEvent = 'Build useful tools'
    draft.proofOfExecutionUrl = 'not-a-url'
    draft.aiKnowledgeLevel = 'advanced'
    draft.selectedTrackId = 'agents'
    draft.teamIntent = 'team'
    draft.teamMemberHints = [
      { fullName: 'Grace Hopper', email: 'grace@example.com' },
      { fullName: '', email: '' }
    ]

    expect(projectParticipantRegistrationAccountPatch(definition, draft)).toEqual({
      firstName: 'Ada',
      familyName: 'Lovelace',
      githubProfileUrl: 'https://github.com/ada/'
    })
    expect(projectParticipantRegistrationApplicationPayload(definition, draft)).toEqual({
      whyThisEvent: 'Build useful tools',
      selectedTrackId: 'agents',
      registrationTeamIntent: 'team',
      registrationTeamMembers: [
        { fullName: 'Grace Hopper', email: 'grace@example.com' },
        { fullName: null, email: null }
      ]
    })
  })

  test('makes CFP an explicit validated section and includes one combined payload', () => {
    const talkProposal = {
      questionSetRevision: 4,
      questions: [
        { id: 'audience', type: 'short_text' as const, prompt: 'Who is this for?', required: true, options: [] },
        { id: 'format', type: 'acknowledgement' as const, prompt: 'I accept seven minutes', required: true, options: [] }
      ]
    }
    const definition = resolveParticipantRegistrationDefinition(createInput({ talkProposal }))
    const draft = completeIdentity(createParticipantRegistrationDraft(talkProposal))
    if (!draft.talkProposal) throw new Error('Expected a CFP draft.')
    draft.talkProposal.title = 'Reliable handoffs'
    draft.talkProposal.abstract = 'A practical talk.'
    draft.talkProposal.answers[0]!.value = 'Agent builders'
    let evaluation = evaluateParticipantRegistration(definition, draft, true)

    expect(definition.sections.map(section => section.id)).toEqual(['registration', 'talk-proposal'])
    expect(evaluation.errors[participantRegistrationTalkQuestionFieldId('format')]).toBeTruthy()
    expect(evaluation.firstInvalidFieldId).toBe(participantRegistrationTalkQuestionFieldId('format'))

    draft.talkProposal.answers[1]!.value = true
    evaluation = evaluateParticipantRegistration(definition, draft, true)
    expect(evaluation.readyToSubmit).toBe(true)
    expect(projectParticipantRegistrationApplicationPayload(definition, draft)).toEqual({
      talkProposal: {
        title: 'Reliable handoffs',
        abstract: 'A practical talk.',
        demoOrSlidesUrl: '',
        questionSetRevision: 4,
        answers: [
          { questionId: 'audience', value: 'Agent builders' },
          { questionId: 'format', value: true }
        ]
      }
    })
  })

  test('centralizes typed field and section identifiers', () => {
    expect(participantRegistrationProfileFieldId('githubProfileUrl')).toBe('profileForm.githubProfileUrl')
    expect(participantRegistrationTeammateFieldId(2, 'email')).toBe('teamMemberHints.2.email')
    expect(participantRegistrationTalkQuestionFieldId('audience')).toBe('talkProposal.question.audience')
    expect(participantRegistrationSectionDomId('registration')).toBe('registration-section-registration')
  })

  test('normalizes profile inputs to the canonical typed draft shape', () => {
    expect(normalizeParticipantRegistrationProfileForm({ firstName: 'Ada', familyName: null, chatgptEmail: 42 })).toMatchObject({
      firstName: 'Ada',
      familyName: '',
      chatgptEmail: ''
    })
  })
})
