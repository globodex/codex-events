---
id: TASK-491
title: Let participants choose an open track or challenge on the Overview
status: Done
assignee: []
created_date: '2026-11-24T19:39:00Z'
updated_date: '2026-11-24T20:17:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/AccountEventAdminOperationsPanel.vue
  - app/components/account/events/AccountEventParticipantVisibilityPanel.vue
  - app/components/account/events/AccountEventParticipantsPanel.vue
  - app/components/account/events/molecules/AccountEventChallengeChoiceCard.vue
  - app/components/account/events/organisms/AccountEventChallengeChoice.vue
  - app/domains/applications/admin-application-record.ts
  - app/domains/applications/participant-application.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - drizzle/0089_selected_challenge.sql
  - server/api/events/[eventId]/applications/me/actions/select-challenge.post.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/applications/index.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-participants-page.ts
  - server/domains/events/challenges.ts
  - server/domains/events/participation.ts
  - shared/domains/account/account-overview-page.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-participants-page.ts
  - stories/participant/EventParticipationCard.stories.ts
  - tests/bdd/features/authenticated/challenge-choice.feature
  - tests/bdd/steps/challenge-choice.steps.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/challenge-choice-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
type: enhancement
ordinal: 208000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Organizers asked to present the open tracks and challenges more clearly on the Overview and to let participants pick one, so the team can plan the rooms from the numbers. Alex decided on 2026-11-24: the choice is optional, registration never asks for it, participants decide before or during the event, and staff and admins see the numbers on the Participants tab. Sketch: open tracks under 'Here are the planned tracks', challenges under 'Don't know what to build? Participate in one of our challenges', each card with 'Show more' for the title and the detailed description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Below the credits, the Overview tab shows the published open tracks under 'Here are the planned tracks' and the published challenges under 'Don't know what to build? Participate in one of our challenges', as cards with their title; 'Show more' opens the instructions and links of a card
- [x] #2 A confirmed participant chooses one open track or challenge on the Overview and can change or clear the choice until the event is completed; the choice is optional and stored on the registration
- [x] #3 The server accepts only a published entry of the event's challenge list and refuses people without a confirmed registration and completed events
- [x] #4 The Participants tab shows staff, event admins and platform admins the number of confirmed participants per open track and challenge and 'No choice yet', counted on the server, and filters the confirmed participants by choice
- [x] #5 Registration never asks for the choice
- [x] #6 Docs and unit, integration and browser tests cover the cards, the choice and its rules, and the numbers
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
1. Storage: migration 0089 adds user_applications.selected_challenge_id (no foreign key; the challenges are JSON).
2. Server: listPublishedEventChallenges owns the published entries; POST .../applications/me/actions/select-challenge stores, changes or clears the choice for an approved registration of an event that is not completed; the entry page carries the readable challenges; the participants page counts approved participants per published entry and without a choice.
3. App: AccountEventChallengeChoice (organism) with AccountEventChallengeChoiceCard (molecule) below the credits on the Overview; choice counts and a filter on the Participants tab.
4. Docs, unit, integration and browser tests; browser check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built 2026-11-24 after Alex's answers (optional choice, nothing at registration, numbers on the Participants tab).
New components: AccountEventChallengeChoice and AccountEventChallengeChoiceCard. Closest analogs: AccountEventTracksPanel (choose button and details, but it is built for registration tracks with short descriptions and track-staff modes) and AccountEventChallengeList with AccountEventChallengeCard (grouped challenges, but built for the Agenda map: room selection and a details dialog). Neither expresses grouped cards with "Show more" in place and a choice without a mode switch; the new ones compose EventTrackDetails, AppButton and AppBadge.
Counts come from the server (exact for any size); the filter applies to the loaded list.
Verification: lint, typecheck, unit 719, integration 775 (new challenge-choice-routes test file), full BDD 145 + destructive, browser check at 1440 light and 390 dark (cards, chosen state, Participants numbers; demo choice set by SQL for the picture and set back to null).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Below the credits, the Overview shows the published open tracks under "Here are the planned tracks" and the published challenges under "Don't know what to build? Participate in one of our challenges", as cards with "Show more" for the instructions and links. A confirmed participant chooses one, changes or clears it until the event is completed; registration never asks. The choice is stored in user_applications.selected_challenge_id (migration 0089). The Participants tab shows staff and admins the number of confirmed participants per entry and "No choice yet", counted on the server, with a filter by choice. Verified with lint, typecheck, unit, integration, the full browser suite and a browser check. Risks: a choice of an entry that the organizer later unpublishes counts as no choice; the filter applies to the registrations the list has loaded.
<!-- SECTION:FINAL_SUMMARY:END -->
