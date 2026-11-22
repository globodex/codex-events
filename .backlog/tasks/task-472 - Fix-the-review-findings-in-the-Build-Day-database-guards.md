---
id: TASK-472
title: Fix the review findings in the Build Day database guards
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T18:59:00Z'
updated_date: '2026-11-22T19:20:00Z'
labels: []
milestone: m-3
dependencies:
  - TASK-471
references:
  - drizzle/0085_build_day_guards.sql
  - server/domains/applications/luma-email.ts
modified_files:
  - server/domains/credits/index.ts
  - server/api/events/[eventId]/credits/[creditId]/actions/claim.post.ts
  - tests/integration/server/api/credit-claim-check-in-flow-routes.test.ts
  - server/api/admin/events/[eventId]/actions/backfill-luma-emails.post.ts
  - tests/integration/server/api/admin-luma-backfill-routes.test.ts
  - server/domains/applications/luma-email.ts
  - server/api/events/[eventId]/index.patch.ts
  - server/domains/events/luma-webhook-registration.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - server/domains/applications/luma-config.ts
  - server/http/api-error.ts
  - shared/domains/events/photos.ts
  - tests/integration/server/api/participant-photo-routes.test.ts
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/testing-strategy.md
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
type: bug
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A review of the uncommitted TASK-471 work found five problems. An organizer who links an event to Luma while two active registrations share a Luma email gets a refusal that does not say which registrations conflict; the same database rule turns into a raw database error when the Luma webhook is registered. The Luma email backfill stops at the first conflict instead of reporting every account. The credit claim write repeats the whole claim access rule in SQL, next to the shared TypeScript rule. The Luma link rule and the participant photo limit exist in TypeScript and in migration 0085 with no test that compares the two copies. The Credits tab shows an empty band above the next-step notice, and the notice is a card inside a card.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An organizer who turns on the Luma guest list or connects Luma while two active registrations share a Luma email reads which registrations they are, and the event is not linked.
- [x] #2 The Luma email backfill reports a conflicting account as failed and continues with the other accounts.
- [x] #3 The credit claim decides access with the shared claim rule only. The claim write does not repeat that rule in SQL.
- [x] #4 A test fails when the Luma link rule or the participant photo limit differs between TypeScript and the database.
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
1. Credit claim: remove the SQL copy of the access rule from allocateEventCreditCode; the route keeps its access check before the write.
2. Backfill: record a Luma email conflict as a failed account and continue.
3. Luma link: assertNoSharedLumaEmailInEvent in luma-email.ts finds active registrations sharing a Luma email. The event update asks it before the guest list turns on. The webhook registration asks it before Luma is called and stores the refusal as the reason of the failed status. The event builder shows that stored reason.
4. Tests: compare isEventLinkedToLuma with the database view for every part of the rule; build the photo limit message from the shared constant and test the trigger against the constant.
5. Credits tab: measured in the browser and withdrawn (see notes).
6. Update the canonical docs, then run lint, typecheck, unit, integration and browser tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Credits tab finding withdrawn after measuring in the browser. The space above the next-step notice is 44px: 24px gap of the shared AppCard between header and body plus the 20px body padding. The Gallery card has the same rhythm (40px) and the committed version of the Credits card had it too. The notice is the shared AppAlert, the same component every other notice in this card uses. Both are app-wide components, so nothing was changed.

Credit claim: allocateEventCreditCode now only takes the oldest free code unless the person already holds one. The access decision stays in requireEventCreditClaimAccess, which runs before the write. Removed the error event_credit_claim_changed and the test that revoked check-in between the access check and the write. TASK-471 criterion 2 names the credit write among the writes that enforce eligibility under concurrency; for the credit claim that is no longer true by decision of Alex (2026-11-22): the gap is the moment between the access check and the write.

Backfill: a Luma email that another active registration of the event already uses is one failed account in the report, with the readable reason from toApiError. The request answers 200 and the other accounts are still processed.

Luma link: the event builder shows the guest list switch only while Luma is connected, so in the product the link happens when the webhook is registered. That path is the one an organizer meets. The server stores the refusal in luma_webhook_error; the builder notice 'Luma is not connected' now shows the stored reason and falls back to the old hint when none is stored. The classic settings form already showed the stored reason. The guest list refusal (409 luma_email_shared_in_event) covers callers of the API and MCP.

Comparison tests were proven by mutation: with the webhook status condition removed from isEventLumaAttendanceSyncEnabled two link cases fail; with maxParticipantPhotosPerEvent set to 19 the photo limit test fails. Both files were restored.

Browser check of the organizer message (local preview, demo event, staged with fake Luma credentials and two people sharing one Luma email, restored afterwards): Save and connect in the event builder answers 200 and the notice reads 'Luma is not connected. These people registered with the same Luma email: Alan Turing, Ada Lovelace. Withdraw all but one of their registrations, then save again.' at 1440px dark and 390px light. The refusal happens before Luma is called.

Validation on the final working tree (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 727 tests passed; bun run test:integration 52 files, 764 tests passed (run before the last change, which only touched AdminBuilderLumaConnection.vue); bun run test:bdd 126 passed plus 1 destructive passed; bun run mcp:generate-output-schemas produced no change; git diff --check clean. codehygiene on the changed .ts files: one dense line in a new test was split; the remaining flags are on lines this task did not change.

Test gap: no automated test reads the notice 'Luma is not connected' in the event builder. It was checked by hand in the local preview (see the browser check above). The server behavior behind it is covered by two integration tests in luma-guest-list-routes.test.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed four findings from the review of TASK-471, on top of that uncommitted work. (1) An event cannot be linked to Luma while two active registrations share a Luma email, and the organizer now reads who they are: turning on the guest list answers 409 luma_email_shared_in_event, the Luma webhook is not registered and its failed status stores the same sentence, and the event builder shows that stored reason. (2) The Luma email backfill reports a conflicting account as failed and continues. (3) The credit claim write only takes the oldest free code; the access rule lives in the shared TypeScript rule alone. (4) Two tests compare the TypeScript and SQL copies of the Luma link rule and of the participant photo limit, and comments at both rules point to the other copy. A fifth finding about the Credits tab layout was withdrawn after measuring: the spacing and the notice are the shared card and alert components. Checks: lint, typecheck, 727 unit, 764 integration, 126 + 1 browser tests. Risks and follow-ups: migration 0085 fails on a database where two active registrations of a Luma-linked event already share a Luma email, so the test and production databases need that check before the migration runs. The credit claim no longer rechecks access inside the write; the gap is the moment between the access check and the write. The builder notice now shows the stored reason for every failed Luma connection, not only for shared emails.
<!-- SECTION:FINAL_SUMMARY:END -->
