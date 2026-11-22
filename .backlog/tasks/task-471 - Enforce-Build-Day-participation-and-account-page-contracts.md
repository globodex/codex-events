---
id: TASK-471
title: Enforce Build Day participation and account page contracts
status: Done
assignee:
  - '@codex'
  - '@claude'
created_date: '2026-11-22T14:58:00Z'
updated_date: '2026-11-22T19:36:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - server/domains/events/account-event-entry-page.ts
  - server/domains/applications/luma-guest-list-sync.ts
modified_files:
  - app/components/account/events/AccountEventCreditsPanel.vue
  - app/components/account/events/organisms/AccountEventTracksPanel.vue
  - app/domains/events/account-workspace-tabs.ts
  - app/pages/account/events/[slug]/index.vue
  - app/pages/admin/events/builder/[eventId].vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - drizzle/0085_build_day_guards.sql
  - server/api/account/events/[slug]/program.get.ts
  - server/api/admin/events/[eventId]/actions/backfill-luma-emails.post.ts
  - >-
    server/api/events/[eventId]/applications/me/actions/complete-questionnaire.post.ts
  - server/api/events/[eventId]/credits/[creditId]/actions/claim.post.ts
  - server/api/events/[eventId]/index.patch.ts
  - server/api/events/[eventId]/luma/actions/sync-guest-list.post.ts
  - server/api/events/[eventId]/photos/index.post.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/applications/check-in-flow.ts
  - server/domains/applications/index.ts
  - server/domains/applications/luma-email.ts
  - server/domains/applications/luma-guest-list-sync.ts
  - server/domains/applications/luma-guest-list.ts
  - server/domains/applications/review-finalization.ts
  - server/domains/credits/index.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-contract.ts
  - server/domains/events/account-event-page-shell.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/index.ts
  - server/domains/events/photos.ts
  - server/http/api-error.ts
  - server/routes/mcp.post.ts
  - shared/domains/credits/claim-access.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-page-registry.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - tests/integration/server/api/account-event-competition-pages.test.ts
  - tests/integration/server/api/account-event-entry-prizes-pages.test.ts
  - tests/integration/server/api/admin-luma-backfill-routes.test.ts
  - tests/integration/server/api/check-in-flow-routes.test.ts
  - tests/integration/server/api/credit-claim-check-in-flow-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - tests/integration/server/api/participant-photo-routes.test.ts
  - tests/integration/server/database/migration.test.ts
  - tests/integration/server/mcp/mcp-protocol.test.ts
  - tests/unit/app/domains/events/account-workspace-page.test.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/server/domains/events/account-event-page-contract.test.ts
  - tests/unit/server/domains/events/index.test.ts
type: bug
ordinal: 187000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep event data and admission decisions consistent after visibility, registration or Luma settings change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gallery, track projections and account page contracts follow actor permissions.
- [x] #2 Luma imports, registration emails, questionnaire, credit and photo writes enforce eligibility under concurrency.
- [x] #3 Canonical docs and generated MCP contracts match the tested behavior.
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
Update guards and page projections. Enforce competing writes in D1. Cover the routes and regenerate schemas, then run validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migration 0085_build_day_guards.sql was applied to the local preview database (.wrangler/demo-Hdc7do/state) cleanly (14 commands executed). Migration tests upgrade existing registrations and verify transaction rollback when two active registrations already share a normalized Luma email in one linked event.

Stage 1 (Astra 6.2 max) enforced hidden-event visibility across all three protected photo guards, fixed Overview track projections for participants and staff, reset Luma guest lists atomically on relink/disable and guarded concurrent imports, enforced unique active Luma emails and 20-photo caps in D1 (migration 0085), added completed-event credit claim refusal, reordered attendee tabs (Overview, Agenda, Challenges, Credits, Gallery), removed unused /entry adminSettingsEvent, added includeEventShell on /program, and regenerated MCP contracts.

Stage 2 (Fable 5.2 max) unified Settings into one panel and one form with Hide event last and online-event schedule saving, removed duplicate location fields in Event Builder Images, fixed cross-tab cache invalidation (withdrawal, questionnaire completion, gallery mutations, settings save), deleted dead getAccountEventTabAccess and the orphan Overview Build Time button, fixed AppButton and dark/light solid button hover contrast, simplified phone door check-in, merged public event Details into Overview, fixed Registration/Feedback/Terms header dates, removed participant Credits accordion and jargon, cleaned up Gallery copy/empty state/check-in banner/filenames, made non-room Agenda sessions non-button with map hints and equal-time outside-block stacking, and removed the extra divider inside Challenge cards.

Real-browser verification and 17-step 390x844 phone rehearsal caught and fixed two additional bugs:
1. Direct links to ?tab=gallery computed nextStepHref as null when entryPage had not loaded, hiding the "See your next step" button on the Gallery lock banner (fixed in app/pages/account/events/[slug]/index.vue).
2. On 390x844 phones, the fixed bottom submit bar on /events/[slug]/register sat inside a z-10 stacking context and was covered by the z-20 footer, blocking Submit taps (removed the fragile fixed bar and made the inline primary submit button visible directly inside "Review and submit" in ParticipantRegistrationForm.vue).

Final validation on the final working tree (2026-11-22):
- bun run lint: passed
- bun run typecheck: passed
- bun run test:unit: 143 files, 727 tests passed
- bun run test:integration: 52 files, 752 tests passed (including local-platform-proxy.test.ts)
- bun run test:bdd: 126 passed + 1 destructive passed
- bun run build:storybook: passed
- git diff --check: clean
- Real Chromium visual audit at 1440x900 and 390x844 in light and dark themes + 17-step end-to-end phone rehearsal: all passed with zero errors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enforced Build Day visibility, concurrency, and contract invariants (migration 0085), simplified and refactored the attendee, staff, and organizer UX based on real-browser inspection and parallel Astra + Fable reviews (net deletion of ~500 lines across the tree), and fixed two additional real-phone bugs caught during live browser rehearsal (direct-link Gallery next-step button and mobile registration submit obscured by footer). All automated suites (lint, typecheck, 727 unit, 752 integration, 126 + 1 BDD, Storybook build) and live desktop/phone browser checks pass.
<!-- SECTION:FINAL_SUMMARY:END -->
