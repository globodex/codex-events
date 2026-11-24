---
id: TASK-493
title: Merge Build registration tracks into the challenge list
status: In Progress
assignee: []
created_date: '2026-11-24T19:39:00Z'
updated_date: '2026-11-24T20:17:00Z'
labels: []
milestone: m-3
dependencies:
  - TASK-491
modified_files:
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
  - app/components/account/events/organisms/AccountEventTracksPanel.vue
  - app/components/admin/builder/molecules/AdminBuilderChallengeCard.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationApplicationSection.vue
  - >-
    app/components/applications/participant-registration/ParticipantRegistrationForm.vue
  - app/components/events/molecules/EventStaffInstructions.vue
  - app/domains/applications/admin-application-record.ts
  - app/domains/applications/participant-application.ts
  - app/domains/applications/participant-registration-definition.ts
  - app/domains/events/admin-event.ts
  - app/domains/events/builder.ts
  - app/pages/account/events/[slug]/index.vue
  - app/pages/events/[slug]/register.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - drizzle/0090_merge_build_tracks.sql
  - server/api/events/[eventId]/applications/index.post.ts
  - server/api/events/[eventId]/applications/me/actions/select-track.post.ts
  - server/api/events/[eventId]/index.patch.ts
  - server/api/events/index.post.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/applications/index.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-participants-page.ts
  - server/domains/events/certificates.ts
  - server/domains/events/challenges.ts
  - server/domains/events/index.ts
  - server/domains/events/participation.ts
  - shared/domains/account/account-overview-page.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-participants-page.ts
  - shared/domains/events/challenges.ts
  - stories/participant/AccountEventTracksPanel.stories.ts
  - stories/participant/ParticipantRegistrationForm.stories.ts
  - tests/bdd/features/authenticated/event-builder.feature
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/account-event-entry-prizes-pages.test.ts
  - tests/integration/server/api/application-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/api/event-routes.test.ts
  - tests/integration/server/api/public-certificate-routes.test.ts
  - tests/integration/server/database/migration.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/unit/app/components/participant-registration-controller.test.ts
  - >-
    tests/unit/app/domains/applications/participant-registration-definition.test.ts
  - tests/unit/app/domains/events/admin-event-schema.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - tests/unit/server/domains/events/index.test.ts
type: enhancement
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex decided on 2026-11-24 that Build events keep one list that participants choose from: the challenge list with its open tracks. Build events lose their separate registration tracks; Hackathon tracks stay because submissions and judging use them. Production has one completed Build event with 4 tracks (codex-build-vienna-2026-06-20), the test environment one with 2. Alex asked that nothing of those tracks is lost, including staff instructions and links that do not start with https. Tracks have no length limits, challenges do, and the server checks the stored challenge list on every read, so the move must fit the challenge rules or stop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Build events have no registration tracks: the builder shows the Tracks tile for Hackathons only, registration never asks Build participants for a track, and the server refuses tracks for Build events
- [x] #2 Challenges and open tracks can carry staff instructions, edited in the event builder and shown only to staff, event admins and platform admins
- [x] #3 A migration turns every Build track into a published open track of its event without loss (name, short and full description, links with their descriptions, staff instructions) and moves participants' track choices and staff tracks to it; it stops instead of cutting data that does not fit the challenge rules
- [x] #4 Hackathon tracks, submissions and judging are unchanged
- [ ] #5 A migration test proves the move with sample tracks, choices and staff tracks, and the remote test environment migrates its Build event with public reads still working
- [x] #6 Docs and tests describe Build events without registration tracks
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Challenges get optional staffInstructions (max 4000), edited in the builder challenge card and stripped for everyone but staff and admins (listReadableEventChallenges); shared EventStaffInstructions block for tracks and challenges.
2. Tracks become Hackathon-only: eventTypeSupportsTracks, create and update, registration route and form (no track field), select-track, builder Tracks tile, certificates (no single Build track name).
3. Migration 0090 moves Build tracks into the challenge list as published open tracks: name, short and full description and all links (with descriptions, any scheme) as Markdown in the instructions, staff instructions; moves selected_track_id to selected_challenge_id and staff_track_id to staff_challenge_id; deletes Build tracks; a check table stops the migration when an entry would break a challenge rule.
4. Migration tests, updated unit, integration and browser tests, docs; remote test environment check after push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built 2026-11-24 after Alex chose "Full merge now" and "Keep those too". Production has one completed Build event with 4 tracks (codex-build-vienna-2026-06-20), the test environment one with 2 (codex-build-vienna). Their contents could not be measured (no Cloudflare login on this machine), so the migration keeps every text and link and stops instead of cutting: links become a Markdown list in the instructions, so link descriptions and non-https links survive; challenge resources keep the https rule.
No certificate changes: the single-track Build certificate rule applied to no existing event (4 and 2 tracks).
Verification: lint, typecheck, unit 719 (Build track tests moved to Hackathons or turned into refusals), integration 775 (two migration tests: the full move and the stop), full BDD (builder track scenario now on a Hackathon), browser check: the demo Build event has no Tracks tile and every challenge has the staff instructions field.
<!-- SECTION:NOTES:END -->
