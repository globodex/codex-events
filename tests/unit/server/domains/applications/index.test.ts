import { describe, expect, test } from 'vitest'

import { ApiError } from '../../../../../server/http/api-error'
import {
  assertApplicationWithdrawable,
  assertInPersonAttendanceCommitment,
  assertApplicationReviewable,
  assertEventAllowsApplications,
  isEventLumaAttendanceSyncEnabled,
  isEventLumaSyncEnabled,
  assertUserMeetsEventProfileRequirements,
  serializeUserApplication,
  serializeRegistrationDetailsJson
} from '../../../../../server/domains/applications'

describe('application utilities', () => {
  test('serializeUserApplication includes the user profile icon version when present', () => {
    expect(serializeUserApplication({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'submitted',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:10:00.000Z',
      withdrawnAt: null,
      checkedInAt: '2026-03-28T09:00:00.000Z',
      checkInOverrideStatus: null,
      checkInOverrideAt: null,
      checkInOverrideByUserId: null,
      certificateHiddenAt: null,
      certificateRevokedAt: '2026-03-29T09:00:00.000Z',
      certificateRevokedByUserId: 'admin_1',
      selectedTrackId: 'track_agents',
      reviewedAt: null,
      reviewedByUserId: null,
      applicationTermsDocumentId: 'terms_app_2',
      applicationTermsAcceptedAt: '2026-03-22T12:10:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[],"inPersonAttendanceCommitment":false,"whyThisEvent":"","proofOfExecutionUrl":""}',
      createdAt: '2026-03-22T12:10:00.000Z',
      updatedAt: '2026-03-22T12:10:00.000Z'
    }, {
      user: {
        id: 'user_1',
        auth0Subject: 'auth0|user_1',
        email: 'user@example.com',
        displayName: 'User',
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
        profileIconUpdatedAt: '2026-03-28T12:34:56.000Z',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
        deletedAt: null
      }
    })).toMatchObject({
      checkedInAt: '2026-03-28T09:00:00.000Z',
      certificateRevokedAt: '2026-03-29T09:00:00.000Z',
      selectedTrackId: 'track_agents',
      user: {
        id: 'user_1',
        profileIconUpdatedAt: '2026-03-28T12:34:56.000Z'
      }
    })
  })

  test('attendance sync requires a configured event Luma webhook', () => {
    expect(isEventLumaAttendanceSyncEnabled({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured'
    })).toBe(true)

    expect(isEventLumaAttendanceSyncEnabled({
      lumaEventApiId: '   ',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured'
    })).toBe(false)

    expect(isEventLumaAttendanceSyncEnabled({
      lumaEventApiId: null,
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured'
    })).toBe(false)

    expect(isEventLumaAttendanceSyncEnabled({
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'failed'
    })).toBe(false)
  })

  test('simplified claiming never enables approval or rejection sync', () => {
    expect(isEventLumaSyncEnabled({
      simplifiedClaimingEnabled: true,
      applicationLumaEmailVisible: true,
      requireLumaEmail: true,
      lumaEventApiId: 'evt-123',
      lumaApiKey: 'luma_test_key',
      lumaWebhookSecret: 'whsec_test',
      lumaWebhookStatus: 'configured'
    })).toBe(false)
  })

  test('applications can only be submitted while registration is open', () => {
    expect(() => assertEventAllowsApplications({
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
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
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, new Date('2026-03-21T12:00:00.000Z'))).not.toThrow()

    expect(() => assertEventAllowsApplications({
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'submission_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, new Date('2026-03-21T12:00:00.000Z'))).toThrowError(ApiError)

    expect(() => assertEventAllowsApplications({
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
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
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    }, new Date('2026-03-23T12:00:00.000Z'))).toThrowError(ApiError)
  })

  test('required profile flags are enforced against the user profile', () => {
    expect(() => assertUserMeetsEventProfileRequirements({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'user@example.com',
      displayName: 'User',
      isPlatformAdmin: false,
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      chatgptEmail: null,
      openaiOrgId: null,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
      deletedAt: null
    }, {
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      applicationXProfileVisible: true,
      applicationLinkedinProfileVisible: true,
      applicationGithubProfileVisible: true,
      applicationChatgptEmailVisible: true,
      applicationOpenaiOrgIdVisible: true,
      applicationLumaEmailVisible: true,
      requireXProfile: true,
      requireLinkedinProfile: false,
      requireGithubProfile: true,
      requireChatgptEmail: true,
      requireOpenaiOrgId: true,
      requireLumaEmail: false,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    })).toThrowError(ApiError)
  })

  test('luma email requirement applies whenever the event requires it', () => {
    expect(() => assertUserMeetsEventProfileRequirements({
      id: 'user_1',
      auth0Subject: 'auth0|user_1',
      email: 'user@example.com',
      displayName: 'User',
      isPlatformAdmin: false,
      xProfileUrl: null,
      linkedinProfileUrl: null,
      githubProfileUrl: null,
      chatgptEmail: null,
      openaiOrgId: null,
      lumaEmail: null,
      lumaUsername: null,
      profileIconUpdatedAt: null,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z',
      deletedAt: null
    }, {
      id: 'event_1',
      name: 'Fixture Event',
      slug: 'fixture-event',
      description: 'Fixture event',
      backgroundImageUrl: null,
      bannerImageUrl: null,
      lumaEventUrl: null,
      lumaEventApiId: null,
      city: 'Vienna',
      country: 'Austria',
      address: 'Fixture Address',
      registrationOpensAt: '2026-03-20T12:00:00.000Z',
      registrationClosesAt: '2026-03-23T12:00:00.000Z',
      submissionOpensAt: '2026-03-23T12:00:00.000Z',
      submissionClosesAt: '2026-03-25T12:00:00.000Z',
      state: 'registration_open',
      maxTeamMembers: 5,
      participantsLimit: null,
      inPersonEvent: false,
      applicationXProfileVisible: true,
      applicationLinkedinProfileVisible: true,
      applicationGithubProfileVisible: true,
      applicationChatgptEmailVisible: true,
      applicationOpenaiOrgIdVisible: true,
      applicationLumaEmailVisible: true,
      requireXProfile: false,
      requireLinkedinProfile: false,
      requireGithubProfile: false,
      requireChatgptEmail: false,
      requireOpenaiOrgId: false,
      requireLumaEmail: true,
      currentApplicationTermsDocumentId: null,
      currentWinnerTermsDocumentId: null,
      createdByUserId: 'creator_1',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T10:00:00.000Z'
    })).toThrowError(ApiError)
  })

  test('only submitted applications can be reviewed', () => {
    expect(() => assertApplicationReviewable({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'submitted',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })).not.toThrow()

    expect(() => assertApplicationReviewable({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'approved',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: '2026-03-22T12:05:00.000Z',
      reviewedByUserId: 'admin_1',
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:05:00.000Z'
    })).toThrowError(ApiError)
  })

  test('only submitted or approved applications can be withdrawn', () => {
    expect(() => assertApplicationWithdrawable({
      id: 'application_1',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'submitted',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z'
    })).not.toThrow()

    expect(() => assertApplicationWithdrawable({
      id: 'application_2',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'approved',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: '2026-03-22T12:05:00.000Z',
      reviewedByUserId: 'admin_1',
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:05:00.000Z'
    })).not.toThrow()

    expect(() => assertApplicationWithdrawable({
      id: 'application_3',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'rejected',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: null,
      reviewedAt: '2026-03-22T12:05:00.000Z',
      reviewedByUserId: 'admin_1',
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:05:00.000Z'
    })).toThrowError(ApiError)

    expect(() => assertApplicationWithdrawable({
      id: 'application_4',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'withdrawn',
      preApprovalStatus: null,
      lumaSyncStatus: null,
      submittedAt: '2026-03-22T12:00:00.000Z',
      withdrawnAt: '2026-03-23T12:00:00.000Z',
      reviewedAt: null,
      reviewedByUserId: null,
      applicationTermsDocumentId: 'terms_1',
      applicationTermsAcceptedAt: '2026-03-22T12:00:00.000Z',
      registrationDetailsJson: '{"teamIntent":"unknown","teamMembers":[]}',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-23T12:00:00.000Z'
    })).toThrowError(ApiError)
  })

  test('serializes registration details and enforces max team-member hints', () => {
    expect(serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 2,
      inPersonEvent: true,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: true,
      requireWhyThisEvent: true,
      requireProofOfExecution: true,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'team',
      registrationTeamMembers: [
        {
          fullName: ' Ada Lovelace ',
          email: 'ada@example.com'
        },
        {
          fullName: 'Grace Hopper',
          email: null
        }
      ],
      inPersonAttendanceCommitment: true,
      whyThisEvent: ' I have shipped similar projects before. ',
      proofOfExecutionUrl: ' https://github.com/example/shipped-work, https://demo.example.com/project ',
      aiKnowledgeLevel: 'intermediate'
    })).toBe(JSON.stringify({
      teamIntent: 'team',
      teamMembers: [
        {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com'
        },
        {
          fullName: 'Grace Hopper'
        }
      ],
      inPersonAttendanceCommitment: true,
      whyThisEvent: 'I have shipped similar projects before.',
      proofOfExecutionUrl: 'https://github.com/example/shipped-work, https://demo.example.com/project',
      aiKnowledgeLevel: 'intermediate'
    }))

    expect(() => serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 1,
      inPersonEvent: false,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'team',
      registrationTeamMembers: [
        {
          fullName: 'Ada Lovelace',
          email: null
        },
        {
          fullName: 'Grace Hopper',
          email: null
        }
      ],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)
  })

  test('enforces why-this-event and proof-of-execution requirements when configured', () => {
    expect(() => serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 4,
      inPersonEvent: false,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: true,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)

    expect(() => serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 4,
      inPersonEvent: false,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: true,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)
  })

  test('ignores hidden application fields during registration details serialization', () => {
    expect(serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 1,
      inPersonEvent: false,
      applicationWhyThisEventVisible: false,
      applicationProofOfExecutionVisible: false,
      applicationTeamIntentVisible: false,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'team',
      registrationTeamMembers: [
        {
          fullName: 'Ada Lovelace',
          email: 'ada@example.com'
        },
        {
          fullName: 'Grace Hopper',
          email: 'grace@example.com'
        }
      ],
      inPersonAttendanceCommitment: false,
      whyThisEvent: 'Hidden answer',
      proofOfExecutionUrl: 'ftp://example.com/project',
      aiKnowledgeLevel: 'advanced'
    })).toBe(JSON.stringify({
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    }))
  })

  test('rejects invalid visible AI Knowledge values while allowing an unselected value', () => {
    const event = {
      id: 'event_1',
      maxTeamMembers: 4,
      inPersonEvent: false,
      applicationWhyThisEventVisible: false,
      applicationProofOfExecutionVisible: false,
      applicationTeamIntentVisible: false,
      applicationAiKnowledgeVisible: true,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }

    expect(serializeRegistrationDetailsJson(event, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toBe(JSON.stringify({
      teamIntent: 'unknown',
      teamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    }))

    expect(() => serializeRegistrationDetailsJson(event, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: 'expert'
    })).toThrowError(ApiError)

    expect(() => serializeRegistrationDetailsJson({
      ...event,
      requireAiKnowledge: true
    }, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)
  })

  test('requires participation mode when configured', () => {
    expect(() => serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 4,
      inPersonEvent: false,
      applicationWhyThisEventVisible: false,
      applicationProofOfExecutionVisible: false,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: true,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: '',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)
  })

  test('rejects invalid proof-of-execution links', () => {
    expect(() => serializeRegistrationDetailsJson({
      id: 'event_1',
      maxTeamMembers: 4,
      inPersonEvent: false,
      applicationWhyThisEventVisible: true,
      applicationProofOfExecutionVisible: true,
      applicationTeamIntentVisible: true,
      applicationAiKnowledgeVisible: false,
      requireWhyThisEvent: false,
      requireProofOfExecution: false,
      requireTeamIntent: false,
      requireAiKnowledge: false
    }, {
      registrationTeamIntent: 'unknown',
      registrationTeamMembers: [],
      inPersonAttendanceCommitment: false,
      whyThisEvent: '',
      proofOfExecutionUrl: 'https://github.com/example/project, ftp://example.com/project',
      aiKnowledgeLevel: ''
    })).toThrowError(ApiError)
  })

  test('requires explicit in-person commitment only for in-person events', () => {
    expect(() => assertInPersonAttendanceCommitment({
      id: 'event_1',
      inPersonEvent: true
    }, {
      inPersonAttendanceCommitment: false
    })).toThrowError(ApiError)

    expect(() => assertInPersonAttendanceCommitment({
      id: 'event_1',
      inPersonEvent: true
    }, {
      inPersonAttendanceCommitment: true
    })).not.toThrow()

    expect(() => assertInPersonAttendanceCommitment({
      id: 'event_1',
      inPersonEvent: false
    }, {
      inPersonAttendanceCommitment: false
    })).not.toThrow()
  })
})
