---
id: TASK-448
title: Show the next participant step after check-in
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-22T05:07:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-444
references:
  - docs/lifecycle-and-state-machines.md
modified_files:
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - shared/domains/events/custom-questions.ts
  - shared/domains/talk-proposals/questions.ts
  - shared/domains/talk-proposals/answer-issues.ts
  - tests/unit/shared/domains/events/custom-questions.test.ts
  - tests/unit/shared/domains/talk-proposals/questions.test.ts
  - app/components/events/molecules/CustomQuestionInput.vue
  - app/components/talk-proposals/molecules/TalkProposalQuestionInput.vue
  - app/components/events/molecules/CustomQuestionAnswerReview.vue
  - app/components/talk-proposals/molecules/TalkProposalAnswerReview.vue
  - app/components/admin/organisms/AdminCustomQuestionEditor.vue
  - >-
    app/components/admin/talk-proposals/organisms/AdminTalkProposalQuestionEditor.vue
  - app/components/admin/builder/molecules/AdminBuilderCustomQuestionCard.vue
  - >-
    app/components/admin/builder/molecules/AdminBuilderTalkProposalQuestionCard.vue
  - app/components/account/events/AccountEventTalkProposalPanel.vue
  - app/components/account/events/AccountEventTalkProposalReviewPanel.vue
  - app/components/admin/EventTalkProposalControl.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationTalkProposalSection.vue
  - app/domains/applications/participant-application.ts
  - app/domains/applications/participant-registration-definition.ts
  - app/domains/events/admin-event.ts
  - app/domains/events/records.ts
  - app/domains/talk-proposals.ts
  - server/api/events/slug/[slug]/index.get.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-shell.ts
  - server/domains/events/index.ts
  - server/domains/talk-proposals/index.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-settings-page.ts
  - tests/unit/app/composables/account-event-parent-page-topology.test.ts
  - drizzle/0082_event_check_in_flow.sql
  - server/database/schema.ts
  - shared/domains/applications/check-in-flow.ts
  - server/domains/applications/check-in-flow.ts
  - >-
    server/api/events/[eventId]/applications/me/actions/complete-questionnaire.post.ts
  - server/domains/applications/index.ts
  - >-
    server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post.ts
  - server/domains/events/account-event-participants-page.ts
  - shared/domains/events/account-event-participants-page.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - app/domains/events/builder.ts
  - app/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/pages/account/events/[slug]/index.vue
  - app/domains/applications/admin-application-record.ts
  - app/components/applications/AdminApplicationsReviewPanel.vue
  - tests/integration/server/api/check-in-flow-routes.test.ts
  - tests/unit/server/domains/applications/index.test.ts
  - tests/unit/server/domains/events/index.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/authenticated/check-in-flow.feature
  - tests/bdd/steps/check-in-flow.steps.ts
  - docs/testing-strategy.md
  - README.md
type: feature
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A participant arriving at an event needs to see the next thing to do without browsing the full account workspace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A confirmed participant can browse the agenda sessions before check-in.
- [x] #2 After check-in the account page presents the event questionnaire when configured and tracks completion.
- [x] #3 Events can omit the questionnaire. The account page then opens the available activities directly after check-in.
- [x] #4 The account page shows one clear next action and keeps participant-facing text brief.
- [x] #5 The flow and questionnaire are optional per event and use the same result for Luma and staff check-ins.
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
- [x] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Docs first (current-state language): domain-model, lifecycle-and-state-machines, permissions-matrix, schema-outline, api-surface, testing-strategy; mcp.md only if the inventory text needs it.
2. Mechanical rename, no behavior change for Call for talks: move the generic question model (types, definition/list/answer schemas, answer checks) from shared/domains/talk-proposals/questions.ts to shared/domains/events/custom-questions.ts under neutral names; keep the Call-for-talks wording in a talk-only function; give the question input, the question editor and the builder question card neutral names and homes; update every caller; no aliases.
3. Data: migration drizzle/0082 adds events.check_in_flow_enabled, events.questionnaire_questions_json, user_applications.questionnaire_answers_json, user_applications.questionnaire_completed_at; mirror in server/database/schema.ts.
4. One rule owner in shared/domains/applications/check-in-flow.ts (next to check-in.ts): eventHasQuestionnaire, hasParticipantFinishedCheckInFlow, stored answer shape, questionnaire answer checks.
5. Server: PATCH /api/events/:eventId accepts checkInFlowEnabled and questionnaireQuestions; admin event serialization and settings contract carry them; new POST /api/events/:eventId/applications/me/actions/complete-questionnaire; entry page contract carries the switch, the questions and the completion time; participant list rows and application reads carry the answers; restoring a withdrawn registration clears the questionnaire fields; MCP eligibility entry plus regenerated catalog, output schemas and snapshot.
6. App: event form state and one builder settings group (switch plus the shared question editor); next-step card at the top of the participant overview with three states; participant list shows the answers next to the registration answers.
7. Tests: existing question-model unit tests under the new names; integration tests for settings, entry page states, the answer operation, Luma and staff check-in parity, readable answers after a question change, restore, and who can read answers; BDD scenarios tagged @task-448 on dedicated fixture events.
8. Validation (lint, typecheck, unit, integration, bdd, git diff --check), readability check, apply the migration to the local preview, demo data and screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision by Alex on 2026-11-22: the questionnaire is a short list of questions written by the organizer in the event builder, like the existing call-for-talks questions. Answers are saved per participant and organizers can read them.

Design as built (2026-11-22):
- Data: migration drizzle/0082 adds events.check_in_flow_enabled and events.questionnaire_questions_json, and user_applications.questionnaire_answers_json and questionnaire_completed_at. Stored answers keep questionId, prompt and value.
- Rule owner: shared/domains/applications/check-in-flow.ts (eventHasQuestionnaire, hasParticipantFinishedCheckInFlow, stored answer shape, questionnaire answer checks). Server storage helpers: server/domains/applications/check-in-flow.ts.
- Organizer: PATCH /api/events/:eventId accepts checkInFlowEnabled and questionnaireQuestions for every event type. The event builder has the group "After check-in" (existing events only) with the switch and the shared question editor.
- Participant: POST /api/events/:eventId/applications/me/actions/complete-questionnaire. The entry page carries checkInFlowEnabled, questionnaireQuestions and questionnaireCompletedAt. The overview shows the card AccountEventNextStepCard with three states.
- Readers: participant list rows and application reads carry questionnaireAnswers; staff, event admins and platform admins read them in the participant list.
- MCP: the new route is included in the eligibility manifest (signed-in structured JSON application operation); catalog, output schemas and the MCP snapshot were regenerated.

Neutral question model (mechanical rename, no behavior change for Call for talks):
- shared/domains/talk-proposals/questions.ts moved to shared/domains/events/custom-questions.ts with CustomQuestion* names. The Call for talks wording for an unknown question lives in shared/domains/talk-proposals/answer-issues.ts (getTalkProposalAnswerIssues).
- Components renamed: CustomQuestionInput and CustomQuestionAnswerReview (app/components/events/molecules), AdminCustomQuestionEditor (app/components/admin/organisms), AdminBuilderCustomQuestionCard.
- Small interface changes that the reuse needed: the editor takes lockedReason (the talk-only lock message moved to EventTalkProposalControl) and gives its heading a unique id; the answered-question component takes prompt, required and value; getEmptyCustomQuestionAnswerValue replaces four copies of the same expression.

Component decision: the new organism app/components/account/events/organisms/AccountEventNextStepCard.vue. Closest analog: AccountEventTalkProposalPanel.vue (an AppCard with custom question inputs and one send action). It is not enough because it is tied to the Talk proposal lifecycle (title, abstract, draft, submit, withdraw) and has no check-in or activities state. The card reuses AppCard, AppButton, AppAlert and CustomQuestionInput.

Decisions inside the confirmed design:
- The builder group is shown for existing events only, because the design saves the settings through the event update and not through event creation.
- A completed event shows no next-step card.
- The questions stay stored while the switch is off.
- The agenda link opens the Agenda tab when the event has sessions, otherwise the Details tab with its agenda.
- After a failed answer request the card reads the page again, so a participant sees the current questions when the organizer changed them meanwhile.
- All new functions have cccc cognitive complexity of 4 or less, so they have no unit tests of their own; integration and browser tests cover them.

Test gaps:
- Two answer requests at the same moment (the conditional update that returns no row) have no automated test. A second request after the first one is tested.
- The card behavior when the organizer changes the questions while a participant has the form open is not automated in the browser. The server rejection of an answer to a removed question is tested.
- The classic settings form sends both settings back unchanged; there is no dedicated test for that round trip.
- The three card states and the builder group were checked by eye on screenshots (390x844 and 1440x900, light and dark); there is no visual regression test.

Evidence (2026-11-22, final state):
- AC1: browser scenario "Confirmed participant is told to check in and can open the agenda" (not checked in, opens the Agenda tab, sees the session).
- AC2: browser scenario "Participant answers the event questions after a staff check-in" and integration tests for the entry page states and the stored completion.
- AC3: browser scenario "Event without questions shows the activities right after check-in" and the matching integration test.
- AC4: one card with one heading per state; screenshots of the three states at 390x844 and 1440x900 in light and dark.
- AC5: integration tests for the switch, for events without questions, and "a Luma check-in and a staff check-in lead to the same steps"; browser scenario "Event that does not use the next step keeps its page".
- DoD3: bun run lint, bun run typecheck, bun run test:unit (733 passed), bun run test:integration (602 passed), bun run test:bdd (116 passed plus 1 destructive) and git diff --check all pass. DoD6: no setup change; the migration is applied by the standard migration command.

Review (2026-11-22): read the full diff; re-ran lint, typecheck, unit, integration, the full browser suite, the readability check and git diff --check on the final tree. Changed in review: buildEventConfigurationPatch sends questionnaireQuestions only while checkInFlowEnabled is true (before, an unfinished question hidden behind the switched-off setting made the save fail with a generic validation message); docs/domain-model.md states that turning the check-in flow off keeps the stored questions; two empty component folders left by the rename were removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A confirmed participant of an event that uses the check-in flow sees one next-step card at the top of the event page: check in at the entrance, then answer the organizer's questions once, then open the event's activities (agenda, and credits when available). The flow is a switch per event and the questionnaire is optional inside it. Organizers set both in the event builder group "After check-in" and read the answers in the participant list.

What changed: migration 0082 (two event columns, two registration columns); one shared rule owner for the flow (shared/domains/applications/check-in-flow.ts); a new participant operation to complete the questionnaire; the entry page, participant list rows and application reads carry the new data; restoring a withdrawn registration clears the questionnaire. The Call for talks question model and its question components now have neutral names so both features use them; Call for talks behavior is unchanged. The event form sends the questions only while the switch is on, so the event keeps its stored questions while the switch is off and a hidden unfinished question cannot block a save.

Verification: lint, typecheck, unit (733), integration (602) and browser tests (116 plus 1) pass on the final tree; the three card states and the builder group were checked in the local preview on phone and desktop sizes in both themes; saving with the switch off and an unfinished hidden question was checked by hand in the preview.

Risks and follow-ups: event creation does not accept the settings, so the builder group appears for existing events only; the card appears as soon as the switch is on, also before the event day; account deletion keeps the answers on the retained registration record like the other registration answers; the overview shows an agenda link in the card and the existing agenda button below it; the next tasks (credits, challenges, photos) use hasParticipantFinishedCheckInFlow and add their entry to the activities list on the event page.
<!-- SECTION:FINAL_SUMMARY:END -->
