---
id: TASK-451
title: Let checked-in participants upload event photos
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-22T08:12:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-448
references:
  - docs/permissions-matrix.md
  - docs/domain-model.md
modified_files:
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/lifecycle-and-state-machines.md
  - README.md
  - drizzle/0084_participant_photos.sql
  - server/database/schema.ts
  - shared/domains/events/photos.ts
  - server/domains/events/photos.ts
  - server/api/events/[eventId]/photos/index.post.ts
  - server/api/events/[eventId]/photos/index.get.ts
  - server/api/events/[eventId]/photos/[photoId]/image.get.ts
  - server/api/events/[eventId]/photos/[photoId].delete.ts
  - server/api/events/[eventId]/photos/[photoId]/highlight.patch.ts
  - server/api/events/[eventId]/photos/[photoId]/public-visibility.patch.ts
  - server/api/events/[eventId]/photos/[photoId]/hidden.patch.ts
  - shared/domains/events/account-event-gallery-page.ts
  - server/domains/events/account-event-gallery-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-shell.ts
  - server/api/events/slug/[slug]/index.get.ts
  - server/domains/events/index.ts
  - shared/domains/events/account-event-settings-page.ts
  - app/domains/events/records.ts
  - app/domains/events/admin-event.ts
  - app/composables/useEventBuilder.ts
  - app/domains/events/builder.ts
  - app/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue
  - tests/unit/app/domains/events/admin-event-schema.test.ts
  - tests/unit/server/domains/events/index.test.ts
  - tests/unit/server/domains/events/account-event-page-shell.test.ts
  - app/components/events/EventGalleryPanel.vue
  - app/components/account/events/AccountEventGalleryPanel.vue
  - app/pages/account/events/[slug]/index.vue
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - tests/integration/server/api/participant-photo-routes.test.ts
  - tests/integration/server/api/account-event-gallery-page.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/authenticated/participant-photos.feature
  - tests/bdd/steps/participant-photos.steps.ts
  - docs/testing-strategy.md
type: feature
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants need a way to contribute pictures to the event's existing gallery. The team still needs to decide whether staff review is required before attendees see uploads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Eligible participants can upload photos to the existing event gallery after the check-in flow.
- [x] #2 Organizers keep their existing controls for the event gallery.
- [x] #3 Participant uploads become visible under the agreed review rules, and that rule is enforced for both listing and opening a photo.
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
1. Docs first: domain-model, permissions-matrix, schema-outline, api-surface, lifecycle (check-in flow), testing-strategy, README capability line.
2. Data: migration 0084 (events.participant_photos_enabled; event_photos.is_participant_upload, is_hidden with a check that a hidden photo is a participant upload and not public); mirror in server/database/schema.ts; apply to the local preview data.
3. Rule owners: pure rule canAddParticipantPhotos in shared/domains/events/photos.ts (event allows participant photos + confirmed registration + finished check-in flow) with the per-participant limit constant; server function mayAddParticipantPhotos in server/domains/events/photos.ts feeds it with hasApplicationFinishedCheckInFlow.
4. Photo domain: one viewer object from the access guards decides if hidden photos are returned; shared readers (list, one photo, has photos, public readers) own the hidden condition; one writer owns public visibility + hidden with the revision side effects; upload guard for both kinds of uploader; participant limit of 20.
5. Routes: upload serves both uploaders; new PATCH /api/events/:eventId/photos/:photoId/hidden (manage access, participant uploads only, audit record); highlight and public visibility refused while hidden; list/image/gallery page leave hidden photos out without manage access.
6. Event setting participantPhotosEnabled as a builder-only setting (updateEventBodySchema, serializeAdminEvent, settings page schema, app EventRecord, form state, buildPatchBody, checkbox in the After check-in group).
7. Participant page: gallery page carries canAddParticipantPhotos; gallery tab also for a participant who may add photos (entry loader + direct-link shell); Uploaded by participants section in the gallery panel with the shared upload control; Photos in the next-step activities.
8. Tests: integration (upload rules, limit, hide/show, hidden reads, public side), browser @task-451 with dedicated fixture events, unit test for the builder patch.
9. Generators (output schemas, operation catalog), eligibility manifest, MCP snapshot; lint, typecheck, unit, integration, bdd, diff check, readability check; browser check and screenshots on the local preview.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision by Alex on 2026-11-22: participant photos appear in the event gallery in an "Uploaded by participants" section. They are not public by default. Staff and admins can hide them.

Decisions made while building (2026-11-22):
- AC 3 is settled by Alex's decision of 2026-11-22: participant photos are visible in the event gallery right away, they are not public by default, and the people who manage the gallery can hide them. A hidden photo is neither listed nor opened for anyone without manage access. There is no review step before a photo is visible.
- One rule owner: canAddParticipantPhotos in shared/domains/events/photos.ts. It also says that a person who manages the gallery never adds participant photos (their uploads are photos of the event team), so the upload route and the gallery page cannot disagree. Server paths call mayAddParticipantPhotos in server/domains/events/photos.ts.
- Hidden photos: every reader of the protected gallery takes an EventPhotoViewer from the access functions, so no route can leave the hidden condition out. A database check keeps a hidden photo a participant photo and not public.
- Hide and public visibility write through one private writer (writeEventPhotoVisibility), which owns the image revision and public content revision changes.
- Manage access includes judges, as for every other gallery control today, so judges can hide too.
- Only the people who manage the gallery receive the uploader of a participant photo. Participants do not see who added a participant photo.
- Gallery layout: the filter and the highlights apply to the photos of the event team. Participant photos are always listed in full in their own section, so the gallery shows no highlight switch for them (the API still accepts it). The filter row is hidden while the event team has no photos.
- The photo insert chunk size now follows the column count (7 rows): two new columns would have pushed an 8-file request over the D1 limit of 100 bound values.
- Limit of 20 photos per participant and event; hidden photos count. Two uploads of the same participant at the same moment can pass the check together; the upload rate limit bounds this.

Test gaps:
- The limit is not tested under concurrent requests.
- The photo lightbox has no automated test. Checked by hand in the local preview with the lightbox library served from node_modules, because the preview dev server could not serve it (its Vite dependency cache is shared with BDD runs and was overwritten).
- No remote edge cache test was run; the public cache window of 30 seconds applies to a hidden photo as to every public change.

Evidence for the checked items (2026-11-22):
- AC 1: integration tests in tests/integration/server/api/participant-photo-routes.test.ts (accepted after finishing the check-in flow, refused before check-in, with an open questionnaire, with participant photos not allowed, without an approved registration; limit of 20); browser scenario 'Participant adds a photo after check-in, and event staff hide it'; upload of two photos through the page in the local preview.
- AC 2: the existing gallery tests in tests/integration/server/api/event-routes.test.ts pass unchanged; new tests cover uploads by staff, judge, event admin and platform admin, and highlight, public visibility and delete on participant photos.
- AC 3: decision of Alex of 2026-11-22 (visible right away, not public by default, the event team can hide). Integration tests prove that a hidden photo is absent from the photo list, the gallery page, the preview, the full display and the download for participants, and from the public list and public image; the browser scenario proves it in the page.
- DoD 1/2: docs/domain-model.md, permissions-matrix.md, schema-outline.md, api-surface.md, lifecycle-and-state-machines.md, testing-strategy.md and README.md describe the built behavior.
- DoD 3: bun run lint, bun run typecheck, bun run test:unit (736), bun run test:integration (711), bun run test:bdd (125 + 1 destructive), git diff --check all pass.
- DoD 6: no setup changed. Migration 0084 runs with the normal migration step.
- DoD 7: authorization stays in the platform data (event roles, approved registration, check-in flow); the permissions matrix is updated.

Review (2026-11-22): read the full diff with attention to who can upload and who receives hidden photos; confirmed that every read of the photo table goes through the shared readers in the photo domain; re-ran lint, typecheck, unit (736), integration (711), the full browser suite (125 plus 1), the readability check and git diff --check on the final tree; looked at the screenshots. No code changes were needed in review. Open for Alex: participant photos have no highlight control in the account gallery; photos stay when a participant withdraws or deletes their account; the shared gallery panel component grew and could be split after approval.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
What changed: an organizer can allow participant photos for an event (event builder, group 'After check-in'). A confirmed participant who finished the check-in flow then adds up to 20 photos to the event gallery. The gallery lists them in the section 'Uploaded by participants'. They are not public until the event team marks them public. The people who manage the gallery (staff, judges, event admins, platform admins) can hide a participant photo and show it again; a hidden photo is neither listed nor opened for participants or the public.

How: migration 0084 adds events.participant_photos_enabled and event_photos.is_participant_upload / is_hidden (with a database check). The rule 'who adds participant photos' has one owner (canAddParticipantPhotos in shared/, fed by mayAddParticipantPhotos in the photo domain). Every reader of the protected gallery takes a viewer object from the access functions, and the public readers share one condition, so no route returns a hidden photo. Hide and public visibility share one writer for the revision side effects. New operation PATCH /api/events/:eventId/photos/:photoId/hidden (included in MCP).

Verification: lint, typecheck, unit (736), integration (711, 60 new), browser tests (125 + 1 destructive, 2 new), git diff --check all pass. Checked in the local preview with screenshots at two widths and both themes.

Risks and follow-ups:
- Product question: highlights and the gallery filter apply to event-team photos only; participant photos are always listed. Decide whether highlighted participant photos should join the curated view.
- Participant photos stay in the gallery when the participant withdraws or deletes the account (the uploader then shows as 'Deleted User'). Decide whether they should be removed.
- The photo routes do not check whether an event is hidden (existing behavior of the read routes, now also true for a participant upload by direct API call).
- The limit of 20 photos is checked before the insert; two uploads at the same moment can pass together. The upload rate limit bounds this.
- A public photo that gets hidden can stay in the public cache for up to 30 seconds, like every public change.
- EventGalleryPanel.vue grew; extracting the photo card needs Alex's approval under the component rules.
<!-- SECTION:FINAL_SUMMARY:END -->
