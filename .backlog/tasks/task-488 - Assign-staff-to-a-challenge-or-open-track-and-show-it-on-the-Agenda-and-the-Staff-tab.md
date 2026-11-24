---
id: TASK-488
title: >-
  Assign staff to a challenge or open track and show it on the Agenda and the
  Staff tab
status: Done
assignee:
  - '@claude'
created_date: '2026-11-23T19:56:00Z'
updated_date: '2026-11-24T20:32:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/account/events/AccountEventPublishedRosterPanel.vue
  - shared/domains/events/challenges.ts
  - server/api/events/[eventId]/roles/[userId].patch.ts
modified_files:
  - app/components/account/events/AccountEventPublishedRosterPanel.vue
  - app/components/account/events/AccountEventRoleRosterPanel.vue
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
  - app/components/account/events/organisms/AccountEventChallengeList.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/domains/events/access.ts
  - app/domains/events/published-roster.ts
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - server/api/events/[eventId]/roles/[userId].patch.ts
  - server/api/events/[eventId]/roles/[userId].put.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/events/account-event-program-page.ts
  - server/domains/events/account-event-rosters-page.ts
  - server/domains/events/index.ts
  - shared/domains/events/account-event-rosters-page.ts
  - shared/domains/events/program.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/unit/app/domains/events/published-roster.test.ts
  - drizzle/0086_staff_challenge.sql
  - tests/bdd/features/authenticated/staff-challenge.feature
  - tests/bdd/steps/staff-challenge.steps.ts
  - app/components/AppAvatar.vue
  - app/pages/account/events/[slug]/index.vue
type: feature
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At a Build event, staff members support one challenge or one open track, for example as its mentors in its room. Today a staff member can only be shown with one event track, and the Agenda does not say who supports a challenge. Alex asked on 2026-11-23 to assign staff members to challenges or open tracks and to show them on the Agenda page and on the Staff page. He chose: the assignment is made on the Staff tab, where a staff member gets a track today; each staff member gets one challenge or open track and several people can share one; participants read the word "Staff" for these people.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On the Staff tab, an event admin or platform admin gives a staff member one challenge or one open track of the event, or the whole event again, in the same select that offers the tracks.
- [x] #2 A staff member has a track or a challenge, never both: choosing one clears the other. The server refuses a challenge that is not in the challenge list of the event and a challenge for a person without staff visibility.
- [x] #3 The Staff tab lists staff members under their challenge or open track. Staff members without one stay under their track or under the whole-event group.
- [x] #4 A person who may not read the challenges of the event never receives a challenge title through the staff list, and a draft challenge is shown to event admins only.
- [x] #5 The assignment does not change what a staff member may do.
- [x] #6 Integration tests, a browser scenario and the canonical docs cover the assignment.
- [x] #7 The Agenda tab shows, on each challenge and open track, the profile icons of the staff members assigned to it, with their initials when a staff member has no icon and the name on hover.
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
1. Model: a nullable text column staff_challenge_id on event_role_assignments (migration 0086) with a check: it is set only with staff visibility and without a staff track. Challenges live in events.challenges_json, so the column has no foreign key; the server resolves the id against the challenge list when it reads.
2. Roles API (PUT and PATCH /api/events/:eventId/roles/:userId): accept staffChallengeId; a challenge must be an entry of the challenge list of the event; setting a challenge clears the track and setting a track clears the challenge.
3. Published staff list: each member carries staffChallenge (id, title, isOpenTrack, displayOrder) when the reader may read the challenges and the challenge is published. The rosters page gives event admins the challenge options, drafts included.
4. Agenda page: each challenge of the page carries staffNames.
5. App: the Staff tab select offers tracks, challenges and open tracks; the sections of the Staff tab include challenges and open tracks; the challenge card on the Agenda shows "Staff: names".
6. Docs (domain model, schema outline, API surface, permissions matrix, testing strategy), unit, integration and browser tests, and all checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-23.

Model: event_role_assignments.staff_challenge_id (migration 0086), a text column without a foreign key, because the challenges live in events.challenges_json. A check keeps it null unless the person has staff visibility and no staff track. The id is checked when it is written (resolveRoleAssignmentStaffScope in server/domains/events/index.ts) and resolved against the published challenges when it is read (findStaffChallenge), so a draft or a removed challenge shows the person as whole-event staff. Nothing is cleaned up when a challenge is removed from the event.

Roles API: PUT and PATCH /api/events/:eventId/roles/:userId accept staffChallengeId. getRequestedStaffScope owns the rule that choosing a track drops the stored challenge and choosing a challenge drops the stored track; a request with both is refused.

Reads: listPublishedEventRosterMembers takes the challenges that the reader may read and adds staffChallenge to each staff member. The /rosters page passes them (listReadableEventChallenges) and gives event admins staffChallengeOptions with drafts. The /program page adds staffNames to each challenge and reads the staff only when the reader gets a challenge. GET /api/events/:eventId/staff names no challenge.

App: the Staff tab select ("Shown to participants") now has the groups Tracks, Challenges and Open tracks; a draft is marked "(draft)". The staff sections add one section per challenge and open track after the tracks. The challenge card on the Agenda shows "Staff: names" below the title. Both role panels send the stored track or challenge again when they save an admin assignment (keepStaffScope in app/domains/events/access.ts), so a change of the judging or staff flags does not drop it.

No new component: the select, the sections and the challenge card were extended.

Preview data (local only): three demo users are staff of the demo event; two support the challenge "Build a site someone can use" and one the open track "Build your own idea (technical track)".

Changed on 2026-11-24: Alex asked for profile icons instead of names on the Agenda cards. The /program page gives each challenge staff (id, fullName, profileIconRevision) in place of staffNames. The card (AccountEventChallengeCard) shows one AppAvatar per staff member: the profile icon through buildProfileIconHref with the event id, as on the Staff tab, the initials without an icon, and the name as hover title. For screen readers the row is one image with the label "Staff: <names>". AppAvatar has a new size xs (24 px). The avatar fill is the card background (bg-default), so the card adds border-border to draw the circle. No new component: the closest analog is the avatar on the Staff tab cards (AccountEventPublishedRosterPanel). The profile icon route already lets every reader of the event workspace load the icon of a staff member (isUserVisibleInPublishedEventRoster). The demo data has no staff member with an uploaded icon, so the browser check covered the initials only.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An event admin or platform admin now gives each staff member one challenge or one open track on the Staff tab, in the select that already offered the tracks (groups: Tracks, Challenges, Open tracks; a draft is marked). The Agenda tab shows "Staff: names" on each challenge and open track, and the Staff tab lists staff members under their challenge or open track, after the whole-event staff and the tracks.

How it is stored: a new nullable column event_role_assignments.staff_challenge_id (migration 0086) holds the id of an entry in events.challenges_json. A database check allows it only with staff visibility and without a staff track. The roles API (PUT and PATCH) checks that the id is in the challenge list of the event; choosing a track clears the challenge and the other way round.

Who sees it: a challenge title reaches only a person who may read the challenges of the event, and only for a published challenge. Everyone else, and everyone for a draft or a removed challenge, sees the staff member as whole-event staff. The assignment changes no permission: no authorization code reads the new column.

Checks on 2026-11-23: lint and type check pass; 718 unit tests, 775 integration tests and 144 browser tests pass. Checked in a real browser on the local preview at 1440 px and 390 px, light and dark: the admin select, the Agenda of a confirmed participant and the Staff tab of a participant.

Not checked by hand: a Hackathon or a Meetup, and an event that has both tracks and challenges (covered by an integration test only). GET /api/events/:eventId/staff names no challenge; only the Staff tab page does.

Risks and follow-ups: (1) One staff member has one challenge or open track; a person who supports two cannot be shown with both. (2) Removing a challenge from an event leaves the stored id on the role assignment; it is ignored when read and replaced by the next choice. (3) Production needs migration 0086, which the release workflow applies. (4) A Vue development warning "toRefs() expects a reactive object" appears on the Staff tab of an admin; it is there without this change as well and was not looked into.

Changed on 2026-11-24 at Alex's request: the Agenda cards show the staff of a challenge or open track as profile icons, with initials without an icon and the name on hover. Checks: lint, typecheck, unit tests (719), the challenge integration tests (49), the browser scenario @task-488, and pictures of the Agenda cards at 1440 px light and 390 px dark. The demo data has no staff member with an uploaded icon, so the browser check showed the initials only.
<!-- SECTION:FINAL_SUMMARY:END -->
