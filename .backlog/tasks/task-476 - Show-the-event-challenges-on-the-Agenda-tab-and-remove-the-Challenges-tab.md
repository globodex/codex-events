---
id: TASK-476
title: Show the event challenges on the Agenda tab and remove the Challenges tab
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T20:05:00Z'
updated_date: '2026-11-22T20:47:00Z'
labels: []
milestone: m-3
dependencies:
  - TASK-474
references:
  - shared/domains/events/program.ts
  - shared/domains/events/challenges.ts
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
modified_files:
  - shared/domains/events/program.ts
  - shared/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/account-event-program-page.ts
  - server/application/operations/generated-output-schemas.ts
  - app/domains/events/account-workspace-tabs.ts
  - app/domains/events/account-workspace-seo.ts
  - app/pages/account/events/[slug]/index.vue
  - app/pages/admin/events/builder/[eventId].vue
  - app/components/account/events/molecules/AccountEventDetailsDialog.vue
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
  - app/components/account/events/organisms/AccountEventChallengeList.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/account/events/organisms/AccountEventChallengesPanel.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - app/components/admin/builder/organisms/AdminBuilderFloorPlans.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramEditor.vue
  - stories/features/fixtures/build-day.fixtures.ts
  - stories/features/AccountEventProgramAgenda.stories.ts
  - stories/features/AccountEventProgramFloorPlan.stories.ts
  - stories/features/AdminBuilderProgramEditor.stories.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/integration/server/mcp/mcp-protocol.test.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/server/domains/events/account-event-tab-visibility.test.ts
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/steps/challenges.steps.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - docs/domain-model.md
  - docs/api-surface.md
  - docs/schema-outline.md
  - docs/lifecycle-and-state-machines.md
  - docs/testing-strategy.md
type: feature
ordinal: 192000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants of a Build Day choose a challenge and then look for its room. Challenges had their own tab, and the Agenda tab showed room texts that were typed a second time on the floor plan. Alex decided on 2026-11-22 to bring the challenges into the Agenda tab, next to the map, and to remove the Challenges tab: a challenge is a card like an agenda item, selecting it highlights its rooms, and one challenge can have several rooms (Build your own idea has two).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Agenda tab lists the published challenges that the person may read, as cards next to the map on a wide screen and below it on a narrow one.
- [x] #2 An organizer links a room to a challenge in the floor plan editor, and selecting a challenge on the Agenda tab highlights every room linked to it.
- [x] #3 A Details button on a challenge opens its instructions and resource links in a popup.
- [x] #4 A person who may read challenges but not the sessions sees the challenge list next to the public agenda, without a map.
- [x] #5 The Challenges tab and the room text 'What happens here' no longer exist. The Agenda tab is available when the event has an agenda or a challenge the person may read.
- [x] #6 The next-step card leads to the challenges through the Agenda.
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
1. Model: a floor plan room names one challenge by its id (challengeId) in place of the activity text. The Agenda page answers the readable challenges next to the program; the entry page no longer carries them.
2. Server: the Agenda page route adds listReadableEventChallenges; the tab rule gives the Agenda tab for an agenda or a readable challenge and has no Challenges tab.
3. Agenda tab: a challenge card (molecule) with title, its rooms and a Details popup, and a challenge list (organism) with a heading. The Agenda organism keeps one selection: a session, a challenge or a room. The floor plan molecule highlights several rooms.
4. Builder: the floor plan editor offers 'Challenge' per room with the event's challenges as choices.
5. Remove the Challenges tab, its panel and the room text field. Update the next-step activities, docs, integration and browser tests, stories and the preview data with five challenges.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design decision: the link between challenges and rooms is stored on the room (room.challengeId), not as a list of rooms on the challenge. Reasons: the floor plan editor already has the rooms and edits them one at a time, so the choice is one select where the text field was; a challenge with two rooms needs no multi-select; a deleted or unpublished challenge leaves only an unused id on the room, so no rule between the two stores is needed. The proposal that Alex approved said 'each challenge gets a Rooms choice'; this places the choice on the room and has to be reported to him.

Model: programRoomSchema has challengeId in place of activity. accountEventAgendaPageSchema has challenges next to program. The entry page lost its challenges field; it still computes hasReadableChallenges for the tab list.

Server: the Agenda page route answers listReadableEventChallenges for every caller, also when the program is null. buildAccountEventTabVisibility gives the Agenda tab for an agenda or a readable challenge and no longer knows a Challenges tab.

Agenda tab: AccountEventChallengeList.vue (organism) is the list with its heading; AccountEventChallengeCard.vue (molecule) is one challenge with its room names and the Details popup; AccountEventDetailsDialog.vue (molecule) is the Details button and popup that the session card and the challenge card share. AccountEventProgramAgenda.vue keeps one selection (a session, a challenge or a place on the map) and gives the floor plan the rooms to highlight; AccountEventProgramFloorPlan.vue takes selectedRooms and shows a route only while one room is selected. Beside each other the map keeps its width and the challenges take the rest, at least 13rem. Closest analog of the challenge card: the session card AccountEventProgramSession.vue, which is built around a duration, the running and next marks and plain-text details.

A person who reads challenges but not the sessions (event staff, or any reader in an event without a program) gets the public agenda panel with the challenge list next to it, and no map: the page branch in app/pages/account/events/[slug]/index.vue.

Builder: the floor plan editor has 'Challenge' per room, with the saved challenges of the event as choices (drafts are marked). It shows only when the event has challenges, and a room keeps its challenge on save only while the event still has that challenge. The challenges reach the editor as a prop from the builder page through the program editor and the floor plan list.

Removed: the Challenges tab (tab list, label, page title, section, next-step activity), AccountEventChallengesPanel.vue, AccountEventProgramRoomCard.vue and the room text 'What happens here' from TASK-474.

Local preview: five published challenges, the four from Alex's table and 'Build your own idea'; rooms linked by link-challenges.ts in the session scratchpad: U1-7 site, U1-1 explorable, U1-2 game, U1-6 automate, U1-4 + 5 and Main room own idea.

Validation on the final working tree (2026-11-22): bun run mcp:generate-output-schemas run after the model change; bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 728 tests passed; bun run test:integration 52 files, 765 tests passed; bun run test:bdd 126 passed plus 1 destructive passed, with the three challenge scenarios on the Agenda tab; git diff --check clean. codehygiene on the changed .ts files flags only zod chains, the style of the repository.

Browser checks in the local preview (scripts shoot-476-challenges.mjs, shoot-476-no-program.mjs, shoot-476-builder.mjs and measure-476.mjs in the session scratchpad): at 1440x900 dark and light and 1280x800 light the five challenges stand beside the map, at 1024x768 dark and 390x844 light and dark below it; selecting 'Build your own idea' highlights U1-4 + 5 and the Main room and names both in the caption; Details opens the instructions; no console errors and no sideways overflow. An event without a program shows the public agenda with the challenge list beside it and no map, at 1440x900 light and 390x844 dark. In the builder the room choice 'Challenge' lists the five challenges, shows the saved link of a room, and the old text field is gone.

Test gaps: no automated browser test selects a challenge and reads the highlighted rooms, and none uses the builder choice 'Challenge'. Both were checked by hand as described above. The server side (who reads challenges on the Agenda page, the tab rule, the stored room link) is covered by integration and unit tests, and the browser scenarios read a challenge and its details on the Agenda tab.

Local preview on 2026-11-22, after Alex asked for two tracks outside the four challenges: 'Build your own idea' is replaced by two published entries, 'Build your own idea (technical track)' in U1-4 and 'Build your own idea (non-technical track)' in U1-5. Which track is in which room is an assumption. The Main room names no entry any more. Both entries are challenge records, so they stand in the same list under the heading 'Challenges'; a separate group for them would need a new field and is an open question to Alex.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event challenges moved from their own tab into the Agenda tab. The Agenda page now answers the published challenges that the caller may read next to the program, and the tab exists for an agenda or a readable challenge. On the tab the challenges are cards under a 'Challenges' heading, beside the map on a wide screen and below it on a narrow one: title, room names and a Details button that opens the instructions and links. Selecting a challenge highlights every room that names it, so 'Build your own idea' lights up two rooms. A room names its challenge through the choice 'Challenge' in the floor plan editor, which replaces the room text from TASK-474. People who read challenges but not the sessions get the list next to the public agenda without a map. The Challenges tab, its panel, the room card and the room text are removed. Checks: lint, typecheck, 728 unit, 765 integration, 126 + 1 browser tests, and browser checks at six screen sizes and themes. Risks and follow-ups: the link is stored on the room, while the approved proposal described a rooms choice on each challenge, which has to be confirmed with Alex; challenge titles are long for the 13rem column; the production event needs the five challenges and the room links entered in the builder.
<!-- SECTION:FINAL_SUMMARY:END -->
