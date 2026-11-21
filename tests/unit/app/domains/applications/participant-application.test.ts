import { describe, expect, test } from 'vitest'
import { nextTick, reactive, ref, watch } from 'vue'

import {
  areParticipantTeamMemberHintsEqual,
  createParticipantTeamMemberHintRows,
  formatParticipantApplicationStatus,
  getParticipantApplicationSubmissionPolicy,
  getParticipantApplicationStatusColor,
  parseParticipantRegistrationDetailsJson,
  resolvePublicEventPrimaryAction,
  resolveParticipantRegistrationEntry,
  summarizeParticipantApplicationStatus
} from '../../../../../app/domains/applications/participant-application'
import { cloneFormValues } from '../../../../../app/utils/form-values'

describe('participant application helpers', () => {
  test('syncing checkbox changes does not recurse when team member hints are unchanged', async () => {
    const termsAccepted = ref(false)
    const inPersonAttendanceCommitment = ref(false)
    const whyThisEvent = ref('')
    const proofOfExecutionUrl = ref('')
    const teamIntent = ref<'solo' | 'team' | 'unknown'>('unknown')
    const teamMemberHints = ref(createParticipantTeamMemberHintRows(2))
    const profileForm = ref({
      firstName: '',
      familyName: '',
      xProfileUrl: '',
      linkedinProfileUrl: '',
      githubProfileUrl: '',
      chatgptEmail: '',
      openaiOrgId: '',
      lumaEmail: ''
    })
    const syncingFromModels = ref(false)
    const values = reactive({
      termsAccepted: termsAccepted.value,
      inPersonAttendanceCommitment: inPersonAttendanceCommitment.value,
      whyThisEvent: whyThisEvent.value,
      proofOfExecutionUrl: proofOfExecutionUrl.value,
      teamIntent: teamIntent.value,
      teamMemberHints: cloneFormValues(teamMemberHints.value),
      profileForm: cloneFormValues(profileForm.value)
    })

    let modelToFormSyncCount = 0
    let formToModelSyncCount = 0

    const syncValuesFromModels = () => {
      Object.assign(values, {
        termsAccepted: termsAccepted.value,
        inPersonAttendanceCommitment: inPersonAttendanceCommitment.value,
        whyThisEvent: whyThisEvent.value,
        proofOfExecutionUrl: proofOfExecutionUrl.value,
        teamIntent: teamIntent.value,
        teamMemberHints: cloneFormValues(teamMemberHints.value),
        profileForm: cloneFormValues(profileForm.value)
      })
    }

    watch([
      termsAccepted,
      inPersonAttendanceCommitment,
      whyThisEvent,
      proofOfExecutionUrl,
      teamIntent,
      teamMemberHints,
      profileForm
    ], () => {
      modelToFormSyncCount += 1
      syncingFromModels.value = true
      syncValuesFromModels()
      syncingFromModels.value = false
    }, {
      deep: true,
      immediate: true
    })

    watch(values, (nextValues) => {
      if (syncingFromModels.value) {
        return
      }

      formToModelSyncCount += 1
      termsAccepted.value = nextValues.termsAccepted ?? false
      inPersonAttendanceCommitment.value = nextValues.inPersonAttendanceCommitment ?? false
      whyThisEvent.value = nextValues.whyThisEvent ?? ''
      proofOfExecutionUrl.value = nextValues.proofOfExecutionUrl ?? ''
      teamIntent.value = nextValues.teamIntent ?? 'unknown'

      const nextTeamMemberHints = cloneFormValues(nextValues.teamMemberHints ?? [])

      if (!areParticipantTeamMemberHintsEqual(teamMemberHints.value, nextTeamMemberHints)) {
        teamMemberHints.value = nextTeamMemberHints
      }

      if (nextValues.profileForm) {
        Object.assign(profileForm.value, cloneFormValues(nextValues.profileForm))
      }
    }, {
      deep: true
    })

    termsAccepted.value = true
    await nextTick()
    await nextTick()

    expect(termsAccepted.value).toBe(true)
    expect(values.termsAccepted).toBe(true)
    expect(formToModelSyncCount).toBe(1)
    expect(modelToFormSyncCount).toBe(2)
  })

  test('formats participant application statuses and summaries for reviewed states', () => {
    expect(formatParticipantApplicationStatus('submitted')).toBe('Submitted')
    expect(formatParticipantApplicationStatus('approved')).toBe('Approved')
    expect(formatParticipantApplicationStatus('rejected')).toBe('Rejected')
    expect(formatParticipantApplicationStatus('withdrawn')).toBe('Withdrawn')

    expect(getParticipantApplicationStatusColor('submitted')).toBe('warning')
    expect(getParticipantApplicationStatusColor('approved')).toBe('success')
    expect(getParticipantApplicationStatusColor('rejected')).toBe('error')
    expect(getParticipantApplicationStatusColor('withdrawn')).toBe('neutral')

    expect(summarizeParticipantApplicationStatus('submitted', 'registration_open', 'hackathon')).toContain('Team setup and project submission')
    expect(summarizeParticipantApplicationStatus('submitted', 'registration_open', 'build')).toContain('event participation status')
    expect(summarizeParticipantApplicationStatus('approved', 'registration_open', 'hackathon')).toContain('approved to create a team')
    expect(summarizeParticipantApplicationStatus('approved', 'registration_open', 'build')).toBe('You are approved for this event.')
    expect(summarizeParticipantApplicationStatus('rejected', 'registration_open', 'hackathon')).toContain('cannot submit another application')
    expect(summarizeParticipantApplicationStatus('withdrawn', 'registration_open', 'hackathon')).toContain('withdrew from this event')
  })

  test('resolves participant registration entry redirects by actor and state', () => {
    expect(resolveParticipantRegistrationEntry({
      actorKind: 'anonymous',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      to: '/auth/login?returnTo=%2Faccount%2Fregister%3FreturnTo%3D%252Fevents%252Fcodex-spring%252Fregister',
      external: true
    })

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'authenticated_identity',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      to: '/account/register?returnTo=%2Fevents%2Fcodex-spring%2Fregister',
      external: false
    })

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'blind_review',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      to: '/events/codex-spring',
      external: false
    })

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: true,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      to: '/account/events/codex-spring',
      external: false
    })

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toBeNull()

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      to: '/account/register?returnTo=%2Fevents%2Fcodex-spring%2Fregister',
      external: false
    })

    expect(resolveParticipantRegistrationEntry({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasExistingApplication: false,
      now: new Date('2026-03-23T12:00:00.000Z')
    })).toEqual({
      to: '/events/codex-spring',
      external: false
    })
  })

  test('keeps the public detail CTA as Register while registration is open', () => {
    expect(resolvePublicEventPrimaryAction({
      actorKind: 'anonymous',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: false,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      label: 'Register',
      to: '/auth/login?returnTo=%2Faccount%2Fregister%3FreturnTo%3D%252Fevents%252Fcodex-spring%252Fregister',
      external: true
    })

    expect(resolvePublicEventPrimaryAction({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: true,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      label: 'Register',
      to: '/events/codex-spring/register',
      external: false
    })

    expect(resolvePublicEventPrimaryAction({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: true,
      now: new Date('2026-03-21T12:00:00.000Z')
    })).toEqual({
      label: 'Register',
      to: '/account/register?returnTo=%2Fevents%2Fcodex-spring%2Fregister',
      external: false
    })
  })

  test('preserves the Talk proposal intent through registration and account setup', () => {
    const routeOptions = {
      eventSlug: 'codex-spring',
      eventState: 'registration_open' as const,
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      registrationIntent: 'talk-proposal' as const,
      now: new Date('2026-03-21T12:00:00.000Z')
    }

    expect(resolvePublicEventPrimaryAction({
      ...routeOptions,
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      hasEventWorkspaceAccess: false
    })).toMatchObject({
      to: '/events/codex-spring/register?intent=talk-proposal'
    })

    expect(resolveParticipantRegistrationEntry({
      ...routeOptions,
      actorKind: 'authenticated_identity',
      hasAcceptedCurrentPlatformDocuments: false,
      hasExistingApplication: false
    })).toEqual({
      to: '/account/register?returnTo=%2Fevents%2Fcodex-spring%2Fregister%3Fintent%3Dtalk-proposal',
      external: false
    })

    expect(resolveParticipantRegistrationEntry({
      ...routeOptions,
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      hasExistingApplication: true
    })).toEqual({
      to: '/account/events/codex-spring?tab=call-for-talks',
      external: false
    })
  })

  test('shows the public detail Open workspace CTA after registration closes when account access exists', () => {
    expect(resolvePublicEventPrimaryAction({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'blind_review',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: true,
      now: new Date('2026-03-24T12:00:00.000Z')
    })).toEqual({
      label: 'Open workspace',
      to: '/account/events/codex-spring',
      external: false
    })

    expect(resolvePublicEventPrimaryAction({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: true,
      eventSlug: 'codex-spring',
      eventState: 'blind_review',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: false,
      now: new Date('2026-03-24T12:00:00.000Z')
    })).toBeNull()

    expect(resolvePublicEventPrimaryAction({
      actorKind: 'platform_user',
      hasAcceptedCurrentPlatformDocuments: false,
      eventSlug: 'codex-spring',
      eventState: 'blind_review',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      hasEventWorkspaceAccess: true,
      now: new Date('2026-03-24T12:00:00.000Z')
    })).toEqual({
      label: 'Open workspace',
      to: '/account/register?returnTo=%2Faccount%2Fevents%2Fcodex-spring',
      external: false
    })
  })

  test('returns registration submission policy based on lifecycle, profile, and terms acceptance', () => {
    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: false,
      hasAcceptedCurrentTerms: false,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: true
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: true,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: true
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'submission_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: true,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: false,
      reason: 'Applications are closed for this event.'
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-23T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: true,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: false,
      reason: 'Applications are closed for this event.'
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 2,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: true,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: false,
      reason: 'Complete the required profile fields before submitting this application.'
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: false,
      requiresInPersonAttendanceCommitment: false,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: false,
      reason: 'Accept the current application terms before submitting.'
    })

    expect(getParticipantApplicationSubmissionPolicy({
      eventState: 'registration_open',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      now: new Date('2026-03-21T12:00:00.000Z'),
      applicationStatus: null,
      missingRequiredProfileFieldCount: 0,
      hasCurrentApplicationTerms: true,
      hasAcceptedCurrentTerms: true,
      requiresInPersonAttendanceCommitment: true,
      hasAcceptedInPersonAttendanceCommitment: false
    })).toEqual({
      isAllowed: false,
      reason: 'Confirm in-person attendance commitment before submitting this application.'
    })
  })

  test('parses persisted registration details JSON with fallback behavior', () => {
    expect(parseParticipantRegistrationDetailsJson(JSON.stringify({
      teamIntent: 'team',
      teamMembers: [
        {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com'
        }
      ],
      whyThisEvent: 'I want to build something useful.',
      proofOfExecutionUrl: 'https://github.com/example/project',
      aiKnowledgeLevel: 'advanced'
    }))).toEqual({
      teamIntent: 'team',
      teamMembers: [
        {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com'
        }
      ],
      inPersonAttendanceCommitment: false,
      whyThisEvent: 'I want to build something useful.',
      proofOfExecutionUrl: 'https://github.com/example/project',
      aiKnowledgeLevel: 'advanced'
    })

    expect(parseParticipantRegistrationDetailsJson('{invalid-json')).toEqual({
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })
  })
})
