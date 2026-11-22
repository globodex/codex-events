---
id: TASK-474
title: Show what happens in each room next to the floor plan
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T19:29:00Z'
updated_date: '2026-11-22T20:30:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - shared/domains/events/program.ts
modified_files:
  - shared/domains/events/program.ts
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - tests/integration/server/api/event-program-routes.test.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - server/application/operations/generated-output-schemas.ts
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/molecules/AccountEventProgramRoomCard.vue
type: feature
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants of the Vienna Build Day choose a room by its challenge: U1-6 Computer Use, U1-1 3D, U1-2 Video-game, U1-7 Sites, U1-4 + 5 Build your own idea, Main room Build your own idea overflow. The floor plan on the Agenda tab only shows room names. Alex asked on 2026-11-22 to show these texts on the right of the map, each with an arrow to its room.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the floor plan editor of the event builder an organizer can write a short text that says what happens in a room.
- [x] #2 A room without such a text is not listed, and a plan without any text looks as before.
- [x] #3 On a wide screen the Agenda tab shows a card for each of these rooms on the right of the map, in the look of the agenda items.
- [x] #4 Selecting a card highlights its room on the map, like selecting an agenda item that has a room.
- [x] #5 On a narrow screen the cards stand below the map, and selecting one brings the map into view.
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
1. Model: an optional activity text on a floor plan room in shared/domains/events/program.ts.
2. Builder: one input 'What happens here' per room in AdminBuilderFloorPlanEditor.vue.
3. Agenda tab: AccountEventProgramAgenda.vue shows a card for every room of the shown plan that has an activity, beside the map on a wide screen and below it on a narrow one. A card is the new molecule AccountEventProgramRoomCard.vue. Selecting a card selects its room on the map through the existing map selection.
4. Docs, integration test for the stored text, story fixture, preview data with the six Vienna texts, browser check at two widths in both themes, full validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: a floor plan room can carry activity, a text of up to 60 characters. The builder input is 'What happens here' under the room name; an empty input stores no activity.

Map: the root of AccountEventProgramFloorPlan.vue is now a wrapper that is the container 'plan'. From 36rem of available width the list stands beside the plan (13rem wide, added to the card's maximum width) and an SVG draws one arrow per text from the right edge of the plan to the side of the room that faces the list. Below that width the list stands under the plan and every text starts with its room name. placeRoomActivities in app/domains/events/program-map.ts sorts the texts from top to bottom, puts each at the height of its room, keeps 28px between two texts and keeps the last text on the plan. Beside the plan the room name is for screen readers only.

Local preview: U1-6 Computer Use, U1-1 3D, U1-2 Video-game, U1-7 Sites, U1-4 + 5 Build your own idea, Main room Build your own idea overflow. The street name Karlsgasse in the plan picture moved up along the street, so no arrow crosses it.

Browser check of the Agenda tab: 1440x900 dark and light and 1280x800 light show the list beside the plan with six arrows; 1024x768 dark and 390x844 light and dark show the list under the plan with room names. No console errors or failed requests. The builder input was checked at 1440x900 dark and 390x844 light.

Test gap: no automated test draws the list or the arrows. The stored text is covered by the room fixture of event-program-routes.test.ts, and the story fixture of the floor plan now has two rooms with an activity.

Redesign on 2026-11-22. The first version listed the texts beside the plan with an arrow to every room. Alex saw it and asked: 'make it nicer. I would put the 4 challenges and open track on the right of the map. When you tap on them it would highlight the room like the agenda items do'. The texts are now cards in the look of the agenda items, and the arrows and their placing function are removed: the highlight shows the room.

Card design: the closest existing component is AccountEventProgramSession.vue, the agenda session card. It is built around a session: a duration, the running and next marks, and the Details dialog. A room card has none of these, so it is its own small molecule, AccountEventProgramRoomCard.vue, with the same card classes: title, then a line with the map pin and the room. The organism AccountEventProgramAgenda.vue lists the cards of the shown floor and owns the selection: selecting a card calls the existing map selection, so the card, the room on the map and the caption show the same room. A room that is selected through a session or on the map marks its card too.

Layout: the map panel is a container. From 36rem the cards stand in a 13rem column on the right of the map; below that they stand under the map, in two columns from 28rem. After a card is selected the page scrolls just enough to show the whole map, so on a phone the map comes back into view.

Order of the cards: the order of the rooms on the floor plan. For Vienna the plan file lists the four challenge rooms first, then the two rooms of the open track: Computer Use (U1-6), 3D (U1-1), Video-game (U1-2), Sites (U1-7), Build your own idea (U1-4 + 5), Build your own idea overflow (Main room). The street name Karlsgasse is back at its first place in the picture.

Browser check of the card version (script shoot-474-cards.mjs in the session scratchpad): 1440x900 dark and light and 1280x800 light show the six cards beside the map; 1024x768 dark and 390x844 light and dark show them below the map. Selecting the Sites card marks the card, highlights U1-7, names it in the caption and brings the whole map into view. No console errors or failed requests.

Validation on the final working tree (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 727 tests passed; bun run test:integration 52 files, 765 tests passed; bun run test:bdd 126 passed plus 1 destructive passed; bun run mcp:generate-output-schemas was run after the model change; git diff --check clean. codehygiene on the changed .ts files flags only zod chains, the style of the repository.

Changed by TASK-476 on 2026-11-22: the room text (activity) and the room cards of this task no longer exist. A room now names a challenge, and the cards on the Agenda tab are the challenges themselves.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A floor plan room can now say what happens in it ('What happens here' in the floor plan editor). The Agenda tab shows a card for every such room of the shown floor, in the look of the agenda items: beside the map on a wide screen and below it on a narrow one. Selecting a card selects its room through the existing map selection, so the room is highlighted, named in the caption and brought into view. A first version with small texts and arrows was replaced after Alex asked for cards that highlight the room. In the local preview the cards are Computer Use (U1-6), 3D (U1-1), Video-game (U1-2), Sites (U1-7), Build your own idea (U1-4 + 5) and Build your own idea overflow (Main room). Checks: lint, typecheck, 727 unit, 765 integration, 126 + 1 browser tests, and a browser check at six screen sizes and themes. Risks and follow-ups: the cards follow the order of the rooms on the plan, and the builder has no control to reorder rooms; no browser scenario covers the cards; the production plan needs the six texts entered in the builder.
<!-- SECTION:FINAL_SUMMARY:END -->
