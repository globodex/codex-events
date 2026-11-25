---
id: TASK-499
title: Let organizers upload the Luma guest list as a CSV
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T18:53:00Z'
updated_date: '2026-11-25T19:08:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - server/domains/applications/luma-guest-list.ts
  - server/domains/applications/luma-guest-list-sync.ts
  - server/api/events/[eventId]/luma/actions/upload-guest-list.post.ts
  - server/domains/events/index.ts
  - server/domains/applications/luma-config.ts
  - server/application/operations/eligibility-manifest.ts
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - app/domains/events/builder.ts
  - docs/domain-model.md
  - docs/api-surface.md
  - docs/schema-outline.md
  - tests/unit/server/domains/applications/luma-guest-list-csv.test.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
  - tests/bdd/features/authenticated/luma-guest-list.feature
  - tests/bdd/steps/luma-guest-list.steps.ts
  - tests/bdd/support/platform-fixtures.ts
type: feature
ordinal: 216000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex could not connect the Vienna Build Day (28 November 2026) to Luma, because his Luma API key has no access to that Luma event ("You do not have access to this event"). He exported the guest list from Luma as CSV (336 guests: 328 approved, 8 declined) and asked for a manual CSV upload in the Luma panel for when the API sync is not available. Alex decided that the upload works as the existing Luma guest list: only people on the list can register (matched by Luma email), approved guests are confirmed automatically, declined guests cannot register, and a new upload replaces the list. Today the guest list can only be turned on with saved Luma credentials and is filled through the Luma API.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin or platform admin can turn on the Luma guest list without Luma credentials, as long as the Luma email is a visible, required registration field
- [x] #2 In the Luma panel of the event builder, an organizer can upload the guest CSV that Luma exports; the upload replaces the private guest list and shows how many guests are approved and waiting
- [x] #3 Only the email and approval status of each guest are stored; other columns are ignored, and the response carries counts only
- [x] #4 After an upload, registrations follow the same rules as after a Luma import: approved guests confirm a submitted registration, declined guests withdraw one, and people not on the list cannot register
- [x] #5 A file without email and approval_status columns, with an invalid email, larger than 5 MB or with more than 10,000 guests is refused with a clear message and changes nothing
- [x] #6 Docs and tests cover the upload
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
1. server/domains/applications/luma-guest-list.ts: parseLumaGuestListCsv reads the Luma guest export with csv-parse (email and approval_status columns, 5 MB, 10,000 guests, valid emails) and keeps only the normalized email and approval status; guestListSource compares the Luma event ID with IS, so a guest list works without a Luma event ID.
2. server/domains/applications/luma-guest-list-sync.ts: split the refresh into startGuestListRefresh and publishGuestList; syncEventLumaGuestList (Luma API) and a new uploadEventLumaGuestList (CSV) both use them, so an upload replaces the list and reconciles registrations exactly like an import.
3. New route POST /api/events/:eventId/luma/actions/upload-guest-list (event admin or platform admin, guest list on, multipart file), audit log with counts only.
4. assertLumaGuestListConfiguration: the guest list needs a required Luma email, not a Luma connection.
5. AdminBuilderLumaConnection.vue: the guest list switch shows without a connection; an Upload Luma CSV button next to the Luma refresh, which shows only while connected.
6. Docs: domain-model.md and api-surface.md.
7. Tests: unit tests for the CSV parser, integration tests for the route and the new setting rule, the guest list browser scenario.
8. Output schemas, lint, typecheck, unit, integration, BDD; browser check; commit, push, release.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. parseLumaGuestListCsv (luma-guest-list.ts) reads the Luma export with csv-parse and keeps the normalized email and approval status only. luma-guest-list-sync.ts now has startGuestListRefresh and publishGuestList, shared by syncEventLumaGuestList (Luma API) and uploadEventLumaGuestList (CSV). guestListSource compares the Luma event ID with IS, so a list without a Luma event ID passes the refresh guard. The upload route is excluded from MCP as a bulk file import. The builder Luma panel shows the guest list switch without a connection, an Upload Luma CSV button, and the Luma import button only while connected; the Luma tile says Guest list when only the list is on. Checked locally on the demo event without a connection: upload of a made-up CSV showed 2 approved, 1 waiting at 1440 px light and 390 px dark; the demo event was restored afterwards. Checks so far: lint, typecheck, integration tests (782).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Organizers can fill the Luma guest list of an event by uploading the guest CSV that Luma exports, so the guest list works without a working Luma API connection. The guest list switch now needs only the required Luma email. An upload replaces the whole private list and brings registrations in line with it, exactly like an import from Luma: only listed people can register, approved guests are confirmed, declined guests withdraw. Only each guest's email and approval status are stored; the response and audit log carry counts. Files without the email and approval_status columns, with an invalid email, over 5 MB or with more than 10,000 guests are refused and change nothing. The builder's Luma panel has an Upload Luma CSV button, shows the Luma import button only while connected, and the Luma tile says Guest list when only the list is on.

Verification: unit tests for the CSV reader; integration tests for the upload route, the new setting rule and the clearing on disconnect (luma-guest-list-routes, 55 tests; whole suite 782); a new browser scenario that uploads a CSV in the builder of an event without a Luma connection; the full browser suite (146 + 1 scenarios); the local builder at 1440 px light and 390 px dark.

Follow-up: without the API there are no live updates, so organizers upload a new export to pick up changes in Luma. Removing the Luma connection empties the guest list (existing database trigger), so disconnect first, then upload.
<!-- SECTION:FINAL_SUMMARY:END -->
