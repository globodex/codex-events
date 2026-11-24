---
id: TASK-490
title: Ask the event's own questions during registration instead of after check-in
status: In Progress
assignee: []
created_date: '2026-11-24T17:24:00Z'
updated_date: '2026-11-24T18:00:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
  - app/components/admin/builder/organisms/AdminBuilderRegistrationForm.vue
  - app/components/applications/AdminApplicationsReviewPanel.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationApplicationSection.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationForm.vue
  - app/domains/applications/admin-application-record.ts
  - app/domains/applications/participant-application.ts
  - app/domains/applications/participant-registration-definition.ts
  - app/domains/events/admin-event.ts
  - app/domains/events/builder.ts
  - app/domains/events/records.ts
  - app/pages/account/events/[slug]/index.vue
  - app/pages/events/[slug]/register.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - drizzle/0088_registration_questions.sql
  - >-
    server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post.ts
  - server/api/events/[eventId]/applications/index.post.ts
  - >-
    server/api/events/[eventId]/applications/me/actions/complete-questionnaire.post.ts
  - server/api/events/index.post.ts
  - server/api/events/slug/[slug]/index.get.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/accounts/index.ts
  - server/domains/applications/check-in-flow.ts
  - server/domains/applications/index.ts
  - server/domains/credits/index.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-participants-page.ts
  - server/domains/events/index.ts
  - server/domains/events/photos.ts
  - shared/domains/applications/check-in-flow.ts
  - shared/domains/applications/registration-answers.ts
  - shared/domains/credits/claim-access.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-participants-page.ts
  - shared/domains/events/account-event-settings-page.ts
  - shared/domains/events/custom-questions.ts
  - shared/domains/events/photos.ts
  - stories/participant/ParticipantRegistrationForm.stories.ts
  - tests/bdd/features/authenticated/check-in-flow.feature
  - tests/bdd/features/authenticated/registration-questions.feature
  - tests/bdd/steps/check-in-flow.steps.ts
  - tests/bdd/steps/registration-questions.steps.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/actor-platform-routes.test.ts
  - tests/integration/server/api/check-in-flow-routes.test.ts
  - tests/integration/server/api/credit-claim-check-in-flow-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/api/participant-photo-routes.test.ts
  - tests/integration/server/api/registration-questions-routes.test.ts
  - tests/integration/server/database/migration.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/unit/app/components/participant-registration-controller.test.ts
  - >-
    tests/unit/app/domains/applications/participant-registration-definition.test.ts
  - tests/unit/app/domains/events/admin-event-schema.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - tests/unit/server/domains/applications/index.test.ts
  - tests/unit/server/domains/events/account-event-page-shell.test.ts
  - tests/unit/server/domains/events/index.test.ts
type: enhancement
ordinal: 207000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex was told on 2026-11-24 that events do not need a separate questionnaire after check-in. The questions an organizer writes for an event belong in the registration form, next to the fixed registration fields, so the answers arrive before the event and the door is only for check-in. The questionnaire came with TASK-448 after release v1.20.10, so production holds no questionnaire data. Alex decided on 2026-11-24 that people who registered before a question existed are not asked to answer it, as with the fixed registration fields.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Event admins and platform admins write up to 20 ordered questions (short text, long text, single choice, acknowledgment) in the Registration level of the event builder, for every event type; an incomplete question is an open step of that level and blocks the save
- [x] #2 The participant registration form shows the event's questions after the fixed fields; submitting requires every required question and accepts only listed choices, and each stored answer keeps the question text the participant answered
- [x] #3 People who registered before a question existed are not asked to answer it, and changing the questions does not rewrite stored answers
- [x] #4 Staff, event admins and platform admins read the answers in the participant list next to the other registration answers; account deletion removes the answers and restoring a withdrawn registration keeps them
- [x] #5 The check-in flow has two positions, check-in pending and finished: there is no questionnaire step, completion route or MCP operation, and a checked-in participant sees the activities, credits and photos right away
- [x] #6 Simplified claiming cannot be on while the event has a required question, as with required registration fields
- [ ] #7 A migration moves the questionnaire questions and answers to registration columns and drops the questionnaire completion time; a migration test proves stored questions and answers survive, and the remote test environment migrates with public event reads still working
- [x] #8 The canonical docs describe registration questions and no questionnaire
- [x] #9 Unit, integration and browser tests cover the builder editor, registration with required, optional and choice answers, the participant list answers, and the check-in step without a questionnaire
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Canonical docs were updated or confirmed unchanged
- [x] #2 Code behavior matches canonical docs
- [x] #3 Relevant validation commands pass
- [x] #4 Tests were added or updated when behavior changed
- [x] #5 Test gaps are documented when automation is not practical
- [x] #6 Config and developer workflow docs were updated when setup changed
- [x] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Storage: migration 0088 renames events.questionnaire_questions_json to registration_questions_json, adds user_applications.registration_answers_json (NOT NULL, default []), copies stored questionnaire answers, and drops questionnaire_answers_json and questionnaire_completed_at. Production never had these columns (0082 came after v1.20.10), so the release adds no failure window. Migration test.
2. Rules: one shared module, shared/domains/applications/registration-answers.ts, owns the answer record schema, getRegistrationAnswerIssues, buildRegistrationAnswerRecords and parseRegistrationAnswersJson; the check-in flow modules are removed. Finishing the check-in flow is effective attendance, so credits and photos fill their hasFinishedCheckInFlow fact from isApplicationEffectivelyCheckedIn.
3. API: submit application accepts registrationAnswers, rejects missing required answers, unconfirmed acknowledgments, unknown choices and unknown questions with 422 registration_answers_invalid, and stores one record per question with its text. GET /api/events/slug/:slug exposes registrationQuestions. Event create, update, admin and settings contracts use registrationQuestions. The entry page drops the questionnaire fields. Participant page and application reads expose registrationAnswers. Account deletion resets them, undo withdrawal keeps them. Remove the complete-questionnaire route and its MCP operation and regenerate the catalog and output schemas. Simplified claiming refuses required registration questions on create and on update with the merged stored questions.
4. App: the builder Registration level gets the shared question editor, full width under the field table; the check-in extra keeps only its switch; the checklist names incomplete registration questions on the Registration level; create and edit both send the questions. The registration form shows the questions in Your application with CustomQuestionInput, validates and sends them in question order. The next-step card has two states. The participant list shows the answers under Registration questions.
5. Docs: domain model, lifecycle, schema outline, API surface, permissions matrix, testing strategy.
6. Tests: unit (builder step, create and edit bodies, registration form flow), integration (new registration-questions-routes test, slimmer check-in flow test, credits, photos, challenges, account deletion, MCP snapshot, migration), BDD (check-in flow without question steps, new registration-questions feature).
7. Migrate the demo database, browser check of builder, registration form, next step and participant list (1440 light, 390 dark), full checks, codehygiene, commit, push, test environment check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-11-24: paused before docs and tests. Server, builder and registration form changes are in the working tree, unverified and uncommitted. Alex asked whether registration already had questions; waiting for his choice between own questions in the registration form (current build) and only the fixed registration fields.

2026-11-24, after Alex chose "Own questions":
- Built as planned. The question editor is the shared AdminCustomQuestionEditor (builder variant), placed full width under the field table so long questions fit; the registration form reuses CustomQuestionInput, the same input as talk proposal questions.
- AdminApplicationRecord.registrationAnswers stays optional: only the participant list carries the answers, other workspace pages (operations, certificates, submissions) pass registration records without them.
- GET /api/events/slug/:slug returns registrationQuestions for every event; it is the signed-in read of the registration form, not the cached public event read.
- Demo database migrated to 0088; the demo event keeps its three questions as registration questions.
- Verification: lint, typecheck, unit 720/720, integration 765/765 (two Gallery tab tests now use a participant before check-in, because a checked-in participant can add photos right away), BDD focused 6/6, full BDD 144 passed plus the destructive group (its known flaky MCP token step at account-management.steps.ts:108 failed once with Network.getResponseBody and passed alone on rerun). Codehygiene flags only older lines this change did not touch.
- Browser check on the Vienna preview, 1440 light and 390 dark: builder Registration level with the editor and the three demo questions, Check-in extra with only its switch, registration form with the questions in Your application and in the progress rail, next-step card "You're checked in" with Agenda and Gallery, participant list with Registration questions (answers set on one demo registration for the picture and set back to [] afterwards).
- Visible detail left as it is: the questions mark required with "*" like talk proposal questions, while the fixed fields above use a REQUIRED badge.
<!-- SECTION:NOTES:END -->
