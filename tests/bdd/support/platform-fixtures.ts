import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { StablePersona } from './personas.ts'

import { resolveLocalBddD1StateRoot } from './local-d1-state.ts'

const localWranglerConfigPath = resolve(process.cwd(), 'wrangler.jsonc')

function resolveLocalPlatformPersistPath(environment: NodeJS.ProcessEnv) {
  return resolve(resolveLocalBddD1StateRoot(environment), 'v3')
}

const fixtureAnchorTimestamp = '2026-03-22T12:00:00.000Z'
const fixtureTimeShiftMs = Date.now() - Date.parse(fixtureAnchorTimestamp)
const shiftableFixtureIsoPattern = /\b2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z\b/g
const fixtureTimestamp = shiftFixtureTimestamp(fixtureAnchorTimestamp)

function shiftFixtureTimestamp(isoTimestamp: string) {
  return new Date(Date.parse(isoTimestamp) + fixtureTimeShiftMs).toISOString()
}

function shiftFixtureIsoLiterals(sql: string) {
  return sql.replace(shiftableFixtureIsoPattern, isoTimestamp => shiftFixtureTimestamp(isoTimestamp))
}
export const fixtureEventId = 'event_e2e_fixture'
export const fixtureDraftEventId = 'event_e2e_draft_fixture'
const fixtureDraftLumaEventUrl = 'https://luma.com/a4i7qtbo'
const fixtureParticipantApplicationEventId = 'event_e2e_participant_application_fixture'
const fixtureApiTeamFormationEventId = 'event_e2e_api_team_formation_fixture'
const fixtureParticipantProfileRequirementEventId = 'event_e2e_participant_profile_requirement_fixture'
const fixtureParticipantApprovedEventId = 'event_e2e_participant_approved_fixture'
const fixtureParticipantRejectedEventId = 'event_e2e_participant_rejected_fixture'
export const fixtureSimplifiedClaimingEventId = 'event_e2e_simplified_claiming_fixture'
const fixtureClosedSimplifiedClaimingEventId = 'event_e2e_closed_simplified_claiming_fixture'
const fixtureParticipantTeamCreateEventId = 'event_e2e_participant_team_create_fixture'
const fixtureParticipantTeamJoinEventId = 'event_e2e_participant_team_join_fixture'
const fixtureParticipantTeamSoloEventId = 'event_e2e_participant_team_solo_fixture'
const fixtureApiSoloTeamEventId = 'event_e2e_api_solo_team_fixture'
const fixtureParticipantSubmissionCreateEventId = 'event_e2e_participant_submission_create_fixture'
const fixtureParticipantSubmissionLockedEventId = 'event_e2e_participant_submission_locked_fixture'
const fixturePrizeWorkspaceEventId = 'event_e2e_prize_workspace_fixture'
export const fixtureOperationsEventId = 'event_e2e_operations_fixture'
export const fixtureJudgingEventId = 'event_e2e_judging_fixture'
export const fixtureJudgeWorkspaceEventId = 'event_e2e_judge_workspace_fixture'
export const fixtureOutcomesEventId = 'event_e2e_outcomes_fixture'
const fixtureCompetitionReassignEventId = 'event_e2e_competition_reassign_fixture'
const fixtureCompetitionForceSkipEventId = 'event_e2e_competition_force_skip_fixture'
const fixtureCompetitionShortlistEventId = 'event_e2e_competition_shortlist_fixture'
const fixtureCompetitionCompleteEventId = 'event_e2e_competition_complete_fixture'
export const fixturePublicOverflowEventId = 'event_e2e_public_overflow_fixture'
export const fixturePublicArchiveEventId = 'event_e2e_public_archive_fixture'
export const fixtureApplicationTermsId = 'event_terms_application_fixture'
const fixtureParticipantApplicationTermsId = 'event_terms_application_participant_fixture'
const fixtureApiTeamFormationTermsId = 'event_terms_application_api_team_formation_fixture'
const fixtureParticipantProfileRequirementTermsId = 'event_terms_application_participant_profile_requirement_fixture'
const fixtureParticipantApprovedTermsId = 'event_terms_application_participant_approved_fixture'
const fixtureParticipantRejectedTermsId = 'event_terms_application_participant_rejected_fixture'
const fixtureParticipantTeamCreateTermsId = 'event_terms_application_participant_team_create_fixture'
const fixtureParticipantTeamJoinTermsId = 'event_terms_application_participant_team_join_fixture'
const fixtureParticipantTeamSoloTermsId = 'event_terms_application_participant_team_solo_fixture'
const fixtureApiSoloTeamTermsId = 'event_terms_application_api_solo_team_fixture'
const fixtureParticipantSubmissionCreateTermsId = 'event_terms_application_participant_submission_create_fixture'
const fixtureParticipantSubmissionLockedTermsId = 'event_terms_application_participant_submission_locked_fixture'
const fixturePrizeWorkspaceApplicationTermsId = 'event_terms_application_prize_workspace_fixture'
export const fixtureOperationsApplicationTermsId = 'event_terms_application_operations_fixture'
export const fixtureWinnerTermsId = 'event_terms_winner_fixture'
const fixturePrizeWorkspaceWinnerTermsId = 'event_terms_winner_prize_workspace_fixture'
export const fixtureJudgingApplicationTermsId = 'event_terms_application_judging_fixture'
export const fixtureJudgeWorkspaceApplicationTermsId = 'event_terms_application_judge_workspace_fixture'
export const fixtureOutcomesWinnerTermsId = 'event_terms_winner_outcomes_fixture'
const fixtureCompetitionShortlistWinnerTermsId = 'event_terms_winner_competition_shortlist_fixture'
const fixtureCompetitionCompleteWinnerTermsId = 'event_terms_winner_competition_complete_fixture'
export const fixturePrivacyDocumentId = 'platform_document_privacy_fixture'
export const fixtureTermsDocumentId = 'platform_document_terms_fixture'
export const fixtureJudgingAssignmentId = 'judge_assignment_e2e_fixture'
export const fixtureJudgingStartedAssignmentId = 'judge_assignment_e2e_started_fixture'
export const fixtureJudgeWorkspaceAssignmentId = 'judge_workspace_assignment_e2e_fixture'
export const fixtureJudgeWorkspaceStartedAssignmentId = 'judge_workspace_assignment_e2e_started_fixture'
export const fixtureJudgingCriterionOneId = 'evaluation_criterion_e2e_judging_novelty'
export const fixtureJudgingCriterionTwoId = 'evaluation_criterion_e2e_judging_execution'
export const fixtureJudgeWorkspaceCriterionOneId = 'evaluation_criterion_e2e_workspace_clarity'
export const fixtureJudgeWorkspaceCriterionTwoId = 'evaluation_criterion_e2e_workspace_impact'
export const fixturePublicCriterionOneId = 'evaluation_criterion_e2e_public_impact'
export const fixturePublicCriterionTwoId = 'evaluation_criterion_e2e_public_craft'
export const fixtureOutcomesSubmissionOneId = 'submission_outcomes_fixture_one'
export const fixtureOutcomesSubmissionTwoId = 'submission_outcomes_fixture_two'
const fixtureCompetitionReassignSubmissionId = 'submission_competition_reassign_fixture'
const fixtureCompetitionForceSkipSubmissionId = 'submission_competition_force_skip_fixture'
const fixtureCompetitionShortlistSubmissionOneId = 'submission_competition_shortlist_fixture_one'
const fixtureCompetitionShortlistSubmissionTwoId = 'submission_competition_shortlist_fixture_two'
const fixtureCompetitionCompleteSubmissionOneId = 'submission_competition_complete_fixture_one'
const fixtureCompetitionCompleteSubmissionTwoId = 'submission_competition_complete_fixture_two'
export const fixturePublicPrizeId = 'prize_e2e_public_launch_award'
const fixturePrizeWorkspacePrizeId = 'prize_prize_workspace_fixture_team_rank_1'
export const fixtureOutcomesTeamRedemptionPrizeId = 'prize_outcomes_fixture_team_rank_1'
export const fixtureOutcomesMemberRedemptionPrizeId = 'prize_outcomes_fixture_member_top_2'
const fixtureCompetitionShortlistPrizeId = 'prize_competition_shortlist_rank_1'
const fixtureCompetitionCompletePrizeId = 'prize_competition_complete_rank_1'
const fixturePrizeWorkspaceRedemptionId = 'redemption_prize_workspace_fixture_team'
const fixtureCompetitionCompleteRedemptionId = 'redemption_competition_complete_fixture_team'
const fixtureCompetitionShortlistCriterionOneId = 'evaluation_criterion_competition_shortlist_novelty'
const fixtureCompetitionShortlistCriterionTwoId = 'evaluation_criterion_competition_shortlist_execution'
const fixtureCompetitionCompleteCriterionOneId = 'evaluation_criterion_competition_complete_novelty'
const fixtureCompetitionCompleteCriterionTwoId = 'evaluation_criterion_competition_complete_execution'

export const platformFixtureIds = {
  eventId: fixtureEventId,
  apiTeamFormationEventId: fixtureApiTeamFormationEventId,
  apiSoloTeamEventId: fixtureApiSoloTeamEventId,
  participantApplicationEventId: fixtureParticipantApplicationEventId,
  participantProfileRequirementEventId: fixtureParticipantProfileRequirementEventId,
  participantApprovedEventId: fixtureParticipantApprovedEventId,
  participantRejectedEventId: fixtureParticipantRejectedEventId,
  simplifiedClaimingEventId: fixtureSimplifiedClaimingEventId,
  draftEventId: fixtureDraftEventId,
  operationsEventId: fixtureOperationsEventId,
  judgingEventId: fixtureJudgingEventId,
  judgeWorkspaceEventId: fixtureJudgeWorkspaceEventId,
  outcomesEventId: fixtureOutcomesEventId,
  prizeWorkspaceEventId: fixturePrizeWorkspaceEventId,
  competitionReassignEventId: fixtureCompetitionReassignEventId,
  competitionForceSkipEventId: fixtureCompetitionForceSkipEventId,
  competitionShortlistEventId: fixtureCompetitionShortlistEventId,
  competitionCompleteEventId: fixtureCompetitionCompleteEventId,
  publicOverflowEventId: fixturePublicOverflowEventId,
  publicArchiveEventId: fixturePublicArchiveEventId,
  applicationTermsDocumentId: fixtureApplicationTermsId,
  apiTeamFormationApplicationTermsDocumentId: fixtureApiTeamFormationTermsId,
  participantApplicationTermsDocumentId: fixtureParticipantApplicationTermsId,
  participantProfileRequirementTermsDocumentId: fixtureParticipantProfileRequirementTermsId,
  operationsApplicationTermsDocumentId: fixtureOperationsApplicationTermsId,
  judgingApplicationTermsDocumentId: fixtureJudgingApplicationTermsId,
  judgeWorkspaceApplicationTermsDocumentId: fixtureJudgeWorkspaceApplicationTermsId,
  prizeWorkspaceApplicationTermsDocumentId: fixturePrizeWorkspaceApplicationTermsId,
  winnerTermsDocumentId: fixtureWinnerTermsId,
  prizeWorkspaceWinnerTermsDocumentId: fixturePrizeWorkspaceWinnerTermsId,
  outcomesWinnerTermsDocumentId: fixtureOutcomesWinnerTermsId,
  privacyDocumentId: fixturePrivacyDocumentId,
  platformTermsDocumentId: fixtureTermsDocumentId,
  judgingAssignmentId: fixtureJudgingAssignmentId,
  judgingStartedAssignmentId: fixtureJudgingStartedAssignmentId,
  judgeWorkspaceAssignmentId: fixtureJudgeWorkspaceAssignmentId,
  judgeWorkspaceStartedAssignmentId: fixtureJudgeWorkspaceStartedAssignmentId,
  publicCriterionOneId: fixturePublicCriterionOneId,
  publicCriterionTwoId: fixturePublicCriterionTwoId,
  judgingCriterionOneId: fixtureJudgingCriterionOneId,
  judgingCriterionTwoId: fixtureJudgingCriterionTwoId,
  judgeWorkspaceCriterionOneId: fixtureJudgeWorkspaceCriterionOneId,
  judgeWorkspaceCriterionTwoId: fixtureJudgeWorkspaceCriterionTwoId,
  publicPrizeId: fixturePublicPrizeId,
  prizeWorkspacePrizeId: fixturePrizeWorkspacePrizeId,
  prizeWorkspaceRedemptionId: fixturePrizeWorkspaceRedemptionId,
  outcomesSubmissionOneId: fixtureOutcomesSubmissionOneId,
  outcomesSubmissionTwoId: fixtureOutcomesSubmissionTwoId,
  competitionReassignSubmissionId: fixtureCompetitionReassignSubmissionId,
  competitionForceSkipSubmissionId: fixtureCompetitionForceSkipSubmissionId,
  competitionShortlistSubmissionOneId: fixtureCompetitionShortlistSubmissionOneId,
  competitionShortlistSubmissionTwoId: fixtureCompetitionShortlistSubmissionTwoId,
  competitionCompleteSubmissionOneId: fixtureCompetitionCompleteSubmissionOneId,
  competitionCompleteSubmissionTwoId: fixtureCompetitionCompleteSubmissionTwoId,
  competitionCompleteRedemptionId: fixtureCompetitionCompleteRedemptionId,
  outcomesTeamRedemptionPrizeId: fixtureOutcomesTeamRedemptionPrizeId,
  outcomesMemberRedemptionPrizeId: fixtureOutcomesMemberRedemptionPrizeId
} as const

const personaUserIds: Record<StablePersona['key'], string> = {
  platform_admin: 'user_platform_admin',
  event_admin: 'user_event_admin',
  judge: 'user_judge',
  regular_user: 'user_regular_user'
}

const syntheticUserIds = {
  backupJudge: 'user_backup_judge',
  judgingParticipantTwo: 'user_judging_participant_two'
} as const

function sqlLiteral(value: string | null) {
  if (value === null) {
    return 'null'
  }

  return `'${value.replaceAll('\'', '\'\'')}'`
}

const fixtureResetStatements = [
  'pragma foreign_keys = on',
  'delete from audit_logs',
  'delete from prize_redemptions',
  'delete from prize_eligibility_snapshots',
  'delete from prizes',
  'delete from judge_criterion_scores',
  'delete from judge_assignments',
  'delete from evaluation_criteria',
  'delete from submissions',
  'delete from team_join_requests',
  'delete from team_members',
  'delete from teams',
  'delete from user_applications',
  'delete from user_platform_document_acceptances',
  'delete from event_terms_documents',
  'delete from platform_documents',
  'delete from event_role_assignments',
  'delete from events',
  'delete from user_auth_identities',
  'delete from users'
] as const

function userTuple(persona: StablePersona) {
  return `(${[
    sqlLiteral(personaUserIds[persona.key]),
    sqlLiteral(persona.auth0Subject),
    sqlLiteral(persona.email),
    sqlLiteral(persona.displayName),
    persona.key === 'platform_admin' ? '1' : '0',
    'null',
    'null',
    'null',
    'null',
    'null',
    sqlLiteral(fixtureTimestamp),
    sqlLiteral(fixtureTimestamp),
    'null'
  ].join(', ')})`
}

function buildFixtureSql(personas: StablePersona[]) {
  const platformAdminId = personaUserIds.platform_admin
  const eventAdminId = personaUserIds.event_admin
  const judgeId = personaUserIds.judge
  const regularUserId = personaUserIds.regular_user
  const regularUserEmail = personas.find(persona => persona.key === 'regular_user')!.email.trim().toLowerCase()
  const backupJudgeId = syntheticUserIds.backupJudge
  const judgingParticipantTwoId = syntheticUserIds.judgingParticipantTwo
  const extraUserTuples = [
    `(${[
      sqlLiteral(backupJudgeId),
      sqlLiteral('auth0|backup_judge'),
      sqlLiteral('backup-judge@example.com'),
      sqlLiteral('Backup Judge'),
      '0',
      'null',
      'null',
      'null',
      'null',
      'null',
      sqlLiteral(fixtureTimestamp),
      sqlLiteral(fixtureTimestamp),
      'null'
    ].join(', ')})`,
    `(${[
      sqlLiteral(judgingParticipantTwoId),
      sqlLiteral('auth0|judging_participant_two'),
      sqlLiteral('judging-participant-two@example.com'),
      sqlLiteral('Judging Participant Two'),
      '0',
      'null',
      'null',
      'null',
      'null',
      'null',
      sqlLiteral(fixtureTimestamp),
      sqlLiteral(fixtureTimestamp),
      'null'
    ].join(', ')})`
  ]
  return [
    ...fixtureResetStatements,
    `insert into users (
      id, auth0_subject, email, display_name, is_platform_admin,
      x_profile_url, linkedin_profile_url, github_profile_url, chatgpt_email, openai_org_id,
      created_at, updated_at, deleted_at
    ) values ${[...personas.map(userTuple), ...extraUserTuples].join(', ')}`,
    `insert into platform_documents (
      id, document_type, version, title, content, published_at, created_at
    ) values
      (${sqlLiteral(fixturePrivacyDocumentId)}, 'privacy_policy', 1, 'Privacy Policy', 'E2E privacy policy', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureTermsDocumentId)}, 'platform_terms', 1, 'Platform Terms', 'E2E platform terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into user_platform_document_acceptances (
      id, user_id, platform_document_id, accepted_at
    ) values
      ('acceptance_platform_admin_privacy_fixture', ${sqlLiteral(platformAdminId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_platform_admin_terms_fixture', ${sqlLiteral(platformAdminId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_event_admin_privacy_fixture', ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_event_admin_terms_fixture', ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_judge_privacy_fixture', ${sqlLiteral(judgeId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_judge_terms_fixture', ${sqlLiteral(judgeId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_regular_user_privacy_fixture', ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_regular_user_terms_fixture', ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_backup_judge_privacy_fixture', ${sqlLiteral(backupJudgeId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_backup_judge_terms_fixture', ${sqlLiteral(backupJudgeId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_judging_participant_two_privacy_fixture', ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixturePrivacyDocumentId)}, ${sqlLiteral(fixtureTimestamp)}),
      ('acceptance_judging_participant_two_terms_fixture', ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTermsDocumentId)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into events (
      id, name, slug, description, background_image_url, banner_image_url, city, country, address,
      registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
      state, max_team_members, require_x_profile, require_linkedin_profile, require_github_profile, require_chatgpt_email, require_openai_org_id, require_luma_profile,
      current_application_terms_document_id, current_winner_terms_document_id, created_by_user_id,
      created_at, updated_at
    ) values (
      ${sqlLiteral(fixtureEventId)},
      'E2E Fixture Event',
      'e2e-fixture-event',
      'Fixture event for authenticated end-to-end coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-30T12:00:00.000Z',
      '2026-03-30T12:00:00.000Z',
      '2026-04-02T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureDraftEventId)},
      'Draft Managed Event',
      'draft-managed-event',
      'Draft fixture that should stay hidden on the public discovery surface.',
      null,
      null,
      'Vienna',
      'Austria',
      'Draft Fixture Address',
      '2026-03-27T12:00:00.000Z',
      '2026-03-29T12:00:00.000Z',
      '2026-03-29T12:00:00.000Z',
      '2026-03-31T12:00:00.000Z',
      'draft',
      5,
      0,
      0,
      0,
      0,
      0,
      1,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantApplicationEventId)},
      'Participant Application Fixture Event',
      'participant-application-fixture-event',
      'Registration-open fixture used for participant application UI coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureApiTeamFormationEventId)},
      'API Team Formation Fixture Event',
      'api-team-formation-fixture-event',
      'Registration-open fixture reserved for authenticated API application and team-formation coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'API Team Formation Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantProfileRequirementEventId)},
      'Participant Profile Requirement Fixture Event',
      'participant-profile-requirement-fixture-event',
      'Registration-open fixture that requires ChatGPT email completion before applying.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Profile Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      1,
      0,
      1,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantApprovedEventId)},
      'Participant Approved Fixture Event',
      'participant-approved-fixture-event',
      'Registration-open fixture with an approved participant application.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Approved Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantRejectedEventId)},
      'Participant Rejected Fixture Event',
      'participant-rejected-fixture-event',
      'Registration-open fixture with a rejected participant application.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Rejected Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantTeamCreateEventId)},
      'Participant Team Create Fixture Event',
      'participant-team-create-fixture-event',
      'Registration-open fixture for participant team creation UI coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Team Create Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantTeamJoinEventId)},
      'Participant Team Join Fixture Event',
      'participant-team-join-fixture-event',
      'Registration-open fixture for participant team browse, join, and join-request review coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Team Join Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantTeamSoloEventId)},
      'Participant Team Solo Fixture Event',
      'participant-team-solo-fixture-event',
      'Registration-open fixture for blocked solo-admin team workspace coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Team Solo Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureApiSoloTeamEventId)},
      'API Solo Team Fixture Event',
      'api-solo-team-fixture-event',
      'Registration-open fixture reserved for authenticated API solo-team leave protection coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'API Solo Team Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'registration_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantSubmissionCreateEventId)},
      'Participant Submission Create Fixture Event',
      'participant-submission-create-fixture-event',
      'Submission-open fixture for participant draft, submit, and withdraw coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Submission Create Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-26T12:00:00.000Z',
      'submission_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureParticipantSubmissionLockedEventId)},
      'Participant Submission Locked Fixture Event',
      'participant-submission-locked-fixture-event',
      'Blind-review fixture for read-only participant submission coverage after locking.',
      null,
      null,
      'Vienna',
      'Austria',
      'Participant Submission Locked Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-24T12:00:00.000Z',
      'blind_review',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixturePrizeWorkspaceEventId)},
      'Prize Workspace Fixture Event',
      'prize-workspace-fixture-event',
      'Winners-announced fixture for the dedicated prize-redemption workspace UI.',
      null,
      null,
      'Vienna',
      'Austria',
      'Prize Workspace Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'winners_announced',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureOperationsEventId)},
      'Operations Fixture Event',
      'operations-fixture-event',
      'Submission-open admin operations fixture for pagination and intervention coverage.',
      null,
      null,
      'Berlin',
      'Germany',
      'Operations Fixture Address',
      '2026-03-20T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z',
      '2026-03-25T12:00:00.000Z',
      'submission_open',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureJudgingEventId)},
      'E2E Judging Fixture Event',
      'e2e-judging-fixture-event',
      'Fixture event for judging end-to-end coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Judging Fixture Address',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      '2026-03-14T12:00:00.000Z',
      'blind_review',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureJudgeWorkspaceEventId)},
      'E2E Judge Workspace Fixture Event',
      'e2e-judge-workspace-fixture-event',
      'Fixture event for blind judge workspace UI coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Judge Workspace Fixture Address',
      '2026-03-11T12:00:00.000Z',
      '2026-03-13T12:00:00.000Z',
      '2026-03-13T12:00:00.000Z',
      '2026-03-15T12:00:00.000Z',
      'blind_review',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureOutcomesEventId)},
      'E2E Outcomes Fixture Event',
      'e2e-outcomes-fixture-event',
      'Fixture event for shortlist, winners, prize redemption, and audit coverage.',
      null,
      null,
      'Vienna',
      'Austria',
      'Outcomes Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'shortlist',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureCompetitionReassignEventId)},
      'Competition Reassign Fixture Event',
      'competition-reassign-fixture-event',
      'Judging-preparation fixture for admin reassignment coverage in the competition workspace.',
      null,
      null,
      'Vienna',
      'Austria',
      'Competition Reassign Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'judging_preparation',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureCompetitionForceSkipEventId)},
      'Competition Force Skip Fixture Event',
      'competition-force-skip-fixture-event',
      'Blind-review fixture for admin force-skip coverage in the competition workspace.',
      null,
      null,
      'Vienna',
      'Austria',
      'Competition Force Skip Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'blind_review',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureCompetitionShortlistEventId)},
      'Competition Shortlist Fixture Event',
      'competition-shortlist-fixture-event',
      'Shortlist fixture for final ranking reorder and winner announcement coverage in the competition workspace.',
      null,
      null,
      'Vienna',
      'Austria',
      'Competition Shortlist Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'shortlist',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixtureCompetitionCompleteEventId)},
      'Competition Complete Fixture Event',
      'competition-complete-fixture-event',
      'Winners-announced fixture for completion coverage in the competition workspace.',
      null,
      null,
      'Vienna',
      'Austria',
      'Competition Complete Fixture Address',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-12T12:00:00.000Z',
      'winners_announced',
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    ),
    (
      ${sqlLiteral(fixturePublicOverflowEventId)},
      'Public Overflow Fixture Event',
      'public-overflow-fixture-event',
      'Extra visible fixture to exercise paginated public discovery.',
      null,
      null,
      'Vienna',
      'Austria',
      'Overflow Fixture Address',
      '2026-03-06T12:00:00.000Z',
      '2026-03-08T12:00:00.000Z',
      '2026-03-08T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      'completed',
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      '2026-03-21T12:00:00.000Z',
      '2026-03-21T12:00:00.000Z'
    ),
    (
      ${sqlLiteral(fixturePublicArchiveEventId)},
      'Public Archive Fixture Event',
      'public-archive-fixture-event',
      'Older visible fixture that should appear after loading more public events.',
      null,
      null,
      'Vienna',
      'Austria',
      'Archive Fixture Address',
      '2026-03-04T12:00:00.000Z',
      '2026-03-06T12:00:00.000Z',
      '2026-03-06T12:00:00.000Z',
      '2026-03-08T12:00:00.000Z',
      'completed',
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      ${sqlLiteral(platformAdminId)},
      '2026-03-20T12:00:00.000Z',
      '2026-03-20T12:00:00.000Z'
    )`,
    `insert into events (
      id, event_type, name, slug, description, city, country, address,
      registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
      state, max_team_members, simplified_claiming_enabled, created_by_user_id, created_at, updated_at
    ) values (
      ${sqlLiteral(fixtureClosedSimplifiedClaimingEventId)},
      'meetup',
      'Closed Simplified Claiming Fixture Meetup',
      'closed-simplified-claiming-fixture-event',
      'Meetup fixture for a closed private attendee redemption flow.',
      'Vienna',
      'Austria',
      'Fixture Venue',
      '2026-03-20T00:00:00.000Z',
      '2026-03-21T00:00:00.000Z',
      null,
      null,
      'registration_open',
      1,
      1,
      ${sqlLiteral(eventAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into events (
      id, event_type, name, slug, description, city, country, address,
      registration_opens_at, registration_closes_at, submission_opens_at, submission_closes_at,
      state, max_team_members, simplified_claiming_enabled, created_by_user_id, created_at, updated_at
    ) values (
      ${sqlLiteral(fixtureSimplifiedClaimingEventId)},
      'meetup',
      'Simplified Claiming Fixture Meetup',
      'simplified-claiming-fixture-event',
      'Meetup fixture for the private attendee redemption flow.',
      'Vienna',
      'Austria',
      'Fixture Venue',
      '2020-01-01T00:00:00.000Z',
      '2030-01-01T00:00:00.000Z',
      null,
      null,
      'registration_open',
      1,
      1,
      ${sqlLiteral(eventAdminId)},
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_attendee_eligibilities (
      id, event_id, normalized_email, first_name, family_name, created_at, updated_at
    ) values (
      'eligibility_closed_simplified_claiming_fixture',
      ${sqlLiteral(fixtureClosedSimplifiedClaimingEventId)},
      'closed-attendee@example.com',
      'Closed',
      'Attendee',
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `update users set luma_email = ${sqlLiteral(regularUserEmail)} where id = ${sqlLiteral(regularUserId)}`,
    `insert into event_attendee_eligibilities (
      id, event_id, normalized_email, first_name, family_name, created_at, updated_at
    ) values (
      'eligibility_simplified_claiming_regular_user',
      ${sqlLiteral(fixtureSimplifiedClaimingEventId)},
      ${sqlLiteral(regularUserEmail)},
      'Regular',
      'User',
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_credit_offers (
      id, event_id, name, description, simplified_claiming_only, redirect_on_claim, display_order, created_at, updated_at
    ) values (
      'offer_closed_simplified_claiming_fixture',
      ${sqlLiteral(fixtureClosedSimplifiedClaimingEventId)},
      'Closed Codex event credit',
      'Private attendee credit for closed-state coverage.',
      true,
      true,
      1,
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_credit_offers (
      id, event_id, name, description, simplified_claiming_only, redirect_on_claim, display_order, created_at, updated_at
    ) values (
      'offer_simplified_claiming_fixture',
      ${sqlLiteral(fixtureSimplifiedClaimingEventId)},
      'Codex event credit',
      'Private attendee credit.',
      true,
      true,
      1,
      ${sqlLiteral(fixtureTimestamp)},
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_credit_codes (
      id, credit_offer_id, value, created_at
    ) values (
      'code_closed_simplified_claiming_fixture',
      'offer_closed_simplified_claiming_fixture',
      'https://chatgpt.com/coupon/bdd-closed-simplified',
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_credit_codes (
      id, credit_offer_id, value, created_at
    ) values (
      'code_simplified_claiming_fixture',
      'offer_simplified_claiming_fixture',
      'https://chatgpt.com/coupon/bdd-simplified',
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_role_assignments (
      id, event_id, user_id, role, is_in_judge_pool, created_at
    ) values (
      'role_event_admin_simplified_claiming_fixture',
      ${sqlLiteral(fixtureSimplifiedClaimingEventId)},
      ${sqlLiteral(eventAdminId)},
      'event_admin',
      0,
      ${sqlLiteral(fixtureTimestamp)}
    )`,
    `insert into event_terms_documents (
      id, event_id, document_type, version, title, content, published_at, created_at
    ) values
      (${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureEventId)}, 'application_terms', 1, 'Application Terms', 'E2E application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantApplicationTermsId)}, ${sqlLiteral(fixtureParticipantApplicationEventId)}, 'application_terms', 1, 'Participant Application Terms', 'E2E participant application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureApiTeamFormationTermsId)}, ${sqlLiteral(fixtureApiTeamFormationEventId)}, 'application_terms', 1, 'API Team Formation Terms', 'E2E API team formation terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantProfileRequirementTermsId)}, ${sqlLiteral(fixtureParticipantProfileRequirementEventId)}, 'application_terms', 1, 'Participant Profile Requirement Terms', 'E2E participant profile requirement terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantApprovedTermsId)}, ${sqlLiteral(fixtureParticipantApprovedEventId)}, 'application_terms', 1, 'Participant Approved Terms', 'E2E participant approved terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantRejectedTermsId)}, ${sqlLiteral(fixtureParticipantRejectedEventId)}, 'application_terms', 1, 'Participant Rejected Terms', 'E2E participant rejected terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantTeamCreateTermsId)}, ${sqlLiteral(fixtureParticipantTeamCreateEventId)}, 'application_terms', 1, 'Participant Team Create Terms', 'E2E participant team-create terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantTeamJoinTermsId)}, ${sqlLiteral(fixtureParticipantTeamJoinEventId)}, 'application_terms', 1, 'Participant Team Join Terms', 'E2E participant team-join terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantTeamSoloTermsId)}, ${sqlLiteral(fixtureParticipantTeamSoloEventId)}, 'application_terms', 1, 'Participant Team Solo Terms', 'E2E participant team-solo terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureApiSoloTeamTermsId)}, ${sqlLiteral(fixtureApiSoloTeamEventId)}, 'application_terms', 1, 'API Solo Team Terms', 'E2E API solo team terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantSubmissionCreateTermsId)}, ${sqlLiteral(fixtureParticipantSubmissionCreateEventId)}, 'application_terms', 1, 'Participant Submission Create Terms', 'E2E participant submission-create terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureParticipantSubmissionLockedTermsId)}, ${sqlLiteral(fixtureParticipantSubmissionLockedEventId)}, 'application_terms', 1, 'Participant Submission Locked Terms', 'E2E participant submission-locked terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixturePrizeWorkspaceApplicationTermsId)}, ${sqlLiteral(fixturePrizeWorkspaceEventId)}, 'application_terms', 1, 'Prize Workspace Application Terms', 'E2E prize workspace application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOperationsApplicationTermsId)}, ${sqlLiteral(fixtureOperationsEventId)}, 'application_terms', 1, 'Operations Application Terms', 'E2E operations application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureWinnerTermsId)}, ${sqlLiteral(fixtureEventId)}, 'winner_terms', 1, 'Winner Terms', 'E2E winner terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixturePrizeWorkspaceWinnerTermsId)}, ${sqlLiteral(fixturePrizeWorkspaceEventId)}, 'winner_terms', 1, 'Prize Workspace Winner Terms', 'E2E prize workspace winner terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgingApplicationTermsId)}, ${sqlLiteral(fixtureJudgingEventId)}, 'application_terms', 1, 'Judging Application Terms', 'E2E judging application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgeWorkspaceApplicationTermsId)}, ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'application_terms', 1, 'Judge Workspace Application Terms', 'E2E judge workspace application terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOutcomesWinnerTermsId)}, ${sqlLiteral(fixtureOutcomesEventId)}, 'winner_terms', 1, 'Outcomes Winner Terms', 'E2E outcomes winner terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistWinnerTermsId)}, ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'winner_terms', 1, 'Competition Shortlist Winner Terms', 'E2E competition shortlist winner terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteWinnerTermsId)}, ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'winner_terms', 1, 'Competition Complete Winner Terms', 'E2E competition complete winner terms', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `update events
      set luma_event_url = ${sqlLiteral(fixtureDraftLumaEventUrl)}
      where id = ${sqlLiteral(fixtureDraftEventId)}`,
    `insert into event_role_assignments (
      id, event_id, user_id, role, is_in_judge_pool, created_at
    ) values
      ('role_event_admin_fixture', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_fixture', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_participant_application_fixture', ${sqlLiteral(fixtureParticipantApplicationEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_api_team_formation_fixture', ${sqlLiteral(fixtureApiTeamFormationEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_api_team_formation_fixture', ${sqlLiteral(fixtureApiTeamFormationEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_operations_fixture', ${sqlLiteral(fixtureOperationsEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_judging_fixture', ${sqlLiteral(fixtureJudgingEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_judging_fixture', ${sqlLiteral(fixtureJudgingEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_backup_judge_judging_fixture', ${sqlLiteral(fixtureJudgingEventId)}, ${sqlLiteral(backupJudgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_judge_workspace_fixture', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_judge_workspace_fixture', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_backup_judge_judge_workspace_fixture', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, ${sqlLiteral(backupJudgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_backup_judge_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(backupJudgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_competition_reassign_fixture', ${sqlLiteral(fixtureCompetitionReassignEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_competition_reassign_fixture', ${sqlLiteral(fixtureCompetitionReassignEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_backup_judge_competition_reassign_fixture', ${sqlLiteral(fixtureCompetitionReassignEventId)}, ${sqlLiteral(backupJudgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_competition_force_skip_fixture', ${sqlLiteral(fixtureCompetitionForceSkipEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_competition_force_skip_fixture', ${sqlLiteral(fixtureCompetitionForceSkipEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_backup_judge_competition_force_skip_fixture', ${sqlLiteral(fixtureCompetitionForceSkipEventId)}, ${sqlLiteral(backupJudgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_competition_shortlist_fixture', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_competition_shortlist_fixture', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)}),
      ('role_event_admin_competition_complete_fixture', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, ${sqlLiteral(eventAdminId)}, 'event_admin', 0, ${sqlLiteral(fixtureTimestamp)}),
      ('role_judge_competition_complete_fixture', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, ${sqlLiteral(judgeId)}, 'judge', 1, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into user_applications (
      id, event_id, user_id, status, submitted_at, reviewed_at, reviewed_by_user_id,
      application_terms_document_id, application_terms_accepted_at, created_at, updated_at
    ) values
      ('application_platform_admin_fixture', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(platformAdminId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_fixture', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_fixture_submitted', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(regularUserId)}, 'submitted', ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judging_participant_two_fixture_submitted', ${sqlLiteral(fixtureEventId)}, ${sqlLiteral(judgingParticipantTwoId)}, 'submitted', ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_participant_application_fixture', ${sqlLiteral(fixtureParticipantApplicationEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_api_team_formation_fixture', ${sqlLiteral(fixtureApiTeamFormationEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApiTeamFormationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_approved_fixture', ${sqlLiteral(fixtureParticipantApprovedEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantApprovedTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_rejected_fixture', ${sqlLiteral(fixtureParticipantRejectedEventId)}, ${sqlLiteral(regularUserId)}, 'rejected', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantRejectedTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_team_create_fixture', ${sqlLiteral(fixtureParticipantTeamCreateEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantTeamCreateTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_team_join_fixture', ${sqlLiteral(fixtureParticipantTeamJoinEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantTeamJoinTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_participant_team_join_fixture', ${sqlLiteral(fixtureParticipantTeamJoinEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantTeamJoinTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_platform_admin_participant_team_join_fixture', ${sqlLiteral(fixtureParticipantTeamJoinEventId)}, ${sqlLiteral(platformAdminId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantTeamJoinTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_team_solo_fixture', ${sqlLiteral(fixtureParticipantTeamSoloEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantTeamSoloTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_platform_admin_api_solo_team_fixture', ${sqlLiteral(fixtureApiSoloTeamEventId)}, ${sqlLiteral(platformAdminId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApiSoloTeamTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_submission_create_fixture', ${sqlLiteral(fixtureParticipantSubmissionCreateEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantSubmissionCreateTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_participant_submission_locked_fixture', ${sqlLiteral(fixtureParticipantSubmissionLockedEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureParticipantSubmissionLockedTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_prize_workspace_fixture', ${sqlLiteral(fixturePrizeWorkspaceEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixturePrizeWorkspaceApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_operations_fixture', ${sqlLiteral(fixtureOperationsEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureOperationsApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judging_participant_two_operations_fixture', ${sqlLiteral(fixtureOperationsEventId)}, ${sqlLiteral(judgingParticipantTwoId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureOperationsApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_operations_fixture', ${sqlLiteral(fixtureOperationsEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureOperationsApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_backup_judge_operations_fixture', ${sqlLiteral(fixtureOperationsEventId)}, ${sqlLiteral(backupJudgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureOperationsApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_judging_fixture', ${sqlLiteral(fixtureJudgingEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureJudgingApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_participant_two_judging_fixture', ${sqlLiteral(fixtureJudgingEventId)}, ${sqlLiteral(judgingParticipantTwoId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureJudgingApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_judge_workspace_fixture', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureJudgeWorkspaceApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_participant_two_judge_workspace_fixture', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, ${sqlLiteral(judgingParticipantTwoId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureJudgeWorkspaceApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_regular_user_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(regularUserId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_participant_two_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(judgingParticipantTwoId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('application_judge_outcomes_fixture', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(judgeId)}, 'approved', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(eventAdminId)}, ${sqlLiteral(fixtureApplicationTermsId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into teams (
      id, event_id, name, slug, workspace_mode, is_open_to_join_requests, created_by_user_id, created_at, updated_at
    ) values
      ('team_participant_join_fixture', ${sqlLiteral(fixtureParticipantTeamJoinEventId)}, 'Judge Review Team', 'judge-review-team', 'team', 1, ${sqlLiteral(judgeId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_participant_solo_fixture', ${sqlLiteral(fixtureParticipantTeamSoloEventId)}, 'Solo Admin Team', 'solo-admin-team', 'solo', 1, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_participant_submission_create_fixture', ${sqlLiteral(fixtureParticipantSubmissionCreateEventId)}, 'Submission Launch Team', 'submission-launch-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_participant_submission_locked_fixture', ${sqlLiteral(fixtureParticipantSubmissionLockedEventId)}, 'Locked Review Team', 'locked-review-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_prize_workspace_fixture', ${sqlLiteral(fixturePrizeWorkspaceEventId)}, 'Prize Workspace Team', 'prize-workspace-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_operations_fixture_alpha', ${sqlLiteral(fixtureOperationsEventId)}, 'Alpha Operations Team', 'alpha-operations-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_operations_fixture_beta', ${sqlLiteral(fixtureOperationsEventId)}, 'Beta Operations Team', 'beta-operations-team', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_operations_fixture_gamma', ${sqlLiteral(fixtureOperationsEventId)}, 'Gamma Operations Team', 'gamma-operations-team', 'team', 0, ${sqlLiteral(judgeId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_operations_fixture_zeta', ${sqlLiteral(fixtureOperationsEventId)}, 'Zeta Operations Team', 'zeta-operations-team', 'team', 0, ${sqlLiteral(backupJudgeId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_judging_fixture_one', ${sqlLiteral(fixtureJudgingEventId)}, 'Fixture Judging Team One', 'fixture-judging-team-one', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_judging_fixture_two', ${sqlLiteral(fixtureJudgingEventId)}, 'Fixture Judging Team Two', 'fixture-judging-team-two', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_judge_workspace_fixture_one', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'Fixture Judge Workspace Team One', 'fixture-judge-workspace-team-one', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_judge_workspace_fixture_two', ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'Fixture Judge Workspace Team Two', 'fixture-judge-workspace-team-two', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_outcomes_fixture_one', ${sqlLiteral(fixtureOutcomesEventId)}, 'Fixture Outcomes Team One', 'fixture-outcomes-team-one', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_outcomes_fixture_two', ${sqlLiteral(fixtureOutcomesEventId)}, 'Fixture Outcomes Team Two', 'fixture-outcomes-team-two', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_reassign_fixture', ${sqlLiteral(fixtureCompetitionReassignEventId)}, 'Competition Reassign Team', 'competition-reassign-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_force_skip_fixture', ${sqlLiteral(fixtureCompetitionForceSkipEventId)}, 'Competition Force Skip Team', 'competition-force-skip-team', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_shortlist_fixture_one', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'Competition Shortlist Team One', 'competition-shortlist-team-one', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_shortlist_fixture_two', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'Competition Shortlist Team Two', 'competition-shortlist-team-two', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_complete_fixture_one', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'Competition Complete Team One', 'competition-complete-team-one', 'team', 0, ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('team_competition_complete_fixture_two', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'Competition Complete Team Two', 'competition-complete-team-two', 'team', 0, ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into team_members (
      id, team_id, user_id, role, joined_at, left_at, created_at
    ) values
      ('membership_participant_join_fixture_admin', 'team_participant_join_fixture', ${sqlLiteral(judgeId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_participant_solo_fixture_admin', 'team_participant_solo_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_participant_submission_create_fixture_admin', 'team_participant_submission_create_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_participant_submission_locked_fixture_admin', 'team_participant_submission_locked_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_prize_workspace_fixture_admin', 'team_prize_workspace_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_operations_fixture_alpha', 'team_operations_fixture_alpha', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_operations_fixture_beta', 'team_operations_fixture_beta', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_operations_fixture_gamma', 'team_operations_fixture_gamma', ${sqlLiteral(judgeId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_operations_fixture_zeta', 'team_operations_fixture_zeta', ${sqlLiteral(backupJudgeId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_judging_fixture_one', 'team_judging_fixture_one', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_judging_fixture_two', 'team_judging_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_judge_workspace_fixture_one', 'team_judge_workspace_fixture_one', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_judge_workspace_fixture_two', 'team_judge_workspace_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_outcomes_fixture_one', 'team_outcomes_fixture_one', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_outcomes_fixture_two', 'team_outcomes_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_reassign_fixture', 'team_competition_reassign_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_force_skip_fixture', 'team_competition_force_skip_fixture', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_shortlist_fixture_one', 'team_competition_shortlist_fixture_one', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_shortlist_fixture_two', 'team_competition_shortlist_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_complete_fixture_one', 'team_competition_complete_fixture_one', ${sqlLiteral(regularUserId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)}),
      ('membership_competition_complete_fixture_two', 'team_competition_complete_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, 'admin', ${sqlLiteral(fixtureTimestamp)}, null, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into submissions (
      id, team_id, status, project_name, summary, repository_url, demo_url, submitted_at, locked_at, withdrawn_at, disqualified_at, created_at, updated_at
    ) values
      ('submission_participant_submission_locked_fixture', 'team_participant_submission_locked_fixture', 'locked', 'Locked Review Project', 'Locked fixture summary for participant submission visibility.', 'https://example.com/locked-review-project', 'https://example.com/locked-review-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_operations_fixture_alpha', 'team_operations_fixture_alpha', 'submitted', 'Operations Project Alpha', 'Operations fixture summary alpha', 'https://example.com/operations-fixture-alpha', 'https://example.com/operations-fixture-alpha-demo', ${sqlLiteral(fixtureTimestamp)}, null, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_operations_fixture_beta', 'team_operations_fixture_beta', 'draft', 'Operations Project Beta', 'Operations fixture summary beta', 'https://example.com/operations-fixture-beta', 'https://example.com/operations-fixture-beta-demo', null, null, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_operations_fixture_gamma', 'team_operations_fixture_gamma', 'submitted', 'Operations Project Gamma', 'Operations fixture summary gamma', 'https://example.com/operations-fixture-gamma', 'https://example.com/operations-fixture-gamma-demo', ${sqlLiteral(fixtureTimestamp)}, null, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_judging_fixture_one', 'team_judging_fixture_one', 'locked', 'Fixture Project One', 'Blind fixture summary one', 'https://example.com/judging-fixture-one', 'https://example.com/judging-fixture-one-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_judging_fixture_two', 'team_judging_fixture_two', 'locked', 'Fixture Project Two', 'Blind fixture summary two', 'https://example.com/judging-fixture-two', 'https://example.com/judging-fixture-two-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_judge_workspace_fixture_one', 'team_judge_workspace_fixture_one', 'locked', 'Workspace Project One', 'Blind workspace summary one', 'https://example.com/workspace-fixture-one', 'https://example.com/workspace-fixture-one-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('submission_judge_workspace_fixture_two', 'team_judge_workspace_fixture_two', 'locked', 'Workspace Project Two', 'Blind workspace summary two', 'https://example.com/workspace-fixture-two', 'https://example.com/workspace-fixture-two-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOutcomesSubmissionOneId)}, 'team_outcomes_fixture_one', 'locked', 'Fixture Outcomes Project One', 'Outcomes summary one', 'https://example.com/outcomes-fixture-one', 'https://example.com/outcomes-fixture-one-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOutcomesSubmissionTwoId)}, 'team_outcomes_fixture_two', 'locked', 'Fixture Outcomes Project Two', 'Outcomes summary two', 'https://example.com/outcomes-fixture-two', 'https://example.com/outcomes-fixture-two-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionReassignSubmissionId)}, 'team_competition_reassign_fixture', 'locked', 'Competition Reassign Project', 'Competition reassign summary', 'https://example.com/competition-reassign', 'https://example.com/competition-reassign-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionForceSkipSubmissionId)}, 'team_competition_force_skip_fixture', 'locked', 'Competition Force Skip Project', 'Competition force-skip summary', 'https://example.com/competition-force-skip', 'https://example.com/competition-force-skip-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistSubmissionOneId)}, 'team_competition_shortlist_fixture_one', 'locked', 'Competition Shortlist Project One', 'Competition shortlist summary one', 'https://example.com/competition-shortlist-one', 'https://example.com/competition-shortlist-one-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistSubmissionTwoId)}, 'team_competition_shortlist_fixture_two', 'locked', 'Competition Shortlist Project Two', 'Competition shortlist summary two', 'https://example.com/competition-shortlist-two', 'https://example.com/competition-shortlist-two-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteSubmissionOneId)}, 'team_competition_complete_fixture_one', 'locked', 'Competition Complete Project One', 'Competition complete summary one', 'https://example.com/competition-complete-one', 'https://example.com/competition-complete-one-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteSubmissionTwoId)}, 'team_competition_complete_fixture_two', 'locked', 'Competition Complete Project Two', 'Competition complete summary two', 'https://example.com/competition-complete-two', 'https://example.com/competition-complete-two-demo', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into evaluation_criteria (
      id, event_id, name, description, weight, display_order, created_at
    ) values
      (${sqlLiteral(fixturePublicCriterionOneId)}, ${sqlLiteral(fixtureEventId)}, 'Community Impact', 'Measures how clearly the project serves participants and organizers.', 60, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixturePublicCriterionTwoId)}, ${sqlLiteral(fixtureEventId)}, 'Technical Craft', 'Measures execution quality, reliability, and polish.', 40, 2, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgingCriterionOneId)}, ${sqlLiteral(fixtureJudgingEventId)}, 'Novelty', 'Judging fixture novelty criterion', 50, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgingCriterionTwoId)}, ${sqlLiteral(fixtureJudgingEventId)}, 'Execution', 'Judging fixture execution criterion', 50, 2, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgeWorkspaceCriterionOneId)}, ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'Clarity', 'Judge workspace clarity criterion', 40, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgeWorkspaceCriterionTwoId)}, ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'Impact', 'Judge workspace impact criterion', 60, 2, ${sqlLiteral(fixtureTimestamp)}),
      ('evaluation_criterion_outcomes_fixture_novelty', ${sqlLiteral(fixtureOutcomesEventId)}, 'Novelty', 'Outcomes fixture novelty criterion', 50, 1, ${sqlLiteral(fixtureTimestamp)}),
      ('evaluation_criterion_outcomes_fixture_execution', ${sqlLiteral(fixtureOutcomesEventId)}, 'Execution', 'Outcomes fixture execution criterion', 50, 2, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistCriterionOneId)}, ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'Novelty', 'Competition shortlist novelty criterion', 50, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistCriterionTwoId)}, ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'Execution', 'Competition shortlist execution criterion', 50, 2, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteCriterionOneId)}, ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'Novelty', 'Competition complete novelty criterion', 50, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteCriterionTwoId)}, ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'Execution', 'Competition complete execution criterion', 50, 2, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into judge_assignments (
      id, event_id, submission_id, judge_user_id, review_stage, blind_review_slot, status, pitch_score, pitch_comment, assigned_at, started_at, completed_at, skipped_at, skipped_by_user_id, skip_reason, ineligibility_status, ineligibility_reason, ineligibility_marked_at, ineligibility_marked_by_user_id, created_at
    ) values
      (${sqlLiteral(fixtureJudgingAssignmentId)}, ${sqlLiteral(fixtureJudgingEventId)}, 'submission_judging_fixture_one', ${sqlLiteral(judgeId)}, 'blind_review', 1, 'assigned', null, null, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgingStartedAssignmentId)}, ${sqlLiteral(fixtureJudgingEventId)}, 'submission_judging_fixture_two', ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_started', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgeWorkspaceAssignmentId)}, ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'submission_judge_workspace_fixture_one', ${sqlLiteral(judgeId)}, 'blind_review', 1, 'assigned', null, null, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureJudgeWorkspaceStartedAssignmentId)}, ${sqlLiteral(fixtureJudgeWorkspaceEventId)}, 'submission_judge_workspace_fixture_two', ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_started', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_outcomes_fixture_one', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(fixtureOutcomesSubmissionOneId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_outcomes_fixture_two', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(fixtureOutcomesSubmissionTwoId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_outcomes_fixture_one_backup', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(fixtureOutcomesSubmissionOneId)}, ${sqlLiteral(backupJudgeId)}, 'blind_review', 2, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_outcomes_fixture_two_backup', ${sqlLiteral(fixtureOutcomesEventId)}, ${sqlLiteral(fixtureOutcomesSubmissionTwoId)}, ${sqlLiteral(backupJudgeId)}, 'blind_review', 2, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_reassign_fixture', ${sqlLiteral(fixtureCompetitionReassignEventId)}, ${sqlLiteral(fixtureCompetitionReassignSubmissionId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'assigned', null, null, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_force_skip_fixture', ${sqlLiteral(fixtureCompetitionForceSkipEventId)}, ${sqlLiteral(fixtureCompetitionForceSkipSubmissionId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_started', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_shortlist_fixture_one', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, ${sqlLiteral(fixtureCompetitionShortlistSubmissionOneId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_shortlist_fixture_two', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, ${sqlLiteral(fixtureCompetitionShortlistSubmissionTwoId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_complete_fixture_one', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, ${sqlLiteral(fixtureCompetitionCompleteSubmissionOneId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_assignment_competition_complete_fixture_two', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, ${sqlLiteral(fixtureCompetitionCompleteSubmissionTwoId)}, ${sqlLiteral(judgeId)}, 'blind_review', 1, 'judge_completed', null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}, null, null, null, 'eligible', null, null, null, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into judge_criterion_scores (
      id, judge_assignment_id, evaluation_criterion_id, score, comment, created_at, updated_at
    ) values
      ('judge_score_outcomes_fixture_one_novelty', 'judge_assignment_outcomes_fixture_one', 'evaluation_criterion_outcomes_fixture_novelty', 5, 'Strong novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_one_execution', 'judge_assignment_outcomes_fixture_one', 'evaluation_criterion_outcomes_fixture_execution', 4, 'Strong execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_two_novelty', 'judge_assignment_outcomes_fixture_two', 'evaluation_criterion_outcomes_fixture_novelty', 4, 'Good novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_two_execution', 'judge_assignment_outcomes_fixture_two', 'evaluation_criterion_outcomes_fixture_execution', 3, 'Good execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_one_backup_novelty', 'judge_assignment_outcomes_fixture_one_backup', 'evaluation_criterion_outcomes_fixture_novelty', 5, 'Strong novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_one_backup_execution', 'judge_assignment_outcomes_fixture_one_backup', 'evaluation_criterion_outcomes_fixture_execution', 4, 'Strong execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_two_backup_novelty', 'judge_assignment_outcomes_fixture_two_backup', 'evaluation_criterion_outcomes_fixture_novelty', 4, 'Good novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_outcomes_fixture_two_backup_execution', 'judge_assignment_outcomes_fixture_two_backup', 'evaluation_criterion_outcomes_fixture_execution', 3, 'Good execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_shortlist_fixture_one_novelty', 'judge_assignment_competition_shortlist_fixture_one', ${sqlLiteral(fixtureCompetitionShortlistCriterionOneId)}, 5, 'Excellent novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_shortlist_fixture_one_execution', 'judge_assignment_competition_shortlist_fixture_one', ${sqlLiteral(fixtureCompetitionShortlistCriterionTwoId)}, 5, 'Strong execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_shortlist_fixture_two_novelty', 'judge_assignment_competition_shortlist_fixture_two', ${sqlLiteral(fixtureCompetitionShortlistCriterionOneId)}, 4, 'Good novelty', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_shortlist_fixture_two_execution', 'judge_assignment_competition_shortlist_fixture_two', ${sqlLiteral(fixtureCompetitionShortlistCriterionTwoId)}, 4, 'Good execution', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_complete_fixture_one_novelty', 'judge_assignment_competition_complete_fixture_one', ${sqlLiteral(fixtureCompetitionCompleteCriterionOneId)}, 5, 'Complete novelty leader', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_complete_fixture_one_execution', 'judge_assignment_competition_complete_fixture_one', ${sqlLiteral(fixtureCompetitionCompleteCriterionTwoId)}, 5, 'Complete execution leader', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_complete_fixture_two_novelty', 'judge_assignment_competition_complete_fixture_two', ${sqlLiteral(fixtureCompetitionCompleteCriterionOneId)}, 4, 'Complete novelty runner-up', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('judge_score_competition_complete_fixture_two_execution', 'judge_assignment_competition_complete_fixture_two', ${sqlLiteral(fixtureCompetitionCompleteCriterionTwoId)}, 4, 'Complete execution runner-up', ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into prize_eligibility_snapshots (
      id, event_id, team_id, user_id, snapshot_at, created_at
    ) values
      ('prize_snapshot_outcomes_fixture_team_one', ${sqlLiteral(fixtureOutcomesEventId)}, 'team_outcomes_fixture_one', ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('prize_snapshot_outcomes_fixture_team_two', ${sqlLiteral(fixtureOutcomesEventId)}, 'team_outcomes_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('prize_snapshot_competition_shortlist_fixture_team_one', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'team_competition_shortlist_fixture_one', ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('prize_snapshot_competition_shortlist_fixture_team_two', ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'team_competition_shortlist_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('prize_snapshot_competition_complete_fixture_team_one', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'team_competition_complete_fixture_one', ${sqlLiteral(regularUserId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      ('prize_snapshot_competition_complete_fixture_team_two', ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'team_competition_complete_fixture_two', ${sqlLiteral(judgingParticipantTwoId)}, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into prizes (
      id, event_id, name, description, reward_type, reward_value, reward_currency, award_scope, rank_start, rank_end, created_at
    ) values
      (${sqlLiteral(fixturePublicPrizeId)}, ${sqlLiteral(fixtureEventId)}, 'Launch Award', 'Team award for the highest-ranked public program submission.', 'api_credits', '2500', 'USD', 'team', 1, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixturePrizeWorkspacePrizeId)}, ${sqlLiteral(fixturePrizeWorkspaceEventId)}, 'Prize Workspace Grand Prize', 'Team prize for the dedicated prize workspace UI fixture.', 'api_credits', '1200', 'USD', 'team', 1, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOutcomesTeamRedemptionPrizeId)}, ${sqlLiteral(fixtureOutcomesEventId)}, 'Outcomes Grand Prize', 'Team prize for rank 1', 'api_credits', '1000', 'USD', 'team', 1, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureOutcomesMemberRedemptionPrizeId)}, ${sqlLiteral(fixtureOutcomesEventId)}, 'Outcomes Top Two Membership', 'Member prize for top two teams', 'subscription', 'pro', null, 'member', 1, 2, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionShortlistPrizeId)}, ${sqlLiteral(fixtureCompetitionShortlistEventId)}, 'Competition Shortlist Grand Prize', 'Team prize for the announced shortlist winner.', 'api_credits', '750', 'USD', 'team', 1, 1, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompletePrizeId)}, ${sqlLiteral(fixtureCompetitionCompleteEventId)}, 'Competition Complete Grand Prize', 'Team prize for the completed event winner.', 'api_credits', '900', 'USD', 'team', 1, 1, ${sqlLiteral(fixtureTimestamp)})`,
    `insert into prize_redemptions (
      id, prize_id, user_id, team_id, status, legal_name, winner_terms_document_id, winner_terms_accepted_at, redeemed_at, created_at, updated_at
    ) values
      (${sqlLiteral(fixturePrizeWorkspaceRedemptionId)}, ${sqlLiteral(fixturePrizeWorkspacePrizeId)}, null, 'team_prize_workspace_fixture', 'pending', null, null, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)}),
      (${sqlLiteral(fixtureCompetitionCompleteRedemptionId)}, ${sqlLiteral(fixtureCompetitionCompletePrizeId)}, null, 'team_competition_complete_fixture_one', 'pending', null, null, null, null, ${sqlLiteral(fixtureTimestamp)}, ${sqlLiteral(fixtureTimestamp)})`,
    `update events
      set blind_review_count = 1,
          pitch_review_enabled = 0,
          blind_score_weight_percent = 100,
          pitch_score_weight_percent = 0
      where id in (
        ${sqlLiteral(fixtureJudgingEventId)},
        ${sqlLiteral(fixtureJudgeWorkspaceEventId)},
        ${sqlLiteral(fixtureCompetitionReassignEventId)},
        ${sqlLiteral(fixtureCompetitionForceSkipEventId)}
      )`,
    `update events
      set blind_review_count = 2,
          pitch_review_enabled = 1,
          blind_score_weight_percent = 70,
          pitch_score_weight_percent = 30,
          pitch_finalist_submission_ids_json = '[]',
          final_ranking_submission_ids_json = '[]'
      where id = ${sqlLiteral(fixtureOutcomesEventId)}`,
    `update events
      set blind_review_count = 1,
          pitch_review_enabled = 1,
          blind_score_weight_percent = 70,
          pitch_score_weight_percent = 30,
          pitch_finalist_submission_ids_json = '[]',
          final_ranking_submission_ids_json = '[]'
      where id = ${sqlLiteral(fixtureCompetitionShortlistEventId)}`,
    `update events
      set blind_review_count = 1,
          pitch_review_enabled = 0,
          blind_score_weight_percent = 100,
          pitch_score_weight_percent = 0
      where id = ${sqlLiteral(fixtureCompetitionCompleteEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureApplicationTermsId)},
          current_winner_terms_document_id = ${sqlLiteral(fixtureWinnerTermsId)}
      where id = ${sqlLiteral(fixtureEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantApplicationTermsId)}
      where id = ${sqlLiteral(fixtureParticipantApplicationEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureApiTeamFormationTermsId)}
      where id = ${sqlLiteral(fixtureApiTeamFormationEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantProfileRequirementTermsId)},
          application_chatgpt_email_visible = 1
      where id = ${sqlLiteral(fixtureParticipantProfileRequirementEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantApprovedTermsId)}
      where id = ${sqlLiteral(fixtureParticipantApprovedEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantRejectedTermsId)}
      where id = ${sqlLiteral(fixtureParticipantRejectedEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantTeamCreateTermsId)}
      where id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantTeamJoinTermsId)}
      where id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureParticipantTeamSoloTermsId)}
      where id = ${sqlLiteral(fixtureParticipantTeamSoloEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureApiSoloTeamTermsId)}
      where id = ${sqlLiteral(fixtureApiSoloTeamEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixturePrizeWorkspaceApplicationTermsId)},
          current_winner_terms_document_id = ${sqlLiteral(fixturePrizeWorkspaceWinnerTermsId)}
      where id = ${sqlLiteral(fixturePrizeWorkspaceEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureOperationsApplicationTermsId)}
      where id = ${sqlLiteral(fixtureOperationsEventId)}`,
    `update events
      set current_application_terms_document_id = ${sqlLiteral(fixtureJudgingApplicationTermsId)}
      where id = ${sqlLiteral(fixtureJudgingEventId)}`,
    `update events
      set current_winner_terms_document_id = ${sqlLiteral(fixtureOutcomesWinnerTermsId)}
      where id = ${sqlLiteral(fixtureOutcomesEventId)}`,
    `update events
      set current_winner_terms_document_id = ${sqlLiteral(fixtureCompetitionShortlistWinnerTermsId)}
      where id = ${sqlLiteral(fixtureCompetitionShortlistEventId)}`,
    `update events
      set current_winner_terms_document_id = ${sqlLiteral(fixtureCompetitionCompleteWinnerTermsId)}
      where id = ${sqlLiteral(fixtureCompetitionCompleteEventId)}`
  ].map(shiftFixtureIsoLiterals).join(';\n')
}

export function buildPlatformFixtureResetSql(personas: StablePersona[]) {
  return buildFixtureSql(personas)
}

function applyLocalD1Migrations(environment: NodeJS.ProcessEnv) {
  const localPlatformPersistPath = resolveLocalPlatformPersistPath(environment)

  execFileSync(
    'bun',
    [
      'x',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--persist-to',
      dirname(localPlatformPersistPath),
      '--config',
      localWranglerConfigPath
    ],
    {
      cwd: process.cwd(),
      env: {
        ...environment,
        CI: '1'
      },
      stdio: 'ignore'
    }
  )
}

function applyFixtureSql(environment: NodeJS.ProcessEnv, fixtureSql: string) {
  const localPlatformPersistPath = resolveLocalPlatformPersistPath(environment)
  const tempDirectory = mkdtempSync(join(tmpdir(), 'codex-events-bdd-fixtures-'))
  const fixtureSqlPath = join(tempDirectory, 'platform-fixtures.sql')

  try {
    writeFileSync(fixtureSqlPath, fixtureSql, 'utf8')
    execFileSync(
      'bun',
      [
        'x',
        'wrangler',
        'd1',
        'execute',
        'DB',
        '--local',
        '--persist-to',
        dirname(localPlatformPersistPath),
        '--config',
        localWranglerConfigPath,
        '--file',
        fixtureSqlPath
      ],
      {
        cwd: process.cwd(),
        env: {
          ...environment,
          CI: '1'
        },
        stdio: 'pipe'
      }
    )
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true })
  }
}

export async function resetPlatformFixtures(
  personas: StablePersona[],
  environment: NodeJS.ProcessEnv = process.env
) {
  const localPlatformPersistPath = resolveLocalPlatformPersistPath(environment)
  const fixtureSql = buildFixtureSql(personas)
  mkdirSync(dirname(localPlatformPersistPath), { recursive: true })
  rmSync(localPlatformPersistPath, { recursive: true, force: true })
  applyLocalD1Migrations(environment)
  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureEventId,
    userIds: personaUserIds
  }
}

export async function resetRegularUserParticipantAccessScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `update users
      set is_platform_admin = 0,
          updated_at = ${sqlLiteral(fixtureTimestamp)}
      where id = ${sqlLiteral(personaUserIds.regular_user)}`,
    `delete from event_role_assignments
      where user_id = ${sqlLiteral(personaUserIds.regular_user)}`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureParticipantTeamCreateEventId,
    userIds: personaUserIds
  }
}

export async function resetOperationsTeamSelectionFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `update teams
      set is_open_to_join_requests = 1,
          updated_at = ${sqlLiteral(fixtureTimestamp)}
      where id = 'team_operations_fixture_beta'`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureOperationsEventId,
    userIds: personaUserIds
  }
}

export async function resetParticipantTeamCreateFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `delete from audit_logs
      where entity_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}
      )
         or entity_id in (
           select id from team_members
           where team_id in (
             select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}
           )
         )`,
    `delete from team_join_requests
      where team_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}
      )`,
    `delete from team_members
      where team_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}
      )`,
    `delete from teams where event_id = ${sqlLiteral(fixtureParticipantTeamCreateEventId)}`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureParticipantTeamCreateEventId,
    userIds: personaUserIds
  }
}

export async function resetParticipantTeamJoinFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `delete from audit_logs
      where entity_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}
      )
         or entity_id in (
           select id from team_members
           where team_id in (
             select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}
           )
         )`,
    `delete from team_join_requests
      where team_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}
      )`,
    `delete from team_members
      where team_id in (
        select id from teams where event_id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}
      )
        and user_id != ${sqlLiteral(personaUserIds.judge)}`,
    `delete from teams
      where event_id = ${sqlLiteral(fixtureParticipantTeamJoinEventId)}
        and id != 'team_participant_join_fixture'`,
    `update teams
      set name = 'Judge Review Team',
          slug = 'judge-review-team',
          workspace_mode = 'team',
          is_open_to_join_requests = 1,
          created_by_user_id = ${sqlLiteral(personaUserIds.judge)},
          updated_at = ${sqlLiteral(fixtureTimestamp)}
      where id = 'team_participant_join_fixture'`,
    `update team_members
      set role = 'admin',
          joined_at = ${sqlLiteral(fixtureTimestamp)},
          left_at = null
      where id = 'membership_participant_join_fixture_admin'`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureParticipantTeamJoinEventId,
    userIds: personaUserIds
  }
}

export async function resetParticipantSubmissionCreateFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `delete from audit_logs
      where entity_id in (
        select id from submissions where team_id = 'team_participant_submission_create_fixture'
      )`,
    `delete from judge_criterion_scores
      where judge_assignment_id in (
        select id from judge_assignments
        where submission_id in (
          select id from submissions where team_id = 'team_participant_submission_create_fixture'
        )
      )`,
    `delete from judge_assignments
      where submission_id in (
        select id from submissions where team_id = 'team_participant_submission_create_fixture'
      )`,
    `delete from submissions where team_id = 'team_participant_submission_create_fixture'`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureParticipantSubmissionCreateEventId,
    userIds: personaUserIds
  }
}

export async function resetJudgeWorkspaceFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `delete from judge_criterion_scores where judge_assignment_id = ${sqlLiteral(fixtureJudgeWorkspaceAssignmentId)}`,
    `delete from audit_logs where entity_id in (
      ${sqlLiteral(fixtureJudgeWorkspaceAssignmentId)},
      ${sqlLiteral(fixtureJudgeWorkspaceStartedAssignmentId)}
    )`,
    `delete from judge_assignments
      where event_id = ${sqlLiteral(fixtureJudgeWorkspaceEventId)}
        and id not in (
          ${sqlLiteral(fixtureJudgeWorkspaceAssignmentId)},
          ${sqlLiteral(fixtureJudgeWorkspaceStartedAssignmentId)}
        )`,
    `update judge_assignments
      set judge_user_id = ${sqlLiteral(personaUserIds.judge)},
          review_stage = 'blind_review',
          blind_review_slot = 1,
          status = 'assigned',
          pitch_score = null,
          pitch_comment = null,
          assigned_at = ${sqlLiteral(fixtureTimestamp)},
          started_at = null,
          completed_at = null,
          skipped_at = null,
          skipped_by_user_id = null,
          skip_reason = null,
          ineligibility_status = 'eligible',
          ineligibility_reason = null,
          ineligibility_marked_at = null,
          ineligibility_marked_by_user_id = null
      where id = ${sqlLiteral(fixtureJudgeWorkspaceAssignmentId)}`,
    `update judge_assignments
      set judge_user_id = ${sqlLiteral(personaUserIds.judge)},
          review_stage = 'blind_review',
          blind_review_slot = 1,
          status = 'judge_started',
          pitch_score = null,
          pitch_comment = null,
          assigned_at = ${sqlLiteral(fixtureTimestamp)},
          started_at = ${sqlLiteral(fixtureTimestamp)},
          completed_at = null,
          skipped_at = null,
          skipped_by_user_id = null,
          skip_reason = null,
          ineligibility_status = 'eligible',
          ineligibility_reason = null,
          ineligibility_marked_at = null,
          ineligibility_marked_by_user_id = null
      where id = ${sqlLiteral(fixtureJudgeWorkspaceStartedAssignmentId)}`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureJudgeWorkspaceEventId,
    userIds: personaUserIds
  }
}

export async function resetOutcomesFixtureScenarioState(
  environment: NodeJS.ProcessEnv = process.env
) {
  const fixtureSql = [
    `delete from judge_assignments
      where event_id = ${sqlLiteral(fixtureOutcomesEventId)}
        and review_stage = 'pitch_review'`,
    `delete from prize_redemptions
      where prize_id in (
        ${sqlLiteral(fixtureOutcomesTeamRedemptionPrizeId)},
        ${sqlLiteral(fixtureOutcomesMemberRedemptionPrizeId)}
      )`,
    `update events
      set state = 'shortlist',
          pitch_finalist_submission_ids_json = '[]',
          final_ranking_submission_ids_json = '[]',
          updated_at = ${sqlLiteral(fixtureTimestamp)}
      where id = ${sqlLiteral(fixtureOutcomesEventId)}`,
    `delete from audit_logs
      where entity_id = ${sqlLiteral(fixtureOutcomesEventId)}
        and action in (
          'event.pitch_finalists_selected',
          'event.start_pitch',
          'event.start_pitch_review',
          'event.start_final_deliberation',
          'event.final_ranking_reordered',
          'event.announce_winners'
        )`,
    `delete from audit_logs
      where action = 'prize_redemption.redeemed'
        and entity_type = 'prize_redemption'`
  ].join(';\n')

  applyFixtureSql(environment, fixtureSql)

  return {
    eventId: fixtureOutcomesEventId,
    userIds: personaUserIds
  }
}
