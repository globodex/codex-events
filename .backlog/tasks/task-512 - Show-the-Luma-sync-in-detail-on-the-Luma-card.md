---
id: TASK-512
title: Show the Luma sync in detail on the Luma card
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T12:51:00Z'
updated_date: '2026-11-26T12:52:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - server/domains/applications/luma-guest-list.ts
  - server/domains/events/account-event-settings-page.ts
  - shared/domains/events/account-event-settings-page.ts
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - server/application/operations/generated-output-schemas.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - tests/bdd/steps/luma-guest-list.steps.ts
  - docs/domain-model.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
type: feature
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked the Luma card of the event builder to show the Luma sync in more detail for an event operator: how many users got synced, and a last update that also covers webhook data, whether the update came by itself or by hand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The card shows the approved, waiting and declined Luma guests
- [x] #2 The card shows how many approved guests registered here and how many registrations wait for an approval on Luma
- [x] #3 The card shows how many registrations Luma checked in
- [x] #4 The last update is the latest data from Luma by refresh, upload, guest webhook or Luma check-in
- [x] #5 The card still shows counts and times only, and docs and tests cover the new summary
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Luma card of the event builder now lists, as counts only: the approved, waiting and declined Luma guests; how many approved guests registered here, plus registrations that wait for an approval on Luma when there are any; the Luma check-ins; and the last update, which is the latest of the last refresh or upload, the newest guest webhook, and the newest Luma check-in. summarizeEventLumaGuestList in server/domains/applications/luma-guest-list.ts computes it for the settings page.

Verification: lint, typecheck, 725 unit and 787 integration tests pass, the organizer-view test covers every count and a webhook update that moves the last update, and the five Luma guest list browser scenarios pass. Pictures of the card with a made-up guest list at 1440 px and 390 px in light and dark mode; the local change was undone.
<!-- SECTION:FINAL_SUMMARY:END -->
