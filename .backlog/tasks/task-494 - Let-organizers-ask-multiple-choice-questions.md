---
id: TASK-494
title: Let organizers ask multiple-choice questions
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-24T23:07:00Z'
updated_date: '2026-11-24T23:16:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - shared/domains/events/custom-questions.ts
  - shared/domains/applications/registration-answers.ts
  - app/domains/applications/participant-registration-definition.ts
  - app/domains/talk-proposals.ts
  - app/components/events/molecules/CustomQuestionControl.vue
  - app/components/events/molecules/CustomQuestionInput.vue
  - app/components/events/molecules/CustomQuestionAnswerReview.vue
  - app/components/admin/builder/molecules/AdminBuilderCustomQuestionCard.vue
  - app/components/admin/organisms/AdminCustomQuestionEditor.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationApplicationSection.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationForm.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationTalkProposalSection.vue
  - app/components/account/events/AccountEventTalkProposalPanel.vue
  - server/application/operations/generated-output-schemas.ts
  - docs/domain-model.md
  - docs/schema-outline.md
  - tests/unit/shared/domains/events/custom-questions.test.ts
  - tests/integration/server/api/registration-questions-routes.test.ts
  - tests/bdd/features/authenticated/registration-questions.feature
  - tests/bdd/steps/registration-questions.steps.ts
  - tests/bdd/support/platform-fixtures.ts
ordinal: 211000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For the Vienna Build Day on 28 November 2026, TU Wien and the EULiST alliance need to know each participant's connection to them, and one person can have several (for example a TU Wien student who is also an exchange student). Alex asked on 2026-11-25 for a 'tick all that apply' question before the live event is created. Custom questions are shared by the registration form and the Call for talks, so the new type works in both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An organizer can add a multiple-choice question with 2 to 20 unique choices to the registration questions in the event builder and to the Call for talks questions.
- [ ] #2 A participant can tick one or more choices; a required multiple-choice question needs at least one ticked choice.
- [ ] #3 Organizers read the ticked choices in the registration review and in the talk proposal review.
- [ ] #4 Docs and tests cover the question type.
- [ ] #5 The server refuses a choice the question does not have and a choice sent twice, and stores the ticked choices as a list.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shared/domains/events/custom-questions.ts: add multiple_choice; one rule for questions with choices (single and multiple); answer value schema and type with a list of choices; empty value []; one shared answered check; validation of ticked choices.
2. Use the shared value type and answered check in the registration definition, the talk proposal helpers and the form components.
3. CustomQuestionControl shows a checkbox group; both question editors offer Multiple choice; CustomQuestionAnswerReview lists the ticked choices one per line.
4. Docs and regenerated output schemas.
5. Unit tests for the validation, an integration test for a registration with ticked choices, and the registration question browser scenario.
6. Lint, typecheck, unit, integration and browser checks; commit; production release (Alex allowed it on 2026-11-25).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. The question type multiple_choice lives in shared/domains/events/custom-questions.ts with the other types: customQuestionHasChoices names the types with choices (both editors and the definition rule use it), customQuestionAnswerValueSchema and CustomQuestionAnswerValue are the one answer value (text, boolean, or the list of ticked choices), getEmptyCustomQuestionAnswerValue gives [] for it, and isCustomQuestionAnswered is the one answered check (server validation, talk proposal counts). The server refuses a choice that is not in the question or one sent twice ('Tick only the available options, each once.'). It keeps the order the form sends; CustomQuestionControl always sends the question order. No new component: CustomQuestionControl (closest analog, it already renders every question type) shows a group of AppCheckbox, named by the question for screen readers; the registration field gives it no label 'for', like an acknowledgment. CustomQuestionAnswerReview shows one ticked choice per line, because choices can contain commas; the participant list and the talk proposal review both use it. The choice rule messages now say 'Choice questions need at least two choices.' and 'Only choice questions can have choices.' Checks: lint, typecheck, unit tests (720), the registration, talk proposal and application integration tests (94), the registration question and talk proposal browser scenarios, and pictures of the registration form with Julius's questions at 1440 px light and 390 px dark (local demo event, questions restored afterwards).
<!-- SECTION:NOTES:END -->
