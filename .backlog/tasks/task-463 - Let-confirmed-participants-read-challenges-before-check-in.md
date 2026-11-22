---
id: TASK-463
title: Let confirmed participants read challenges before check-in
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T10:48:00Z'
updated_date: '2026-11-22T10:58:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - README.md
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/domains/events/builder.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/testing-strategy.md
  - server/domains/events/challenges.ts
  - shared/domains/events/challenges.ts
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/steps/challenges.steps.ts
  - tests/bdd/steps/check-in-flow.steps.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
type: enhancement
ordinal: 179000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex decided on 2026-11-22 that challenges are for every confirmed participant, not only for checked-in ones. He wants participants to read the challenges on the platform some days before the Build Day and get ready; most will read them during the event day. TASK-450 gated reading on the finished check-in flow; that gate is removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A participant with a confirmed registration reads the published challenges of the event without being checked in.
- [x] #2 Nobody without a confirmed registration or an event role receives challenge content, and drafts stay in the event builder only.
- [x] #3 Before check-in, the participant's next step on the event page also links to the challenges.
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
1. Docs first: challenge readers are staff, admins and every approved participant (domain model, permissions, lifecycle, api surface, testing strategy, README).
2. Remove the check-in input from canReadEventChallenges and from listReadableEventChallenges.
3. Next-step card: each activity says whether it is open before check-in; the check-in step lists those (Agenda, Challenges).
4. Update the integration tests and the browser scenario for a participant who is not checked in.
5. Validate and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in the main session on 2026-11-22. canReadEventChallenges no longer asks about check-in: event staff, admins and every approved participant read the published challenges. The next-step card takes one activities list; each activity says whether it is open before check-in (Agenda, Challenges), and the check-in step lists those. Validation on the final tree: lint, typecheck, unit (736), integration (707), browser suite (125 plus 1), readability check, git diff --check; the card before check-in was checked in the local preview at phone width. No test gap; setup unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every confirmed participant now reads the published challenges of an event, also before the event and without being checked in. The Challenges tab and the challenge content stay closed to people without a confirmed registration or an event role, and drafts stay in the event builder. While a participant still has to check in, the box with their next step links to the agenda and the challenges.

What changed: the reader rule in shared/domains/events/challenges.ts and its server function lost the check-in input; the next-step card lists the activities that are open before check-in from the same activities list of the event page; docs, the integration tests and the browser scenario follow the new rule.

Verification: lint, typecheck, unit, integration and the full browser suite pass; checked in the local preview.

Risks and follow-ups: none known. Credits and participant photos still need a finished check-in.
<!-- SECTION:FINAL_SUMMARY:END -->
