---
id: TASK-462
title: Find any participant in the participant list of a large event
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T02:13:00Z'
updated_date: '2026-11-22T03:40:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-444
references:
  - docs/api-surface.md
  - TASK-444
  - TASK-432.5
modified_files:
  - docs/api-surface.md
  - docs/testing-strategy.md
  - shared/domains/events/account-event-page-registry.ts
  - server/domains/events/account-event-page-contract.ts
  - shared/domains/events/account-event-participants-page.ts
  - server/domains/applications/check-in.ts
  - server/domains/events/account-event-participants-page.ts
  - >-
    server/api/events/[eventId]/applications/actions/send-certificate-emails.post.ts
  - server/application/operations/generated-output-schemas.ts
  - app/composables/useAccountEventPageRequest.ts
  - app/composables/useParticipantListSearch.ts
  - app/pages/account/events/[slug]/index.vue
  - app/composables/useParticipantCheckIn.ts
  - app/components/account/events/AccountEventParticipantVisibilityPanel.vue
  - app/components/account/events/AccountEventParticipantsPanel.vue
  - app/domains/applications/admin-application-record.ts
  - app/components/applications/AdminApplicationsReviewPanel.vue
  - app/components/account/events/AccountEventAdminOperationsPanel.vue
  - tests/unit/app/domains/events/account-workspace-page.test.ts
  - tests/unit/app/composables/useAccountEventPageRequest.test.ts
  - tests/unit/app/composables/account-event-parent-page-topology.test.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - tests/unit/server/domains/events/account-event-page-contract.test.ts
  - tests/integration/server/api/participant-list-search-routes.test.ts
  - tests/bdd/steps/staff-check-in.steps.ts
  - tests/bdd/features/authenticated/staff-check-in.feature
  - shared/domains/applications/participant-search.ts
  - app/domains/applications/admin-application-review.ts
type: bug
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The participant list loads only the newest 100 registrations of an event and searches only those rows. At an event with more registrations, staff at the entrance cannot find an older registration to check the person in, and the Checked in card counts only the loaded rows. The staff list also opens on new registrations, so staff must change the filter before they can look for a confirmed participant.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Searching the participant list finds a participant by name or email among all registrations of the event, including registrations outside the first load.
- [x] #2 The list tells the viewer when it shows only part of the registrations of the event.
- [x] #3 The Checked in count covers all confirmed participants of the event and stays correct after a check-in from the list.
- [x] #4 Event staff open the participant list on confirmed participants.
- [x] #5 An event whose registrations all fit in the first load makes no additional request when the viewer searches.
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
1. Docs first: describe the participant list page in docs/api-surface.md (optional search text, bounded result, whole-event counts, checked-in count) and the test coverage in docs/testing-strategy.md.
2. Contract: add participantSearch to the typed page query (shared registry: normalize, path, request key, length limit; server query schema) and checkedInCount to the participant list page schema.
3. Server: server/domains/applications/check-in.ts owns the SQL form of the effective check-in rule; the participant list page uses it for a whole-event count inside its existing status count query and adds a bound, wildcard-free contains search to the bounded list query. send-certificate-emails reuses the same predicate.
4. Client request: a composable owns the search rule (local filter always; server search only when the event has more registrations than the list loads; debounced; each search is a new read). The page keeps owning the page request and passes search text, searching state and refresh down.
5. Client UI: search box becomes a v-model of the review panel; note when the list is cut; searching state instead of a false no-match message; Checked in card from the server count; staff view opens on Approved; list is read again after a check-in.
6. Tests: integration tests for search, limit, wildcard characters, checked-in count and authorization; unit tests for the query builders; update the @task-444 browser steps and the topology contract keys.
7. Validation: lint, typecheck, unit, integration, bdd, git diff --check, readability check, regenerate output schemas.
8. Browser check on the local preview with about 120 temporary demo registrations, screenshots, then remove the temporary rows.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions (implementation):
- Search on the server uses instr(lower(column), lower(text)) with a bound value. instr has no wildcards, so % and _ need no escaping. SQLite lower() changes A to Z only: the server search ignores case for those letters, other letters (for example Ö, Š) must be typed in the stored case. The local search in the browser also ignores accents; the server search does not.
- The checked-in count is read inside the existing status count query (count(case when ... then 1 end) per status, approved row used). No extra query, and the staff filter is the same by construction.
- server/domains/applications/check-in.ts owns the SQL form of the effective check-in rule (effectivelyCheckedInCondition). send-certificate-emails uses it in its Drizzle query. Its reservation update is a raw SQL string and still spells the rule out; a comment points to the owner.
- Each read of the participant list has a time (askedAt) that is a watched source of the page request, so it is part of the request key. A newly opened page and every search get an answer of their own. Reason: the shared request owner keeps answers per key; without this, clearing a search after a check-in showed the earlier answer with the old count.
- After a check-in the row is replaced locally at once and the list is then refreshed (awaited, pendingActionKey stays set). The Checked in card follows with the refreshed answer.
- The participant list shows its loading placeholder only while it has no rows. A search or a refresh keeps the rows on screen.
- Invalid page query values (for example a search text over 120 characters) now answer 400 invalid_request through validateWithSchema; before, the page contract answered 500 for them.

Test gaps:
- The browser suite has no event with more than 100 registrations. The cut list (note, server search, abort of an earlier search, check-in on a found row, refreshed counts) is covered by server integration tests and by a manual browser check on the local preview with 120 temporary demo registrations (removed again).
- useParticipantListSearch has no unit test: every function in it has cognitive complexity 3 or less (cccc). The browser scenario proves that a small event sends no search request.
- A failed search request shows the existing error message of the list and needs a page reload; checked by hand (one request, no retry loop), not automated.

Validation (2026-11-22): bun run lint ok; bun run typecheck ok; bun run test:unit 142 files / 733 tests passed; bun run test:integration 48 files / 558 tests passed; bun run test:bdd 111 passed + 1 destructive passed; git diff --check clean; bun run mcp:generate-output-schemas regenerated (checkedInCount), operation catalog and MCP snapshot unchanged; codehygiene: one dense_line flag on a zod chain (allowed).
Browser check on the local preview (demo event with 120 temporary registrations, 126 in total, removed again; database snapshot identical before and after): staff view opens on Approved, note 'Showing the newest 100 of 126 registrations. Search finds everyone.', search finds a registration outside the newest 100 with one request, an earlier search is aborted, check-in on the found row raises the card from 16 / 113 to 17 / 113 and it stays after clearing the search, a failed search sends one request and no retry. Screenshots: scratchpad shots/task-462 (phone and desktop, light and dark).

Review (2026-11-22): the server search no longer uses instr/lower in SQL. It reads the name, account email, Luma email and user id of all registrations of the event (same staff filter and order), compares them with the rule the browser uses (shared/domains/applications/participant-search.ts: ignores letter case and accents), keeps the newest 100 matches and reads those rows one by one. So 'ozturk' and 'ÖZTÜRK' both find 'Öztürk' on a list of any size. The browser filter in app/domains/applications/admin-application-review.ts now imports the same function. Added: a note 'Showing the newest 100 matches. Type more to narrow the search.' when a search answer is full. Integration test added for letter case and accents (12 tests in the file). Validation after the review changes: lint ok, typecheck ok, unit 733 passed, integration 559 passed, bdd 111 + 1 passed, git diff --check clean, codehygiene one dense_line flag on a zod chain (allowed). The new search also answered correctly on the local preview (workerd and local D1): 'ADA' and 'áda' find 'Ada Lovelace'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
What changed
- The participant list page (GET /api/account/events/:slug/participants) accepts an optional participantSearch text (max 120 characters). With it, the server returns the newest registrations (still at most 100, same order, rows and staff filter) whose participant name, account email, Luma email or user id contains the text. The match ignores letter case and accents. statusCounts, pagination.total and the new checkedInCount always describe the whole event.
- One search rule for browser and server: shared/domains/applications/participant-search.ts. The server reads the name, emails and user id of all registrations of the event, compares them with that rule, and reads the matching rows one by one.
- The browser keeps filtering the loaded rows at once. Only when the event has more registrations than the list loads, the search text also goes to the server (300 ms after typing stops, earlier request aborted). A small event sends no request.
- The list shows 'Showing the newest 100 of N registrations. Search finds everyone.' when it is cut, 'Showing the newest 100 matches. Type more to narrow the search.' when a search answer is full, and 'Searching all registrations' instead of a no-match message while the server has not answered.
- The Checked in card uses the server count. After a check-in the row changes at once and the list is read again, so the card follows.
- The read-only staff list opens on Approved; the organizer list still opens on New.
- One owner for the SQL form of the effective check-in rule (server/domains/applications/check-in.ts), reused by send-certificate-emails.

Verification
- lint, typecheck, unit (733), integration (559, 12 new for this task), bdd (111 + 1), git diff --check: all pass. Browser check with 126 registrations on the local preview; temporary data removed and state verified identical. The reviewed server search was checked again through the local preview API.

Risks and follow-ups
- A search on the server reads the name and emails of every registration of the event and then up to 100 rows one by one. A search text with many matches is the slowest case.
- A failed search request shows the list error and needs a page reload (one request, no retry loop).
- Organizer view on a cut list: 'Save staged decisions (N)' and the track counts still count loaded rows only, as before. A staging click made while a search answer is still loading can be shown as not staged until the next read.
- The raw SQL reservation statement in send-certificate-emails still spells out the check-in rule (comment points to the owner).
- The MCP operation for this page has no search input (page routes declare path parameters only).
- The browser suite has no event with more than 100 registrations; the cut list is covered by server integration tests and a manual browser check.
<!-- SECTION:FINAL_SUMMARY:END -->
