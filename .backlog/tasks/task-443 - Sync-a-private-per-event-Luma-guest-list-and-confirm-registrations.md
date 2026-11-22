---
id: TASK-443
title: Sync a private per-event Luma guest list and confirm registrations
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-22T01:04:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - docs/domain-model.md
  - TASK-367
  - https://docs.luma.com/reference/get_v1-events-guests-list
  - https://docs.luma.com/reference/webhook_guest_updated
modified_files:
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
  - docs/testing-strategy.md
  - docs/mcp.md
  - README.md
  - drizzle/0081_event_luma_guest_list.sql
  - server/database/schema.ts
  - server/domains/applications/luma-config.ts
  - server/domains/applications/luma-webhooks.ts
  - server/domains/applications/luma-event-guests.ts
  - server/domains/credits/luma-check-ins.ts
  - server/domains/applications/luma-guest-list.ts
  - server/domains/applications/review-finalization.ts
  - server/domains/applications/index.ts
  - server/domains/applications/luma-guest-list-sync.ts
  - server/domains/events/index.ts
  - server/domains/events/luma-webhook-registration.ts
  - server/api/public/events/[slug]/luma/webhooks.post.ts
  - server/api/events/[eventId]/applications/index.post.ts
  - server/api/events/[eventId]/index.patch.ts
  - server/api/events/[eventId]/luma/actions/sync-guest-list.post.ts
  - server/application/operations/eligibility-manifest.ts
  - shared/domains/events/account-event-settings-page.ts
  - server/domains/events/account-event-settings-page.ts
  - app/domains/events/records.ts
  - app/domains/events/admin-event.ts
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - app/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue
  - app/components/admin/builder/AdminBuilderWorkspace.vue
  - app/pages/admin/events/builder/[eventId].vue
  - server/application/operations/generated-output-schemas.ts
  - tests/unit/server/domains/events/luma-webhook-registration.test.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - tests/unit/server/domains/applications/luma-event-guests.test.ts
  - tests/unit/server/domains/applications/luma-webhooks.test.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/authenticated/luma-guest-list.feature
  - tests/bdd/steps/luma-guest-list.steps.ts
  - tests/unit/server/domains/applications/luma-guest-list-privacy.test.ts
type: feature
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build Day participants register with Luma before using Codex Events. Organizers need to resolve registrations from one local guest-status record and recover missed updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event using Luma can import its guest list initially and refresh it manually from event settings.
- [x] #2 Verified webhooks update the correct event guest when status changes, with duplicate deliveries and repeated syncs leaving the record consistent.
- [x] #3 Codex Events matches the participant's Luma email to the private list. An unmatched guest cannot register.
- [x] #4 An approved Luma guest is confirmed automatically. A pending guest remains pending and is confirmed when Luma approves them.
- [x] #5 Guest status and contact details stay private. An organizer can see when reconciliation needs attention.
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
1. Canonical docs first: describe the Luma guest list switch, the private EventLumaGuest copy, registration and reconciliation rules, the sync operation, webhook event types, permissions and privacy in docs/domain-model.md, lifecycle-and-state-machines.md, schema-outline.md, api-surface.md, permissions-matrix.md (plus testing-strategy.md, mcp.md and the README capability rows).
2. Data: migration drizzle/0081 adds events.luma_guest_list_enabled, luma_guest_list_synced_at, luma_guest_list_sync_error and the table event_luma_guests (event_id, email, approval_status, synced_at; primary key event_id + email). Mirror it in server/database/schema.ts.
3. Setting: PATCH /api/events/:eventId accepts lumaGuestListEnabled. Saving is rejected unless the event has Luma credentials and requires the Luma email. Turning it off removes the private list. Admin event payload exposes lumaGuestListEnabled. isEventLumaSyncEnabled (decisions sent to Luma) excludes guest-list events, so no Luma decision sync is enqueued for them and lumaSyncStatus stays null. Events without the switch keep today's behavior.
4. Guest list domain (server/domains/applications): luma-event-guests.ts (shared paginated fetch of /v1/events/guests/list, 10,000 guest bound, reused by the check-in import), luma-guest-list.ts (private table access, status classification, counts), luma-guest-list-sync.ts (reconcile one guest's application; full sync = fetch, upsert, sweep by sync timestamp, store sync state, reconcile).
5. Approval path: one shared conditional approval in review-finalization.ts used by automatic approval, registration on guest-list events and reconciliation (same side effects, at most one approval per application). Withdrawals reuse withdrawUserApplicationWithAdminPolicy with trigger luma_cancellation.
6. Routes: POST /api/events/:eventId/luma/actions/sync-guest-list (event admin or platform admin, excluded from MCP); registration looks up the saved Luma email in the local list (no guest or declined -> luma_registration_required, approved -> approved, other -> submitted); webhook handles guest.registered and guest.updated for guest-list events (upsert guest, reconcile, then existing check-in handling); webhook registration subscribes to both event types.
7. Organizer view: settings page payload carries guest counts and sync state; the builder Luma connection section gets the switch, counts, last refresh, import/refresh button and attention warnings. The classic form only carries the setting unchanged; the server rejects disconnecting Luma or dropping the Luma email requirement while the switch is on.
8. Tests: integration tests for import, refresh, failed fetch, webhook updates incl. duplicate delivery, registration outcomes, reconciliation, privacy of the settings payload and setting validation; unit tests for the shared guest fetch and the privacy boundary; update affected unit tests; BDD scenarios for the organizer view and registration with seeded guests (no real Luma API).
9. Validate: mcp:generate-output-schemas, lint, typecheck, test:unit, test:integration, test:bdd; browser screenshots of the organizer UI at 1440x900 and 390x844 in light and dark.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision by Alex on 2026-11-22: the Luma guest list confirms registrations only for events that switch it on in their Luma connection. Other events with Luma keep the current flow, where organizers approve on Codex Events and the result is sent to Luma.

Implementation decisions (2026-11-22, @claude):
- Setting: events.luma_guest_list_enabled (API lumaGuestListEnabled) is accepted by PATCH /api/events/:eventId only. Saving is rejected (409 luma_guest_list_configuration_conflict) unless the event has Luma credentials and a visible, required Luma email. Once saved, the switch stays authoritative even when the Luma connection breaks later: registration stays limited to the private list and the organizer sees a warning. Turning it off deletes the private list and clears the refresh state.
- isEventLumaSyncEnabled (decisions sent to Luma) now excludes guest-list events, so no Luma decision sync is enqueued anywhere for them and lumaSyncStatus stays null. Side effect: verify-luma-email and backfill-luma-emails answer "Luma sync is not enabled" for guest-list events. Events without the switch behave as before.
- Private list: table event_luma_guests (event_id, email, approval_status, synced_at; primary key event_id + email). Only server/domains/applications/luma-guest-list.ts and luma-guest-list-sync.ts touch it; a source test enforces this.
- Shared code instead of copies: fetchLumaEventGuests (pagination, 10,000 guest bound) is reused by the check-in import; approveSubmittedApplication is the one conditional approval used by automatic approval, guest-list registration and reconciliation; findEventApplicationByLumaEmail moved from the webhook route into the applications domain.
- Refresh and webhooks can overlap: a refresh keeps guests that a webhook wrote after the refresh started and removes only guests older than the refresh start (mark and sweep by synced_at).
- Webhook registration now subscribes every Luma-connected event to guest.registered and guest.updated. Events without the switch ignore guest.registered. Existing webhooks get the new event type on the next event save or Retry Luma configuration.
- Organizer view: extended AdminBuilderLumaConnection.vue (closest analog: its Import existing check-ins action), no new component. Guest totals and refresh state travel in the settings page payload (lumaGuestList). The classic event form only carries the setting.

Validation (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 142 files / 731 tests passed; bun run test:integration 46 files / 529 tests passed (19 new in luma-guest-list-routes.test.ts); bun run test:bdd 109 passed (public + authenticated, 4 new @task-443 scenarios) and 1 passed (destructive). Browser check on the local preview with a throwaway event at 1440x900 and 390x844, light and dark: switch off, switch on unsaved, saved never imported, saved with totals, failed refresh, Luma not connected. End-to-end check on the preview server and local D1 with locally signed webhooks: refused registration, pending registration, approval by webhook (delivered twice: one approval, one email), check-in, decline and withdrawal.

Test gaps: the real Luma API was not called. Payload shapes follow the Luma docs for GET /v1/events/guests/list and the guest.registered and guest.updated webhooks. BDD does not click Import or Refresh and does not save the switch, because the BDD server has no fake Luma API and would call Luma; these paths are covered by integration tests with faked Luma HTTP and by a browser check with a mocked response.

Review before commit (2026-11-22): diff reviewed in full. Re-ran on the final working tree: bun run lint passed; bun run typecheck passed; bun run test:unit 731 passed; bun run test:integration 529 passed; bun run test:bdd 109 passed plus 1 destructive. The codehygiene readability check reports no flags on changed lines in the 28 changed TypeScript and SQL files. Organizer screens checked from real-browser screenshots at 1440x900 and 390x844 in light and dark.

Open decision for Alex: a Luma email is typed by the participant and is not proven to belong to them. An account that enters the email of an approved Luma guest is confirmed at once. Two accounts with the same Luma email in one event stop Luma updates and Luma check-ins for both, because the match is no longer unique.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An event can now keep a private copy of its Luma guest list and confirm registrations from it. The switch (events.luma_guest_list_enabled) lives in the builder's Luma connection section and needs Luma credentials plus a required Luma email. Events without the switch behave as before.

What changed:
- Data: migration 0081 adds three event columns (switch, last refresh time, last refresh failure) and the table event_luma_guests (event, lower-case email, Luma approval status, sync time).
- Import and refresh: POST /api/events/:eventId/luma/actions/sync-guest-list fetches all guests (10,000 bound), upserts them, removes guests Luma no longer returns, stores the refresh state, then reconciles applications. A failed fetch only stores the failure message.
- Webhooks: guest.registered and guest.updated upsert the one guest and reconcile the matching application; check-ins keep working. The webhook now subscribes to both event types.
- Registration: the saved Luma email is looked up in the private list. No guest or a declined guest is refused with luma_registration_required, an approved guest is approved at once through the shared approval path, any other status stays submitted. Guest-list events send nothing to Luma.
- Organizer view: the builder shows the switch, approved and waiting totals, the last refresh, the import or refresh button, and warnings for never imported, failed refresh and broken connection. No response contains guest emails or statuses.

Verification: lint, typecheck, 731 unit tests, 529 integration tests and 110 BDD scenarios pass. The organizer UI was checked in a browser at two widths in light and dark. The main flow was run end to end on the local preview with locally signed webhooks.

Risks and follow-ups:
- Product question: the Luma email is not verified as owned by the account. Any account that enters an approved guest's email is confirmed, and two accounts can use the same Luma email in one event. Luma updates for that guest then change nothing because the match is no longer unique.
- The real Luma API was not called. Shapes follow the Luma docs; a first import against the real Vienna event should be watched (TASK-454 rehearsal).
- A full-size list needs 200 Luma requests in one refresh, which is at Luma's documented rate limit of 200 requests per minute.
- Refreshing the list reloads the builder like every other immediate builder action, so unsaved builder edits are lost.
- Existing Luma webhooks receive guest.registered only after the event is saved again or Luma configuration is retried.
- Groma reports the architecture as a first scan; curation was not done and needs Alex's decision.
<!-- SECTION:FINAL_SUMMARY:END -->
