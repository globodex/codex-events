---
id: TASK-514
title: Give workshops their own page with staff, slides and materials
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T20:44:00Z'
updated_date: '2026-11-26T21:12:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
  - app/components/account/events/molecules/AccountEventDetailsDialog.vue
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - app/components/admin/builder/molecules/AdminBuilderProgramSession.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramEditor.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramTrack.vue
  - app/layouts/profile.vue
  - app/pages/account/events/[slug]/index.vue
  - app/pages/admin/events/builder/[eventId].vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/events/account-event-program-page.ts
  - server/domains/events/program.ts
  - shared/domains/events/program.ts
  - stories/features/AccountEventProgramAgenda.stories.ts
  - stories/features/AccountEventProgramTimeline.stories.ts
  - stories/features/AdminBuilderProgramEditor.stories.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - app/components/account/events/molecules/AccountEventStaffList.vue
  - app/components/account/events/organisms/AccountEventWorkshopEditor.vue
  - app/components/account/events/organisms/AccountEventWorkshopPanel.vue
  - app/composables/usePresentationMode.ts
  - drizzle/0094_event_workshops.sql
  - server/api/events/[eventId]/workshops/
  - server/domains/events/workshops.ts
  - shared/domains/events/workshops.ts
type: feature
ordinal: 231000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked for workshop pages for the Vienna Build Day. A program session with staff is a workshop (decided with Alex). The session popup on the Agenda tab shows the staff of the workshop. A dedicated workshop page shows the agenda on the left and the workshop on the right: title, description, staff, slides (links or uploaded PDFs), materials and links, with a fullscreen mode that hides the header, footer and sidebar. Admins assign the staff in the builder; admins and the assigned staff edit the page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An admin picks the staff of a program session in the builder from the event team; a session with staff is a workshop
- [x] #2 The session popup of a workshop shows its staff with photo and full name and opens the workshop page
- [x] #3 The workshop page shows the agenda on the left and the workshop title, time, room, staff, description, slides, materials and links on the right
- [x] #4 A fullscreen button hides the header, footer and sidebar and makes the browser fullscreen; leaving fullscreen brings them back
- [x] #5 Event admins and the staff of the workshop edit its description, slides, materials and links, and can upload PDFs that only readers of the program can open
- [x] #6 Event staff can read the program, so staff can open the workshop pages
- [x] #7 Docs and tests cover the workshop rules, the editing rights and the private PDFs
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
A program session with staff is a workshop. Staff ids live on the session in the program; the page content (description and items) lives in event_workshops, one row per session. PDFs are stored in the event images bucket under events/<eventId>/workshops/<sessionId>/<fileId> and are served privately, only while an item references them; saving without an item deletes its PDF.

Component choices:
- AccountEventStaffList (molecule) is the staff list of the challenge popup, extracted so the challenge popup, the session popup and the workshop page share it.
- AccountEventWorkshopPanel (organism) follows the read view plus Edit plus lazy editor pattern of AccountEventStaffInstructionsPanel. It takes the place of the map aside while a workshop is open.
- Closest analog for the items is EventTrackDetails (track description plus one Resources group of public links). It was not reused because workshops show three groups (Slides, Materials, Links) and private PDF items, and changing it would change the public track layout. The items are AppButtons.
- Fullscreen (usePresentationMode) hides the header, sidebar and footer in the profile layout and the event header on the page. The workshop panel ends it when it closes, also when the person leaves the page, and leaving browser fullscreen ends it.

Test gaps: no BDD scenario for the workshop page. The builder staff picker, the popup, the page, editing, PDF upload and removal, fullscreen at 1440 and 390 px in light and dark were checked by hand in the local preview.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A program session with staff is now a workshop. Admins pick the staff in the builder from the event staff. The session popup shows the staff and opens the workshop page. The workshop page shows the agenda on the left and the workshop on the right: title, time, room, staff, description, slides, materials and links. Links open in a new tab; PDFs are private and open in the browser's PDF viewer. Event admins and the staff of the workshop edit the page. A fullscreen button hides the header, sidebar, footer and event header. Event staff now read the program, so they can open workshop pages.

Validation: lint, typecheck, unit (725), integration (all), BDD (148 + 1) and the topology check (26) pass. Checked by hand in the local preview at 1440 and 390 px, light and dark.

Risks and follow-ups: no BDD scenario for the workshop page yet (manual check only). PDFs open in a new tab because the app forbids framing.
<!-- SECTION:FINAL_SUMMARY:END -->
