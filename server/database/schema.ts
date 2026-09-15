import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'

const createId = () => crypto.randomUUID()
const currentTimestamp = sql`CURRENT_TIMESTAMP`

const idColumn = () => text('id').primaryKey().$defaultFn(createId)
const createdAtColumn = () => text('created_at').notNull().default(currentTimestamp)
const updatedAtColumn = () => text('updated_at').notNull().default(currentTimestamp)

export const eventStates = [
  'draft',
  'registration_open',
  'submission_open',
  'judging_preparation',
  'blind_review',
  'shortlist',
  'pitch',
  'pitch_review',
  'final_deliberation',
  'winners_announced',
  'completed'
] as const

export const eventTypes = ['hackathon', 'meetup', 'build'] as const
export const eventCreationFlows = ['classic', 'builder'] as const
export const eventLumaWebhookStatuses = ['not_configured', 'configured', 'failed'] as const
export const eventRoleTypes = ['event_admin', 'judge', 'staff'] as const
export const platformDocumentTypes = ['privacy_policy', 'platform_terms'] as const
export const eventTermsDocumentTypes = ['application_terms', 'winner_terms'] as const
export const userApplicationStatuses = ['submitted', 'approved', 'rejected', 'withdrawn'] as const
export const applicationCheckInOverrideStatuses = ['joined', 'not_joined'] as const
export const applicationCheckInSources = ['luma', 'simplified_claim'] as const
export const userApplicationPreApprovalStatuses = ['approved', 'rejected'] as const
export const userApplicationLumaSyncStatuses = [
  'not_synced',
  'approve_synced',
  'reject_synced',
  'approve_failed',
  'reject_failed'
] as const
export const teamWorkspaceModes = ['solo', 'team'] as const
export const teamMemberRoles = ['member', 'admin'] as const
export const teamJoinRequestStatuses = ['pending', 'approved', 'rejected', 'canceled'] as const
export const submissionStatuses = ['draft', 'submitted', 'withdrawn', 'locked', 'disqualified'] as const
export const talkProposalStatuses = ['draft', 'submitted', 'withdrawn', 'accepted', 'rejected'] as const
export const talkProposalDecisionEmailStates = ['pending', 'enqueued', 'delivering', 'retryable', 'sent', 'failed'] as const
export const judgeAssignmentStatuses = ['assigned', 'judge_started', 'judge_completed', 'skipped'] as const
export const ineligibilityStatuses = ['eligible', 'ineligible'] as const
export const prizeRewardTypes = ['api_credits', 'subscription', 'physical', 'other'] as const
export const prizeAwardScopes = ['team', 'member'] as const
export const prizeRedemptionStatuses = ['pending', 'redeemed', 'failed'] as const
export const eventOutcomeCacheCollections = ['winners', 'published_projects'] as const
export const mediaCleanupOutboxStatuses = ['pending', 'quarantined'] as const

export const users = sqliteTable(
  'users',
  {
    id: idColumn(),
    auth0Subject: text('auth0_subject').notNull(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    firstName: text('first_name').notNull().default(''),
    familyName: text('family_name').notNull().default(''),
    company: text('company'),
    bio: text('bio'),
    isPlatformAdmin: integer('is_platform_admin', { mode: 'boolean' }).notNull().default(false),
    isEventOrganizer: integer('is_event_organizer', { mode: 'boolean' }).notNull().default(false),
    xProfileUrl: text('x_profile_url'),
    linkedinProfileUrl: text('linkedin_profile_url'),
    githubProfileUrl: text('github_profile_url'),
    chatgptEmail: text('chatgpt_email'),
    openaiOrgId: text('openai_org_id'),
    lumaEmail: text('luma_email'),
    lumaUsername: text('luma_username'),
    profileIconUpdatedAt: text('profile_icon_updated_at'),
    profileIconObjectKey: text('profile_icon_object_key'),
    profileIconRevision: integer('profile_icon_revision').notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    deletedAt: text('deleted_at')
  },
  table => [
    uniqueIndex('users_auth0_subject_active_idx')
      .on(table.auth0Subject)
      .where(sql`${table.deletedAt} is null`),
    uniqueIndex('users_email_active_idx')
      .on(table.email)
      .where(sql`${table.deletedAt} is null`)
  ]
)

export const mcpAccessTokens = sqliteTable(
  'mcp_access_tokens',
  {
    id: idColumn(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    displayPrefix: text('display_prefix').notNull(),
    secretHash: text('secret_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    lastUsedAt: text('last_used_at'),
    revokedAt: text('revoked_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('mcp_access_tokens_secret_hash_idx').on(table.secretHash),
    index('mcp_access_tokens_user_created_idx').on(table.userId, table.createdAt),
    index('mcp_access_tokens_user_active_idx')
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`)
  ]
)

export const userAuthIdentities = sqliteTable(
  'user_auth_identities',
  {
    id: idColumn(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    auth0Subject: text('auth0_subject').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('user_auth_identities_auth0_subject_idx').on(table.auth0Subject),
    index('user_auth_identities_user_idx').on(table.userId)
  ]
)

export const events = sqliteTable(
  'events',
  {
    id: idColumn(),
    eventType: text('event_type', { enum: eventTypes }).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    agendaItemsJson: text('agenda_items_json').notNull().default('[]'),
    backgroundImageUrl: text('background_image_url'),
    backgroundImageObjectKey: text('background_image_object_key'),
    backgroundImageRevision: integer('background_image_revision').notNull().default(0),
    bannerImageUrl: text('banner_image_url'),
    bannerImageObjectKey: text('banner_image_object_key'),
    bannerImageRevision: integer('banner_image_revision').notNull().default(0),
    publicContentRevision: integer('public_content_revision').notNull().default(0),
    discordServerUrl: text('discord_server_url'),
    lumaEventUrl: text('luma_event_url'),
    slidesUrl: text('slides_url'),
    lumaEventApiId: text('luma_event_api_id'),
    lumaApiKey: text('luma_api_key'),
    lumaWebhookId: text('luma_webhook_id'),
    lumaWebhookSecret: text('luma_webhook_secret'),
    lumaWebhookStatus: text('luma_webhook_status', { enum: eventLumaWebhookStatuses }).notNull().default('not_configured'),
    lumaWebhookError: text('luma_webhook_error'),
    lumaWebhookRegisteredAt: text('luma_webhook_registered_at'),
    city: text('city').notNull(),
    country: text('country').notNull(),
    address: text('address').notNull(),
    registrationOpensAt: text('registration_opens_at').notNull(),
    registrationClosesAt: text('registration_closes_at').notNull(),
    submissionOpensAt: text('submission_opens_at'),
    submissionClosesAt: text('submission_closes_at'),
    talkProposalsEnabled: integer('talk_proposals_enabled', { mode: 'boolean' }).notNull().default(false),
    talkProposalOpensAt: text('talk_proposal_opens_at'),
    talkProposalClosesAt: text('talk_proposal_closes_at'),
    talkProposalQuestionsJson: text('talk_proposal_questions_json').notNull().default('[]'),
    talkProposalQuestionsRevision: integer('talk_proposal_questions_revision').notNull().default(0),
    state: text('state', { enum: eventStates }).notNull().default('draft'),
    hiddenAt: text('hidden_at'),
    hiddenByUserId: text('hidden_by_user_id').references(() => users.id),
    hiddenReason: text('hidden_reason'),
    blindReviewCount: integer('blind_review_count').notNull().default(1),
    pitchReviewEnabled: integer('pitch_review_enabled', { mode: 'boolean' }).notNull().default(false),
    blindScoreWeightPercent: integer('blind_score_weight_percent').notNull().default(70),
    pitchScoreWeightPercent: integer('pitch_score_weight_percent').notNull().default(30),
    shortlistFinalistCount: integer('shortlist_finalist_count').notNull().default(10),
    pitchFinalistSubmissionIdsJson: text('pitch_finalist_submission_ids_json').notNull().default('[]'),
    activePitchPresentationSubmissionId: text('active_pitch_presentation_submission_id'),
    pitchPresentationsCompletedAt: text('pitch_presentations_completed_at'),
    finalRankingSubmissionIdsJson: text('final_ranking_submission_ids_json').notNull().default('[]'),
    maxTeamMembers: integer('max_team_members').notNull(),
    participantsLimit: integer('participants_limit'),
    autoApproveApplications: integer('auto_approve_applications', { mode: 'boolean' }).notNull().default(false),
    simplifiedClaimingEnabled: integer('simplified_claiming_enabled', { mode: 'boolean' }).notNull().default(false),
    inPersonEvent: integer('in_person_event', { mode: 'boolean' }).notNull().default(false),
    applicationXProfileVisible: integer('application_x_profile_visible', { mode: 'boolean' }).notNull().default(true),
    applicationLinkedinProfileVisible: integer('application_linkedin_profile_visible', { mode: 'boolean' }).notNull().default(true),
    applicationGithubProfileVisible: integer('application_github_profile_visible', { mode: 'boolean' }).notNull().default(true),
    applicationChatgptEmailVisible: integer('application_chatgpt_email_visible', { mode: 'boolean' }).notNull().default(false),
    applicationOpenaiOrgIdVisible: integer('application_openai_org_id_visible', { mode: 'boolean' }).notNull().default(false),
    applicationLumaEmailVisible: integer('application_luma_email_visible', { mode: 'boolean' }).notNull().default(false),
    applicationWhyThisEventVisible: integer('application_why_this_event_visible', { mode: 'boolean' }).notNull().default(true),
    applicationProofOfExecutionVisible: integer('application_proof_of_execution_visible', { mode: 'boolean' }).notNull().default(true),
    applicationTeamIntentVisible: integer('application_team_intent_visible', { mode: 'boolean' }).notNull().default(true),
    applicationAiKnowledgeVisible: integer('application_ai_knowledge_visible', { mode: 'boolean' }).notNull().default(false),
    requireXProfile: integer('require_x_profile', { mode: 'boolean' }).notNull().default(false),
    requireLinkedinProfile: integer('require_linkedin_profile', { mode: 'boolean' }).notNull().default(false),
    requireGithubProfile: integer('require_github_profile', { mode: 'boolean' }).notNull().default(false),
    requireChatgptEmail: integer('require_chatgpt_email', { mode: 'boolean' }).notNull().default(false),
    requireOpenaiOrgId: integer('require_openai_org_id', { mode: 'boolean' }).notNull().default(false),
    requireLumaEmail: integer('require_luma_profile', { mode: 'boolean' }).notNull().default(false),
    requireWhyThisEvent: integer('require_why_this_event', { mode: 'boolean' }).notNull().default(false),
    requireProofOfExecution: integer('require_proof_of_execution', { mode: 'boolean' }).notNull().default(false),
    requireTeamIntent: integer('require_team_intent', { mode: 'boolean' }).notNull().default(false),
    requireAiKnowledge: integer('require_ai_knowledge', { mode: 'boolean' }).notNull().default(false),
    requireSubmissionSummary: integer('require_submission_summary', { mode: 'boolean' }).notNull().default(false),
    requireSubmissionRepositoryUrl: integer('require_submission_repository_url', { mode: 'boolean' }).notNull().default(false),
    requireSubmissionDemoUrl: integer('require_submission_demo_url', { mode: 'boolean' }).notNull().default(false),
    currentApplicationTermsDocumentId: text('current_application_terms_document_id'),
    currentWinnerTermsDocumentId: text('current_winner_terms_document_id'),
    creationFlow: text('creation_flow', { enum: eventCreationFlows }).notNull().default('classic'),
    balanceScore: integer('balance_score'),
    balanceBreakdownJson: text('balance_breakdown_json'),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('events_slug_idx').on(table.slug),
    uniqueIndex('events_luma_event_api_id_idx').on(table.lumaEventApiId),
    check(
      'events_blind_review_count_check',
      sql`${table.blindReviewCount} >= 0 and ${table.blindReviewCount} <= 2`
    ),
    check(
      'events_blind_score_weight_percent_check',
      sql`${table.blindScoreWeightPercent} >= 0 and ${table.blindScoreWeightPercent} <= 100`
    ),
    check(
      'events_pitch_score_weight_percent_check',
      sql`${table.pitchScoreWeightPercent} >= 0 and ${table.pitchScoreWeightPercent} <= 100`
    ),
    check(
      'events_judging_stage_enabled_check',
      sql`${table.eventType} != 'hackathon' or ${table.blindReviewCount} > 0 or ${table.pitchReviewEnabled} = 1`
    ),
    check(
      'events_combined_score_weight_percent_check',
      sql`${table.eventType} != 'hackathon'
        or ${table.blindReviewCount} = 0
        or ${table.pitchReviewEnabled} = 0
        or ${table.blindScoreWeightPercent} + ${table.pitchScoreWeightPercent} = 100`
    ),
    check('events_max_team_members_check', sql`${table.maxTeamMembers} >= 1`),
    check(
      'events_participants_limit_check',
      sql`${table.participantsLimit} is null or ${table.participantsLimit} >= 1`
    ),
    check(
      'events_schedule_order_check',
      sql`(
        ${table.eventType} = 'hackathon'
        and ${table.registrationOpensAt} < ${table.registrationClosesAt}
        and ${table.submissionOpensAt} is not null
        and ${table.submissionClosesAt} is not null
        and ${table.registrationClosesAt} <= ${table.submissionOpensAt}
        and ${table.submissionOpensAt} < ${table.submissionClosesAt}
      ) or (
        ${table.eventType} in ('meetup', 'build')
        and ${table.registrationOpensAt} < ${table.registrationClosesAt}
        and ${table.submissionOpensAt} is null
        and ${table.submissionClosesAt} is null
      )`
    ),
    check(
      'events_type_check',
      sql`${table.eventType} in ('hackathon', 'meetup', 'build')`
    ),
    check(
      'events_luma_webhook_status_check',
      sql`${table.lumaWebhookStatus} in ('not_configured', 'configured', 'failed')`
    )
  ]
)

export const eventTracks = sqliteTable(
  'event_tracks',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull(),
    fullDescription: text('full_description').notNull().default(''),
    staffInstructions: text('staff_instructions').notNull().default(''),
    resourcesJson: text('resources_json').notNull().default('[]'),
    displayOrder: integer('display_order').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('event_tracks_event_display_order_idx').on(table.eventId, table.displayOrder),
    index('event_tracks_event_idx').on(table.eventId)
  ]
)

export const eventPhotos = sqliteTable(
  'event_photos',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    uploadedByUserId: text('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    objectKey: text('object_key'),
    imageRevision: integer('image_revision').notNull().default(0),
    fileName: text('file_name'),
    isPubliclyVisible: integer('is_publicly_visible', { mode: 'boolean' }).notNull().default(false),
    isHighlighted: integer('is_highlighted', { mode: 'boolean' }).notNull().default(false),
    contentType: text('content_type').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    index('event_photos_event_created_idx').on(table.eventId, table.createdAt),
    index('event_photos_uploaded_by_idx').on(table.uploadedByUserId),
    check('event_photos_width_check', sql`${table.width} >= 1`),
    check('event_photos_height_check', sql`${table.height} >= 1`)
  ]
)

export const mediaCleanupOutbox = sqliteTable(
  'media_cleanup_outbox',
  {
    id: idColumn(),
    kind: text('kind').notNull(),
    objectKey: text('object_key').notNull(),
    status: text('status', { enum: mediaCleanupOutboxStatuses }).notNull().default('pending'),
    availableAt: text('available_at').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastAttemptedAt: text('last_attempted_at'),
    lastError: text('last_error'),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('media_cleanup_outbox_kind_object_idx').on(table.kind, table.objectKey),
    index('media_cleanup_outbox_available_idx').on(table.availableAt, table.createdAt),
    check(
      'media_cleanup_outbox_kind_check',
      sql`${table.kind} in ('event_image', 'event_photo', 'platform_default_event_background', 'profile_icon')`
    ),
    check('media_cleanup_outbox_status_check', sql`${table.status} in ('pending', 'quarantined')`),
    check('media_cleanup_outbox_attempt_count_check', sql`${table.attemptCount} >= 0`)
  ]
)

export const eventFeedback = sqliteTable(
  'event_feedback',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    foodRating: integer('food_rating'),
    staffRating: integer('staff_rating'),
    organizationRating: integer('organization_rating'),
    platformRating: integer('platform_rating'),
    judgesRating: integer('judges_rating'),
    venueRating: integer('venue_rating'),
    participantsCommunityRating: integer('participants_community_rating'),
    communicationBeforeRating: integer('communication_before_rating'),
    communicationDuringRating: integer('communication_during_rating'),
    rulesFairnessRating: integer('rules_fairness_rating'),
    overallExperienceRating: integer('overall_experience_rating'),
    schedulePacingRating: integer('schedule_pacing_rating'),
    technicalSetupRating: integer('technical_setup_rating'),
    safetyAccessibilityInclusionRating: integer('safety_accessibility_inclusion_rating'),
    outcomesRating: integer('outcomes_rating'),
    comment: text('comment'),
    createdAt: createdAtColumn()
  },
  table => [
    index('event_feedback_event_created_idx').on(table.eventId, table.createdAt),
    check(
      'event_feedback_food_rating_check',
      sql`${table.foodRating} is null or (${table.foodRating} >= 1 and ${table.foodRating} <= 5)`
    ),
    check(
      'event_feedback_staff_rating_check',
      sql`${table.staffRating} is null or (${table.staffRating} >= 1 and ${table.staffRating} <= 5)`
    ),
    check(
      'event_feedback_organization_rating_check',
      sql`${table.organizationRating} is null or (${table.organizationRating} >= 1 and ${table.organizationRating} <= 5)`
    ),
    check(
      'event_feedback_platform_rating_check',
      sql`${table.platformRating} is null or (${table.platformRating} >= 1 and ${table.platformRating} <= 5)`
    ),
    check(
      'event_feedback_judges_rating_check',
      sql`${table.judgesRating} is null or (${table.judgesRating} >= 1 and ${table.judgesRating} <= 5)`
    ),
    check(
      'event_feedback_venue_rating_check',
      sql`${table.venueRating} is null or (${table.venueRating} >= 1 and ${table.venueRating} <= 5)`
    ),
    check(
      'event_feedback_participants_community_rating_check',
      sql`${table.participantsCommunityRating} is null or (${table.participantsCommunityRating} >= 1 and ${table.participantsCommunityRating} <= 5)`
    ),
    check(
      'event_feedback_communication_before_rating_check',
      sql`${table.communicationBeforeRating} is null or (${table.communicationBeforeRating} >= 1 and ${table.communicationBeforeRating} <= 5)`
    ),
    check(
      'event_feedback_communication_during_rating_check',
      sql`${table.communicationDuringRating} is null or (${table.communicationDuringRating} >= 1 and ${table.communicationDuringRating} <= 5)`
    ),
    check(
      'event_feedback_rules_fairness_rating_check',
      sql`${table.rulesFairnessRating} is null or (${table.rulesFairnessRating} >= 1 and ${table.rulesFairnessRating} <= 5)`
    ),
    check(
      'event_feedback_overall_experience_rating_check',
      sql`${table.overallExperienceRating} is null or (${table.overallExperienceRating} >= 1 and ${table.overallExperienceRating} <= 5)`
    ),
    check(
      'event_feedback_schedule_pacing_rating_check',
      sql`${table.schedulePacingRating} is null or (${table.schedulePacingRating} >= 1 and ${table.schedulePacingRating} <= 5)`
    ),
    check(
      'event_feedback_technical_setup_rating_check',
      sql`${table.technicalSetupRating} is null or (${table.technicalSetupRating} >= 1 and ${table.technicalSetupRating} <= 5)`
    ),
    check(
      'event_feedback_safety_accessibility_inclusion_rating_check',
      sql`${table.safetyAccessibilityInclusionRating} is null or (${table.safetyAccessibilityInclusionRating} >= 1 and ${table.safetyAccessibilityInclusionRating} <= 5)`
    ),
    check(
      'event_feedback_outcomes_rating_check',
      sql`${table.outcomesRating} is null or (${table.outcomesRating} >= 1 and ${table.outcomesRating} <= 5)`
    )
  ]
)

export const eventRoleAssignments = sqliteTable(
  'event_role_assignments',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: eventRoleTypes }).notNull(),
    isInJudgePool: integer('is_in_judge_pool', { mode: 'boolean' }).notNull().default(false),
    isStaff: integer('is_staff', { mode: 'boolean' }).notNull().default(false),
    staffTrackId: text('staff_track_id').references(() => eventTracks.id, { onDelete: 'set null' }),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('event_role_assignments_event_user_idx').on(table.eventId, table.userId),
    index('event_role_assignments_user_created_idx').on(table.userId, table.createdAt),
    index('event_role_assignments_event_judge_pool_created_idx').on(
      table.eventId,
      table.isInJudgePool,
      table.createdAt
    ),
    check(
      'event_role_assignments_judge_pool_check',
      sql`(${table.role} != 'judge') or ((${table.isInJudgePool} = 1) and (${table.isStaff} = 0))`
    ),
    check(
      'event_role_assignments_staff_flag_check',
      sql`(${table.role} != 'staff') or ((${table.isStaff} = 1) and (${table.isInJudgePool} = 0))`
    ),
    check(
      'event_role_assignments_staff_track_check',
      sql`(${table.staffTrackId} is null) or (${table.isStaff} = 1)`
    )
  ]
)

export const platformDocuments = sqliteTable(
  'platform_documents',
  {
    id: idColumn(),
    documentType: text('document_type', { enum: platformDocumentTypes }).notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    publishedAt: text('published_at').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('platform_documents_type_version_idx').on(table.documentType, table.version)
  ]
)

export const platformLegalSettings = sqliteTable(
  'platform_legal_settings',
  {
    id: text('id').primaryKey(),
    supportEmail: text('support_email').notNull(),
    imprintContent: text('imprint_content').notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    check('platform_legal_settings_singleton_id_check', sql`${table.id} = 'default'`)
  ]
)

export const platformSettings = sqliteTable(
  'platform_settings',
  {
    id: text('id').primaryKey(),
    defaultEventBackgroundImageUrl: text('default_event_background_image_url'),
    defaultEventBackgroundImageObjectKey: text('default_event_background_image_object_key'),
    defaultEventBackgroundImageRevision: integer('default_event_background_image_revision').notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    check('platform_settings_singleton_id_check', sql`${table.id} = 'default'`)
  ]
)

export const userPlatformDocumentAcceptances = sqliteTable(
  'user_platform_document_acceptances',
  {
    id: idColumn(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    platformDocumentId: text('platform_document_id')
      .notNull()
      .references(() => platformDocuments.id),
    acceptedAt: text('accepted_at').notNull().default(currentTimestamp)
  },
  table => [
    uniqueIndex('user_platform_document_acceptances_user_document_idx').on(table.userId, table.platformDocumentId)
  ]
)

export const eventTermsDocuments = sqliteTable(
  'event_terms_documents',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    documentType: text('document_type', { enum: eventTermsDocumentTypes }).notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    publishedAt: text('published_at').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('event_terms_documents_event_type_version_idx').on(
      table.eventId,
      table.documentType,
      table.version
    )
  ]
)

export const eventAttendeeEligibilities = sqliteTable(
  'event_attendee_eligibilities',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    normalizedEmail: text('normalized_email').notNull(),
    firstName: text('first_name'),
    familyName: text('family_name'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('event_attendee_eligibilities_event_email_idx').on(
      table.eventId,
      table.normalizedEmail
    ),
    index('event_attendee_eligibilities_event_created_idx').on(table.eventId, table.createdAt)
  ]
)

export const userApplications = sqliteTable(
  'user_applications',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: userApplicationStatuses }).notNull().default('submitted'),
    preApprovalStatus: text('pre_approval_status', { enum: userApplicationPreApprovalStatuses }),
    lumaSyncStatus: text('luma_sync_status', { enum: userApplicationLumaSyncStatuses }),
    submittedAt: text('submitted_at').notNull().default(currentTimestamp),
    withdrawnAt: text('withdrawn_at'),
    checkedInAt: text('checked_in_at'),
    checkInSource: text('check_in_source', { enum: applicationCheckInSources }),
    checkInOverrideStatus: text('check_in_override_status', { enum: applicationCheckInOverrideStatuses }),
    checkInOverrideAt: text('check_in_override_at'),
    checkInOverrideByUserId: text('check_in_override_by_user_id').references(() => users.id),
    certificateHiddenAt: text('certificate_hidden_at'),
    certificateRevokedAt: text('certificate_revoked_at'),
    certificateRevokedByUserId: text('certificate_revoked_by_user_id').references(() => users.id),
    certificateEmailQueuedAt: text('certificate_email_queued_at'),
    certificateEmailQueuedByUserId: text('certificate_email_queued_by_user_id').references(() => users.id),
    certificateEmailSentAt: text('certificate_email_sent_at'),
    selectedTrackId: text('selected_track_id').references(() => eventTracks.id, { onDelete: 'set null' }),
    reviewedAt: text('reviewed_at'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
    applicationTermsDocumentId: text('application_terms_document_id')
      .references(() => eventTermsDocuments.id),
    applicationTermsAcceptedAt: text('application_terms_accepted_at'),
    registrationDetailsJson: text('registration_details_json')
      .notNull()
      .default('{"teamIntent":"unknown","teamMembers":[],"inPersonAttendanceCommitment":false,"whyThisEvent":"","proofOfExecutionUrl":"","aiKnowledgeLevel":""}'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('user_applications_event_user_idx').on(table.eventId, table.userId),
    index('user_applications_user_submitted_idx').on(table.userId, table.submittedAt),
    index('user_applications_event_submitted_idx').on(table.eventId, table.submittedAt),
    index('user_applications_event_status_submitted_idx').on(table.eventId, table.status, table.submittedAt),
    index('user_applications_event_selected_track_idx').on(table.eventId, table.selectedTrackId)
  ]
)

export const talkProposals = sqliteTable(
  'talk_proposals',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: talkProposalStatuses }).notNull().default('draft'),
    title: text('title').notNull(),
    abstract: text('abstract').notNull(),
    demoOrSlidesUrl: text('demo_or_slides_url'),
    questionSetRevision: integer('question_set_revision').notNull().default(0),
    answersJson: text('answers_json').notNull().default('[]'),
    decisionMessage: text('decision_message'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: text('submitted_at'),
    withdrawnAt: text('withdrawn_at'),
    revisedAt: text('revised_at'),
    decidedAt: text('decided_at'),
    decisionEmailDeliveryId: text('decision_email_delivery_id'),
    decisionEmailState: text('decision_email_state', { enum: talkProposalDecisionEmailStates }),
    decisionEmailEnqueueAttempts: integer('decision_email_enqueue_attempts').notNull().default(0),
    decisionEmailLastEnqueueAttemptedAt: text('decision_email_last_enqueue_attempted_at'),
    decisionEmailEnqueueLeaseToken: text('decision_email_enqueue_lease_token'),
    decisionEmailEnqueueLeaseExpiresAt: text('decision_email_enqueue_lease_expires_at'),
    decisionEmailQueuedAt: text('decision_email_queued_at'),
    decisionEmailDeliveryAttempts: integer('decision_email_delivery_attempts').notNull().default(0),
    decisionEmailDeliveryLeaseToken: text('decision_email_delivery_lease_token'),
    decisionEmailDeliveryLeaseExpiresAt: text('decision_email_delivery_lease_expires_at'),
    decisionEmailLastFailureCode: text('decision_email_last_failure_code'),
    decisionEmailLastAttemptedAt: text('decision_email_last_attempted_at'),
    decisionEmailSentAt: text('decision_email_sent_at'),
    decisionEmailFailedAt: text('decision_email_failed_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('talk_proposals_event_user_idx').on(table.eventId, table.userId),
    uniqueIndex('talk_proposals_decision_email_delivery_idx').on(table.decisionEmailDeliveryId),
    index('talk_proposals_event_status_submitted_idx').on(table.eventId, table.status, table.submittedAt),
    index('talk_proposals_event_updated_idx').on(table.eventId, table.updatedAt),
    index('talk_proposals_decision_email_recovery_idx').on(
      table.decisionEmailState,
      table.decisionEmailEnqueueLeaseExpiresAt,
      table.updatedAt
    ),
    check(
      'talk_proposals_status_check',
      sql`${table.status} in ('draft', 'submitted', 'withdrawn', 'accepted', 'rejected')`
    ),
    check(
      'talk_proposals_decision_email_state_check',
      sql`${table.decisionEmailState} is null or ${table.decisionEmailState} in ('pending', 'enqueued', 'delivering', 'retryable', 'sent', 'failed')`
    )
  ]
)

export const teams = sqliteTable(
  'teams',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    name: text('name').notNull(),
    bio: text('bio'),
    slug: text('slug').notNull(),
    workspaceMode: text('workspace_mode', { enum: teamWorkspaceModes }).notNull().default('team'),
    isOpenToJoinRequests: integer('is_open_to_join_requests', { mode: 'boolean' }).notNull().default(true),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('teams_event_slug_idx').on(table.eventId, table.slug),
    index('teams_event_idx').on(table.eventId),
    index('teams_event_name_created_idx').on(table.eventId, table.name, table.createdAt)
  ]
)

export const teamMembers = sqliteTable(
  'team_members',
  {
    id: idColumn(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: teamMemberRoles }).notNull().default('member'),
    joinedAt: text('joined_at').notNull().default(currentTimestamp),
    leftAt: text('left_at'),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('team_members_team_user_active_idx')
      .on(table.teamId, table.userId)
      .where(sql`${table.leftAt} is null`),
    index('team_members_user_idx').on(table.userId),
    index('team_members_user_active_joined_idx')
      .on(table.userId, table.joinedAt, table.createdAt)
      .where(sql`${table.leftAt} is null`),
    index('team_members_team_active_joined_idx')
      .on(table.teamId, table.joinedAt, table.createdAt)
      .where(sql`${table.leftAt} is null`)
  ]
)

export const teamJoinRequests = sqliteTable(
  'team_join_requests',
  {
    id: idColumn(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: teamJoinRequestStatuses }).notNull().default('pending'),
    requestedAt: text('requested_at').notNull().default(currentTimestamp),
    reviewedAt: text('reviewed_at'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('team_join_requests_pending_team_user_idx')
      .on(table.teamId, table.userId)
      .where(sql`${table.status} = 'pending'`)
  ]
)

export const submissions = sqliteTable(
  'submissions',
  {
    id: idColumn(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id),
    trackId: text('track_id').references(() => eventTracks.id),
    status: text('status', { enum: submissionStatuses }).notNull().default('draft'),
    projectName: text('project_name'),
    summary: text('summary'),
    repositoryUrl: text('repository_url'),
    demoUrl: text('demo_url'),
    isPubliclyVisible: integer('is_publicly_visible', { mode: 'boolean' }).notNull().default(false),
    submittedAt: text('submitted_at'),
    lockedAt: text('locked_at'),
    withdrawnAt: text('withdrawn_at'),
    disqualifiedAt: text('disqualified_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    uniqueIndex('submissions_active_team_idx')
      .on(table.teamId)
      .where(sql`${table.status} in ('draft', 'submitted', 'locked')`),
    index('submissions_team_updated_idx').on(table.teamId, table.updatedAt),
    index('submissions_team_status_created_idx').on(table.teamId, table.status, table.createdAt),
    index('submissions_public_status_team_idx').on(table.isPubliclyVisible, table.status, table.teamId),
    index('submissions_track_idx').on(table.trackId)
  ]
)

export const evaluationCriteria = sqliteTable(
  'evaluation_criteria',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    weight: integer('weight').notNull(),
    displayOrder: integer('display_order').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('evaluation_criteria_event_display_order_idx').on(table.eventId, table.displayOrder),
    check('evaluation_criteria_weight_non_negative_check', sql`${table.weight} >= 0`)
  ]
)

export const judgeAssignments = sqliteTable(
  'judge_assignments',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id),
    judgeUserId: text('judge_user_id')
      .notNull()
      .references(() => users.id),
    reviewStage: text('review_stage', { enum: ['blind_review', 'pitch_review'] }).notNull().default('blind_review'),
    blindReviewSlot: integer('blind_review_slot').default(1),
    status: text('status', { enum: judgeAssignmentStatuses }).notNull().default('assigned'),
    pitchScore: integer('pitch_score'),
    pitchComment: text('pitch_comment'),
    assignedAt: text('assigned_at').notNull().default(currentTimestamp),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    skippedAt: text('skipped_at'),
    skippedByUserId: text('skipped_by_user_id').references(() => users.id),
    skipReason: text('skip_reason'),
    ineligibilityStatus: text('ineligibility_status', { enum: ineligibilityStatuses }).notNull().default('eligible'),
    ineligibilityReason: text('ineligibility_reason'),
    ineligibilityMarkedAt: text('ineligibility_marked_at'),
    ineligibilityMarkedByUserId: text('ineligibility_marked_by_user_id').references(() => users.id),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('judge_assignments_active_blind_submission_slot_idx')
      .on(table.submissionId, table.blindReviewSlot)
      .where(sql`${table.reviewStage} = 'blind_review' and ${table.status} in ('assigned', 'judge_started')`),
    uniqueIndex('judge_assignments_pitch_submission_judge_idx')
      .on(table.submissionId, table.judgeUserId)
      .where(sql`${table.reviewStage} = 'pitch_review'`),
    index('judge_assignments_judge_idx').on(table.judgeUserId),
    index('judge_assignments_event_stage_status_judge_idx').on(
      table.eventId,
      table.reviewStage,
      table.status,
      table.judgeUserId
    ),
    index('judge_assignments_event_submission_stage_status_idx').on(
      table.eventId,
      table.submissionId,
      table.reviewStage,
      table.status
    ),
    check(
      'judge_assignments_stage_shape_check',
      sql`(${table.reviewStage} = 'blind_review'
          and ${table.blindReviewSlot} in (1, 2)
          and ${table.pitchScore} is null
          and ${table.pitchComment} is null)
        or (${table.reviewStage} = 'pitch_review'
          and ${table.blindReviewSlot} is null)`
    ),
    check(
      'judge_assignments_pitch_score_range_check',
      sql`${table.pitchScore} is null or (${table.pitchScore} >= 1 and ${table.pitchScore} <= 5)`
    )
  ]
)

export const judgeCriterionScores = sqliteTable(
  'judge_criterion_scores',
  {
    id: idColumn(),
    judgeAssignmentId: text('judge_assignment_id')
      .notNull()
      .references(() => judgeAssignments.id),
    evaluationCriterionId: text('evaluation_criterion_id')
      .notNull()
      .references(() => evaluationCriteria.id),
    score: integer('score').notNull(),
    comment: text('comment'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    check('judge_criterion_scores_score_range_check', sql`${table.score} >= 1 and ${table.score} <= 5`),
    uniqueIndex('judge_criterion_scores_assignment_criterion_idx').on(
      table.judgeAssignmentId,
      table.evaluationCriterionId
    ),
    index('judge_criterion_scores_assignment_created_idx').on(table.judgeAssignmentId, table.createdAt)
  ]
)

export const prizes = sqliteTable(
  'prizes',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    rewardType: text('reward_type', { enum: prizeRewardTypes }).notNull(),
    rewardValue: text('reward_value').notNull(),
    rewardCurrency: text('reward_currency'),
    awardScope: text('award_scope', { enum: prizeAwardScopes }).notNull(),
    rankStart: integer('rank_start').notNull(),
    rankEnd: integer('rank_end').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAtColumn()
  },
  table => [
    index('prizes_event_display_order_idx').on(table.eventId, table.displayOrder),
    check('prizes_rank_order_check', sql`${table.rankStart} <= ${table.rankEnd}`)
  ]
)

export const eventCreditOffers = sqliteTable(
  'event_credit_offers',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    simplifiedClaimingOnly: integer('simplified_claiming_only', { mode: 'boolean' }).notNull().default(false),
    redirectOnClaim: integer('redirect_on_claim', { mode: 'boolean' }).notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    index('event_credit_offers_event_display_order_idx').on(table.eventId, table.displayOrder),
    uniqueIndex('event_credit_offers_redirect_event_idx')
      .on(table.eventId)
      .where(sql`${table.redirectOnClaim} = true`)
  ]
)

export const eventCreditCodes = sqliteTable(
  'event_credit_codes',
  {
    id: idColumn(),
    creditOfferId: text('credit_offer_id')
      .notNull()
      .references(() => eventCreditOffers.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    claimedByUserId: text('claimed_by_user_id').references(() => users.id),
    claimedAttendeeEligibilityId: text('claimed_attendee_eligibility_id')
      .references(() => eventAttendeeEligibilities.id),
    claimedAt: text('claimed_at'),
    createdAt: createdAtColumn()
  },
  table => [
    index('event_credit_codes_offer_claim_state_idx').on(
      table.creditOfferId,
      table.claimedByUserId,
      table.createdAt
    ),
    uniqueIndex('event_credit_codes_offer_claimed_user_idx')
      .on(table.creditOfferId, table.claimedByUserId)
      .where(sql`${table.claimedByUserId} is not null`),
    uniqueIndex('event_credit_codes_claimed_attendee_eligibility_idx')
      .on(table.claimedAttendeeEligibilityId, table.creditOfferId)
      .where(sql`${table.claimedAttendeeEligibilityId} is not null`)
  ]
)

export const prizeEligibilitySnapshots = sqliteTable(
  'prize_eligibility_snapshots',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    snapshotAt: text('snapshot_at').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    index('prize_eligibility_snapshots_event_user_team_idx').on(
      table.eventId,
      table.userId,
      table.teamId
    ),
    index('prize_eligibility_snapshots_event_team_created_idx').on(
      table.eventId,
      table.teamId,
      table.createdAt
    ),
    uniqueIndex('prize_eligibility_snapshots_event_team_user_idx').on(
      table.eventId,
      table.teamId,
      table.userId
    )
  ]
)

export const prizeRedemptions = sqliteTable(
  'prize_redemptions',
  {
    id: idColumn(),
    prizeId: text('prize_id')
      .notNull()
      .references(() => prizes.id),
    userId: text('user_id').references(() => users.id),
    teamId: text('team_id').references(() => teams.id),
    status: text('status', { enum: prizeRedemptionStatuses }).notNull().default('pending'),
    legalName: text('legal_name'),
    winnerTermsDocumentId: text('winner_terms_document_id').references(() => eventTermsDocuments.id),
    winnerTermsAcceptedAt: text('winner_terms_accepted_at'),
    redeemedAt: text('redeemed_at'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn()
  },
  table => [
    index('prize_redemptions_prize_created_idx').on(table.prizeId, table.createdAt),
    index('prize_redemptions_team_idx').on(table.teamId),
    index('prize_redemptions_pending_user_created_idx')
      .on(table.userId, table.createdAt)
      .where(sql`${table.status} = 'pending' and ${table.userId} is not null`),
    index('prize_redemptions_pending_team_created_idx')
      .on(table.teamId, table.createdAt)
      .where(sql`${table.status} = 'pending' and ${table.teamId} is not null and ${table.userId} is null`)
  ]
)

export const eventOutcomeCaches = sqliteTable(
  'event_outcome_caches',
  {
    eventId: text('event_id')
      .primaryKey()
      .references(() => events.id, { onDelete: 'cascade' }),
    generationId: text('generation_id').notNull(),
    generatedAt: text('generated_at').notNull(),
    updatedAt: updatedAtColumn()
  },
  table => [
    index('event_outcome_caches_updated_idx').on(table.updatedAt)
  ]
)

export const eventOutcomeCacheEntries = sqliteTable(
  'event_outcome_cache_entries',
  {
    id: idColumn(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    generationId: text('generation_id').notNull(),
    collection: text('collection', { enum: eventOutcomeCacheCollections }).notNull(),
    displayOrder: integer('display_order').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: createdAtColumn()
  },
  table => [
    uniqueIndex('event_outcome_cache_entries_generation_order_idx').on(
      table.eventId,
      table.generationId,
      table.collection,
      table.displayOrder
    ),
    index('event_outcome_cache_entries_event_generation_idx').on(
      table.eventId,
      table.generationId
    )
  ]
)

export type AuditMetadataScalar = string | number | boolean | null
export type AuditMetadataLevelOne = AuditMetadataScalar | AuditMetadataScalar[] | Record<string, AuditMetadataScalar>
export type AuditMetadataLevelTwo = AuditMetadataScalar | AuditMetadataLevelOne[] | Record<string, AuditMetadataLevelOne>
export type AuditMetadataValue = AuditMetadataScalar | AuditMetadataLevelTwo[] | Record<string, AuditMetadataLevelTwo>
export type AuditMetadata = Record<string, AuditMetadataValue>

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: idColumn(),
    actorUserId: text('actor_user_id').references(() => users.id),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    metadata: text('metadata', { mode: 'json' })
      .$type<AuditMetadata>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: createdAtColumn()
  },
  table => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_actor_idx').on(table.actorUserId),
    index('audit_logs_created_idx').on(table.createdAt),
    index('audit_logs_entity_created_idx').on(table.entityType, table.entityId, table.createdAt),
    index('audit_logs_submission_disqualified_created_idx')
      .on(table.entityType, table.action, table.entityId, table.createdAt)
      .where(sql`${table.entityType} = 'submission' and ${table.action} = 'submission.disqualified'`),
    index('audit_logs_metadata_event_created_idx').on(
      sql`json_extract(${table.metadata}, '$.eventId')`,
      table.createdAt
    )
  ]
)

export const schema = {
  users,
  mcpAccessTokens,
  userAuthIdentities,
  events,
  eventTracks,
  eventFeedback,
  eventRoleAssignments,
  platformDocuments,
  platformLegalSettings,
  userPlatformDocumentAcceptances,
  eventTermsDocuments,
  eventAttendeeEligibilities,
  userApplications,
  talkProposals,
  teams,
  teamMembers,
  teamJoinRequests,
  submissions,
  evaluationCriteria,
  judgeAssignments,
  judgeCriterionScores,
  eventCreditOffers,
  eventCreditCodes,
  prizes,
  prizeEligibilitySnapshots,
  prizeRedemptions,
  eventOutcomeCaches,
  eventOutcomeCacheEntries,
  auditLogs
}

export type Schema = typeof schema
