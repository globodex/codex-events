---
id: TASK-465
title: Load more registrations in the participant list
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T10:48:00Z'
updated_date: '2026-11-22T11:23:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/AccountEventAdminOperationsPanel.vue
  - app/components/account/events/AccountEventParticipantVisibilityPanel.vue
  - app/components/account/events/AccountEventParticipantsPanel.vue
  - app/components/applications/AdminApplicationsReviewPanel.vue
  - app/composables/useAccountEventPageRequest.ts
  - app/composables/useParticipantListRead.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/api-surface.md
  - docs/testing-strategy.md
  - server/domains/applications/index.ts
  - server/domains/events/account-event-page-contract.ts
  - server/domains/events/account-event-participants-page.ts
  - shared/domains/events/account-event-page-registry.ts
  - shared/domains/events/account-event-participants-page.ts
  - tests/bdd/features/authenticated/participant-list.feature
  - tests/bdd/steps/participant-list.steps.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/participant-list-search-routes.test.ts
  - tests/unit/app/composables/useAccountEventPageRequest.test.ts
  - tests/unit/app/domains/events/account-workspace-page.test.ts
  - app/composables/useParticipantListSearch.ts
  - tests/bdd/steps/staff-check-in.steps.ts
type: enhancement
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The participant list returns the newest 100 registrations of an event. Search finds everyone, but an organizer cannot page through a larger event. Alex asked on 2026-11-22 for a way to load more.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 While the event has more registrations than the list shows, the organizer can load the next registrations and they are added to the list.
- [x] #2 The list never shows a registration twice, and the counts keep describing the whole event.
- [x] #3 Search still finds every participant while only part of the list is loaded.
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
1. Docs first: the participants page takes a row count; Load more raises it by 100 up to 1000.
2. Query value participantRows in the page registry and the server contract; the page returns that many of the newest registrations (search stays at the newest 100 matches).
3. Read the withdrawal availability for all listed rows with the existing batch function instead of one read per row.
4. Client: the list read holds the row count; Load more in the list panel raises it; the event goes up through the two wrapper panels.
5. Tests: integration (row count, limits), unit (registry, composable), one browser scenario on a fixture event with more than 100 registrations.
6. Validate and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in the main session on 2026-11-22. Design: the list request has one more query value, participantRows (100 to 1000, steps of 100). Load more raises it and the server answers with the whole longer list in one response, so the list on screen is always one answer and can never show a registration twice. A search keeps its limit of the newest 100 matches. The page reads the withdrawal availability of all listed rows with the existing batch function (fixed number of queries) instead of one read per row; the unused per-row helper was removed. useParticipantListSearch became useParticipantListRead (search and Load more share the one list read). Bug found by the new browser scenario and fixed: useAccountEventPageRequest compared query values field by field and ignored the new value; it now compares every value of the normalized query, with a unit test. Validation on the final tree: lint, typecheck, unit (738), integration (714), browser suite (126 plus 1), readability check (one allowed dense_line flag on a zod chain), git diff --check. Checked in the local preview as organizer with 106 registrations, both themes; the temporary demo registrations were removed again. Test gap: the read-only staff view shares the same list panel and is covered by the browser scenario; the organizer view was checked by hand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The participant list has a Load more button while the event has more registrations than the list shows. Each click adds the next 100 registrations, up to 1,000. The counts keep describing the whole event, the list cannot show a registration twice, and search still finds every participant while only part of the list is loaded.

What changed: a row count in the participants page request (registry, server contract, page loader), one batch read for the withdrawal information, the Load more button in the list panel with its click passed up to the page, a renamed composable for the list read, docs, and tests on all three levels including a browser fixture event with 105 registrations.

Verification: lint, typecheck, unit, integration and the full browser suite pass; checked in the local preview in both themes.

Risks and follow-ups: staged decisions and the track counts of the organizer view still count loaded rows only; beyond 1,000 registrations the list stops growing and search finds the rest.
<!-- SECTION:FINAL_SUMMARY:END -->
