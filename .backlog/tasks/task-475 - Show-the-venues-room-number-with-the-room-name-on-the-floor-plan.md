---
id: TASK-475
title: Show the venue's room number with the room name on the floor plan
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T19:42:00Z'
updated_date: '2026-11-22T19:58:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - shared/domains/events/program.ts
modified_files:
  - shared/domains/events/program.ts
  - app/domains/events/program-map.ts
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/account/events/molecules/AccountEventProgramRoomCard.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - tests/integration/server/api/event-program-routes.test.ts
  - server/application/operations/generated-output-schemas.ts
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
type: feature
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At TU Wien a room has two identifiers: the name the event uses (for example U1-1, short for Seminarraum AE U1-1) and the room number on the door and on the venue's own map (AEU103). Participants meet both. Alex asked on 2026-11-22 to use both on the Agenda map.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the floor plan editor of the event builder an organizer can enter the venue's number of a room.
- [x] #2 The Agenda map shows the number as a second line under the name of the room.
- [x] #3 The map names a selected room with its name and its number.
- [x] #4 A room without a number looks as before.
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
1. Model: an optional number text on a floor plan room in shared/domains/events/program.ts.
2. Builder: one input 'Room number' per room in AdminBuilderFloorPlanEditor.vue.
3. Participant map: AccountEventProgramFloorPlan.vue writes the number as a second, smaller line under the room name, and shows name and number for the selected room.
4. Docs, room fixture of the integration test, preview data with the TU Wien numbers, browser check at two widths in both themes, full validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: a floor plan room can carry number, a text of up to 30 characters. The builder input is 'Room number' under the room name; an empty input stores no number.

Display: roomLabel in app/domains/events/program-map.ts writes a room as 'U1-1 · AEU103'. The map caption of a selected room and the room cards use it. On the map the number is a second, smaller line under the room name; the label keeps its edge in the page color and turns with the selection like the name.

Local preview: U1-1 AEU103, U1-2 AEU107, U1-3 AEU115, U1-4 + 5 AEU119 + AEU125, U1-6 AEU131, U1-7 AEU140, Main room AEU141, from the TUW Maps picture Alex sent on 2026-11-22. Checked at 1440x900 dark and light, 1280x800 light, 1024x768 dark and 390x844 light and dark; the builder input at 1440x900 light and 390x844 dark.

Test gap: no automated test reads the second line on the map. The stored number is covered by the room fixture of event-program-routes.test.ts.

Validation on the final working tree (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 727 tests passed; bun run test:integration 52 files, 765 tests passed; bun run test:bdd 126 passed plus 1 destructive passed; bun run mcp:generate-output-schemas was run after the model change; git diff --check clean. codehygiene on the changed .ts files flags only zod chains, the style of the repository.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A floor plan room can now carry its number at the venue ('Room number' in the floor plan editor). The Agenda map writes the number as a second, smaller line under the room name, and the caption of a selected room and the room cards name a room by both, for example 'U1-7 · AEU140'. A room without a number looks as before. In the local preview the seven event rooms carry the TU Wien numbers from the TUW Maps picture Alex sent. Checks: lint, typecheck, 727 unit, 765 integration, 126 + 1 browser tests, and a browser check at six screen sizes and themes. Risks and follow-ups: on a phone the two-line labels of U1-1, U1-2 and Check-in stand close together; the production plan needs the numbers entered in the builder.
<!-- SECTION:FINAL_SUMMARY:END -->
