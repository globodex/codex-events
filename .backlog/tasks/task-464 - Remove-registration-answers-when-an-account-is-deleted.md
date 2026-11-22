---
id: TASK-464
title: Remove registration answers when an account is deleted
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T10:48:00Z'
updated_date: '2026-11-22T11:06:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/schema-outline.md
  - server/database/schema.ts
  - server/domains/accounts/index.ts
  - tests/integration/server/api/actor-platform-routes.test.ts
type: enhancement
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Account deletion keeps the registration record of every event. Until now it also kept what the participant wrote in the registration form and in the questionnaire after check-in. Alex decided on 2026-11-22: the registration answers are removed with the account; photos that the participant added stay in the gallery, because participants agree to give them to the organizers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Deleting an account removes the registration form answers and the questionnaire answers of every registration of that user.
- [x] #2 The registration records with their status and attendance stay, and the photos that the participant added stay in the gallery.
- [x] #3 Organizer views show no answers for the registration of a deleted account.
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
1. Docs first: account deletion removes the registration form answers and the questionnaire answers; the registration record, its status and attendance stay; participant photos stay.
2. One constant for the stored value of a registration without answers (the column default) in the schema.
3. deletePlatformAccount clears both answer fields of every registration of the user, in the same batch as the other deletions.
4. Integration test next to the existing account deletion test.
5. Validate and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in the main session on 2026-11-22. deletePlatformAccount now also resets registration_details_json to the value of a registration without answers (one constant, emptyRegistrationDetailsJson, which is also the column default) and sets questionnaire_answers_json to null for every registration of the user, in the same batch as the other deletions. questionnaire_completed_at, the status and the attendance stay. Photos are not touched. The participant list already leaves out registrations of deleted accounts; other organizer reads get the emptied fields. Validation on the final tree: lint, typecheck, unit (736), integration (708, one new test), browser suite (125 plus 1), readability check, git diff --check. No UI change, so no browser check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deleting an account now also removes what the participant wrote in every registration: the registration form answers and the questionnaire answers. The registration records stay with their status, attendance and questionnaire completion time, and the photos that the participant added to a gallery stay.

What changed: one more statement in the account deletion batch (server/domains/accounts/index.ts), one schema constant for a registration without answers, docs, and an integration test that also proves another participant keeps their answers and the photo stays.

Verification: lint, typecheck, unit, integration and the full browser suite pass.

Risks and follow-ups: accounts deleted before this change keep their old answers; removing those needs a one-time data fix if wanted.
<!-- SECTION:FINAL_SUMMARY:END -->
