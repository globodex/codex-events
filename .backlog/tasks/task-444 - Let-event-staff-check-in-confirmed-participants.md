---
id: TASK-444
title: Let event staff check in confirmed participants
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-22T02:12:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-443
references:
  - docs/permissions-matrix.md
  - TASK-211
  - TASK-212
  - TASK-214
modified_files:
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/api-surface.md
  - docs/schema-outline.md
  - shared/domains/applications/check-in.ts
  - server/database/schema.ts
  - shared/domains/events/account-event-participants-page.ts
  - shared/domains/events/account-event-operations-page.ts
  - app/domains/applications/participant-application.ts
  - app/domains/applications/admin-application-record.ts
  - server/domains/applications/check-in.ts
  - server/api/public/events/[slug]/luma/webhooks.post.ts
  - >-
    server/api/events/[eventId]/applications/[applicationId]/actions/check-in.post.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - app/components/applications/AdminApplicationsReviewPanel.vue
  - app/components/account/events/AccountEventParticipantsPanel.vue
  - app/composables/useParticipantCheckIn.ts
  - app/components/account/events/AccountEventParticipantVisibilityPanel.vue
  - app/components/account/events/AccountEventAdminOperationsPanel.vue
  - server/domains/events/account-event-participants-page.ts
  - stories/features/AdminApplicationsReviewPanel.stories.ts
  - tests/integration/server/api/staff-check-in-routes.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/authenticated/staff-check-in.feature
  - tests/bdd/steps/staff-check-in.steps.ts
  - docs/testing-strategy.md
  - README.md
type: feature
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Staff need to help a participant at the entrance when their Luma check-in is late or missing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Event staff can check in a confirmed participant for their event from the participant list.
- [x] #2 Manual and Luma check-in open the same participant step, and repeated updates do not duplicate attendance.
- [x] #3 Pending registrations cannot be checked in to unlock the participant flow.
- [x] #4 Staff actions are limited to the correct event and recorded through the existing audit controls.
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
1. Docs first (current-state language): domain-model (check-in rules), permissions-matrix (new 'Check in participant' row), schema-outline (check_in_source adds staff), api-surface (new check-in operation), testing-strategy (judge persona is staff in the staff check-in fixture event).
2. One list of check-in sources: export applicationCheckInSources (luma, simplified_claim, staff) from shared/domains/applications/check-in.ts and reuse it in server/database/schema.ts, the zod page contracts and the app record types. No migration: check_in_source is a plain text column without a CHECK constraint.
3. One owner for 'record a check-in once': server/domains/applications/check-in.ts recordFirstApplicationCheckIn (conditional update: approved and no check-in yet). The Luma webhook and the new staff action both use it; the webhook keeps its behavior and audit action.
4. New operation POST /api/events/:eventId/applications/:applicationId/actions/check-in guarded by requireEventApplicationVisibilityContext (staff of the event, event admins, platform admins). Not approved -> 409 application_not_approved. Override not_joined -> 409 with a clear message. Already checked in or override joined -> success, no write, no audit. Real check-in -> audit user_application.staff_check_in_recorded with { eventId, userId, checkedInAt }.
5. MCP: add the route to the eligibility manifest as include (signed-in structured JSON application operation, same as override-check-in), regenerate the catalog and output schemas, update the tool-catalog snapshot.
6. UI: 'Check in' action on confirmed, not checked-in rows of the shared participant list (AdminApplicationsReviewPanel), placed next to the name so it stays visible on a phone. Staff panel and admin panel call the action through one composable (useParticipantCheckIn), replace the row locally and show the server message in a toast when it fails. Attendance (badge, summary card, filter) shows for every event because staff check-in must work when Luma is not connected or fails. Add the 'Checked in by event staff' label.
7. Tests: integration tests for the route matrix (actors, statuses, idempotency, Luma before/after, override), BDD feature @task-444 with a dedicated fixture event where the judge persona is staff.
8. Validation: lint, typecheck, unit, integration, bdd, git diff --check, readability check, real-browser screenshots at 390 and 1440 in light and dark.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions:
- No migration: check_in_source is a plain text column without a CHECK constraint (verified with a drizzle-kit probe). The source list lives once in shared/domains/applications/check-in.ts; server/database/schema.ts imports it with a relative path because tools such as drizzle-kit load the schema without the Nuxt aliases.
- One owner for the first check-in: server/domains/applications/check-in.ts recordFirstApplicationCheckIn. The Luma webhook and the staff action use it. Simplified claiming keeps its own atomic claim statement with the same rule.
- Staff action guard: requireEventApplicationVisibilityContext (staff of the event, event admins, platform admins). New 409 code application_marked_not_joined for the admin override not_joined.
- MCP: the route is included in the eligibility manifest (signed-in structured JSON application operation, same as override-check-in). The tool-catalog snapshot grows by 72 bytes for staff, event admin, combined and platform admin.
- UI: the Check in action sits next to the participant name in the shared list so it stays visible on a phone. Staff and admin panels share useParticipantCheckIn; the row is replaced locally and a failed check-in shows the server message in a toast.
- Attendance (row badge, Checked in card, Checked in filter) now shows for every event. The old rule showed it only with a configured Luma check-in webhook or simplified claiming, which would hide staff check-ins exactly when Luma is missing or broken. The helper shouldShowApprovedParticipantAttendanceSummary and the five Luma fields of the participants page that only it read are removed.
- The Check in button uses the soft primary style: the solid primary AppButton loses its label on hover in the light theme (existing wrapper behavior, not changed here).
- BDD: the judge persona is event staff of a dedicated fixture event (staff-check-in-fixture-event); no new persona.

Test gaps:
- The branch for two check-ins at the same moment (a Luma check-in lands between the read and the write of the staff action) is not simulated. The conditional write behind it is covered by the staff-after-Luma and Luma-after-staff tests and by a mutation check (removing the condition fails both suites).
- The browser scenarios cover the staff panel. The admin panel uses the same composable; it was checked with a scripted real-browser run in the local preview (row and Checked in card update, Withdraw stays), not with a BDD scenario.
- The failure toast is covered by real-browser screenshots; the 409 codes and messages are covered by integration tests.

Validation (final code): bun run lint, bun run typecheck, bun run test:unit (731 passed), bun run test:integration (547 passed), bun run test:bdd (111 passed + 1 destructive passed), git diff --check, bun run build:storybook, readability check (0 flags on changed lines).

Acceptance evidence:
- AC1: BDD scenario "Staff member checks in a confirmed participant from the participant list" (judge persona as event staff), integration test "staff checks in a confirmed participant", real-browser screenshots at 390 and 1440.
- AC2: integration test "a staff check-in gives the participant the same checked-in state as a Luma check-in" (own event page reports isCheckedIn for both; own application read accepts the staff source). Every participant-side reader uses isApplicationEffectivelyCheckedIn and no code branches on the source. Repeats: tests for a repeated staff check-in, staff after Luma, and Luma after staff keep the first time and one audit record. The participant step itself is TASK-448.
- AC3: integration tests answer 409 application_not_approved for submitted, rejected and withdrawn applications and leave them unchanged; BDD scenario "Pending participant has no check-in action".
- AC4: integration tests refuse staff of another event, a judge, participants and visitors, and answer 404 for an application of another event; each real check-in writes one user_application.staff_check_in_recorded audit record with the acting user through writeAuditLog.
- DoD6: no setup, configuration or migration change, so DEVELOPMENT.md and OPERATOR.md stay as they are.

Review before commit (2026-11-22): diff reviewed in full. Re-ran on the final working tree: bun run lint passed; bun run typecheck passed; bun run test:unit 731 passed; bun run test:integration 547 passed; bun run test:bdd 111 passed plus 1 destructive. The codehygiene readability check reports no flags on changed lines in the 17 changed TypeScript files. Staff list checked from real-browser screenshots at 390x844 and 1440x900 in light and dark.

Accepted change in behavior: the participant list now shows check-in state, the Checked in card and the Checked in filter for every event, not only for events with a configured Luma check-in webhook or simplified claiming.

Follow-up (tracked as its own task): the participant list loads only the newest 100 registrations and searches only those rows, so at a larger event staff cannot find older registrations. The staff list also opens on new registrations instead of confirmed participants.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Event staff, event admins and platform admins can check in a confirmed participant from the participant list (new operation POST /api/events/:eventId/applications/:applicationId/actions/check-in, check-in source "staff").

What changed:
- One list of check-in sources (shared/domains/applications/check-in.ts) and one write for the first check-in (server/domains/applications/check-in.ts), used by the Luma webhook and the staff action. No migration.
- The staff action only checks in approved applications of the event in the URL, answers 409 for pending, rejected, withdrawn and admin-marked "not joined" participants, changes nothing when the participant is already checked in, and writes one audit record per real check-in.
- The participant list shows a Check in action next to the name of each confirmed participant who is not checked in; the row updates at once and a failure shows the server message. Attendance now shows in the list for every event.
- Canonical docs, MCP manifest, generated schemas, Storybook story, integration tests and a browser feature (@task-444) are updated.

Verification: lint, typecheck, unit (731), integration (547), BDD (111 + 1 destructive), git diff --check, Storybook build, and real-browser screenshots at 390x844 and 1440x900 in light and dark.

Risks and follow-ups:
- The participant list loads only the newest 100 registrations and search works on those rows only (existing limit). An event with more registrations needs paging or server search before staff can find everyone.
- The participant step after check-in is TASK-448; this task only guarantees the same checked-in state for staff and Luma check-ins.
- The list opens on New, so staff tap Approved before searching.
- The solid primary AppButton loses its label on hover in the light theme (existing); the Check in button uses the soft style to avoid it.
- Check-in works in every event state, like Luma check-ins.
<!-- SECTION:FINAL_SUMMARY:END -->
