---
id: TASK-449
title: Offer existing event credit claims alongside activities
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-22T05:55:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-448
references:
  - docs/domain-model.md
modified_files:
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/api-surface.md
  - docs/lifecycle-and-state-machines.md
  - docs/testing-strategy.md
  - server/domains/applications/check-in-flow.ts
  - shared/domains/credits/claim-access.ts
  - server/domains/credits/index.ts
  - server/api/events/[eventId]/credits/index.get.ts
  - server/domains/events/account-event-entry-page.ts
  - app/pages/account/events/[slug]/index.vue
  - app/components/account/events/AccountEventCreditsPanel.vue
  - stories/participant/AccountEventCreditsPanel.stories.ts
  - tests/integration/server/api/credit-claim-check-in-flow-routes.test.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/steps/check-in-flow.steps.ts
  - tests/bdd/steps/credit-claims.steps.ts
  - tests/bdd/features/authenticated/credit-claims.feature
type: enhancement
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants who have completed the check-in flow can use the existing credit giveaway while they start work on challenges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eligible checked-in participants can claim available credits through the existing event credit flow once any configured questionnaire is complete.
- [x] #2 Credit claims remain optional and do not block challenges or gallery uploads.
- [x] #3 When the event inventory runs out the giveaway ends and participants can continue with event activities.
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
1. Docs first (current-state language): credit claim rule with the check-in flow in docs/domain-model.md and docs/permissions-matrix.md, the claim guard and its error code in docs/api-surface.md, coverage in docs/testing-strategy.md, the finished position in docs/lifecycle-and-state-machines.md.
2. Server helper (no credit knowledge): hasApplicationFinishedCheckInFlow(event, application) in server/domains/applications/check-in-flow.ts. It reads the stored event and registration and calls the shared rule hasParticipantFinishedCheckInFlow.
3. One owner of the rule 'may this person claim credits in this event': resolveEventCreditClaimAccess in shared/domains/credits/claim-access.ts (pure, three answers: can_claim, must_finish_check_in_flow, cannot_claim). Server reads its inputs from records in server/domains/credits/index.ts; the credits list, the claim operation and the entry page loader all ask it. Remove the duplicated approved-or-staff checks.
4. Claim operation: an approved participant of an event with the check-in flow on who has not finished it gets 409 event_credit_check_in_flow_unfinished and no claim is written. Sold out stays 409 event_credit_sold_out. The list and the entry page keep showing a participant's own claimed code.
5. Participant UI: the account event page asks the same shared rule with the entry page data it already has (no new request). AccountEventCreditsPanel shows a short note with a link to the overview instead of the claim action, and says plainly when an offer has no credits left. The next-step card keeps listing Credits while the tab is available.
6. Tests: integration tests for the claim rule (flow on: before check-in, questionnaire open, after questionnaire, no questionnaire; flow off; staff; existing claim stays visible; last code), browser scenarios tagged @task-449 on dedicated fixture events.
7. Validation: lint, typecheck, unit, integration, bdd, git diff --check, codehygiene on changed files, browser screenshots of the local preview.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rule owner: `resolveEventCreditClaimAccess` in `shared/domains/credits/claim-access.ts` answers `can_claim`, `must_finish_check_in_flow` or `cannot_claim`. The server reads its inputs from the stored event and registration with `getEventCreditClaimAccess` (`server/domains/credits/index.ts`). Four places used to write the approved-or-staff rule themselves (credit list, claim operation, entry page loader, account event page in the app). All four now ask the owner.

Server helper for later tasks: `hasApplicationFinishedCheckInFlow(event, application)` in `server/domains/applications/check-in-flow.ts`. It knows nothing about credits. In an event with the check-in flow off it is true as soon as the participant is checked in, so a feature that must stay open without check-in there reads `event.checkInFlowEnabled` first, as the credit rule does.

Claim refusal: `409 event_credit_check_in_flow_unfinished` with the message "Finish your check-in on the event page before you claim credits." It also applies to a participant who already holds a value of the offer; the credit list and the entry page keep showing that value.

UI decisions: the note "Finish your check-in to claim credits" with the link "See your next step" sits at the top of the claim card, because offers are collapsed by default. The note shows only while an offer still has a value for the participant to claim. The link shows only while the overview shows the next-step card, so not in a completed event. After a refused claim the panel reads the page again. An offer whose values are all claimed says "No credits left"; an offer without uploaded values keeps "Not available". No new component: AppAlert and AppButton.

No migration and no contract change. `mcp:generate-output-schemas` and `mcp:generate-operation-catalog` produce no diff.

Test gaps: (1) No browser test for a claim that is refused after the page was loaded (another participant took the last value, or the check-in was undone). Integration tests cover the server refusal; the page refresh after the refusal is not automated. (2) The note without a link in a completed event was checked by hand in the local preview only. (3) The "Not available" label of an offer without uploaded values has no test. (4) Staff claims are covered by integration tests only.

AC #2 evidence and limit: challenges (TASK-450) and participant photo uploads (TASK-451) do not exist yet. Nothing reads a credit claim as a condition: the shared check-in rule and the new server helper know nothing about credits, and the browser scenario for an event with no credits left shows the next-step activities for a participant without a claim.

Review (2026-11-22): read the full diff; re-ran lint, typecheck, unit (733), integration (613), the full browser suite (120 plus 1), the readability check and git diff --check on the final tree; looked at the screenshots and checked the local preview data. No code changes were needed in review. Acceptance criterion 2 is proven for today's activities; TASK-450 and TASK-451 add their own test that a participant without a credit claim can use challenges and photo uploads.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## What changed

In an event with its check-in flow on, a confirmed participant can claim event credits only after finishing the check-in flow (checked in, and questionnaire completed when the event has one). Event staff claim as before in every event. Events with the check-in flow off keep their credit behavior. Simplified claiming is not touched.

- One rule owner: `resolveEventCreditClaimAccess` (`shared/domains/credits/claim-access.ts`). The credit list, the claim operation, the entry page loader and the account event page all ask it; the four copies of the approved-or-staff check are gone.
- New server helper without credit knowledge for later tasks: `hasApplicationFinishedCheckInFlow` (`server/domains/applications/check-in-flow.ts`).
- Claim operation: `409 event_credit_check_in_flow_unfinished` for a participant who has not finished; nothing is written. Sold out stays `409 event_credit_sold_out`. A participant keeps seeing a value they already claimed.
- Credits tab: note "Finish your check-in to claim credits" with a link to the overview instead of the claim button; "No credits left" on an offer whose values are all claimed; the next-step card keeps listing Credits. No new request, no new component, no migration, no contract change.
- Canonical docs updated first: domain model, permissions matrix, API surface, lifecycle, testing strategy.

## Verification

- `bun run lint`, `bun run typecheck`, `bun run test:unit` (733 passed), `bun run test:integration` (613 passed, 11 new in `credit-claim-check-in-flow-routes.test.ts`), `bun run test:bdd` (120 + 1 passed, 4 new scenarios tagged `@task-449`), `git diff --check`: all pass.
- Readability check on changed `.ts` files: 0 flags.
- Local preview: Credits tab of the demo participant before the steps, after the steps and with no credits left, at 390x844 and 1440x900, light and dark.

## Risks and follow-ups

- Open product question: after an event is completed, a participant who never finished the check-in flow cannot claim, and the overview shows no next step. The Credits tab then shows the note without a link. Decide what such a participant should read.
- AC #2 names challenges and gallery uploads. Both arrive with TASK-450 and TASK-451; they must reuse `hasApplicationFinishedCheckInFlow` and must not read credit claims.
- The header text of the claim card still says "inventory" and "value" (older copy, not changed here).
- Test gaps are listed in the implementation notes.
<!-- SECTION:FINAL_SUMMARY:END -->
