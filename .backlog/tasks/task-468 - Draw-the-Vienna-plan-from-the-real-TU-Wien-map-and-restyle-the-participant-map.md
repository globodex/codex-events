---
id: TASK-468
title: Draw the Vienna plan from the real TU Wien map and restyle the participant map
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T12:06:00Z'
updated_date: '2026-11-22T12:57:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanMap.vue
  - app/domains/events/program-map.ts
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/schema-outline.md
  - server/application/operations/generated-output-schemas.ts
  - shared/domains/events/program.ts
  - stories/features/fixtures/build-day-ground-floor.svg
  - stories/features/fixtures/build-day-upper-floor.svg
  - stories/features/fixtures/build-day.fixtures.ts
  - tests/bdd/steps/event-program.steps.ts
  - tests/integration/server/api/event-program-routes.test.ts
type: enhancement
ordinal: 184000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex reviewed the participant Agenda map on 2026-11-22: the Vienna plan is not accurate, and the map took over too much of the TU Wien map's look, especially the room pin. He wants the data and the layout of the TU Wien map, in the style of this site. The first Vienna plan (TASK-461) was an own schematic that was not to scale. The real layout is in the planning repository MrLesk/codex-build-vienna (floor-plans/wegweiser-route-*.pdf, pictures of the TUW Maps ground floor with the signposted routes). The real building wings are not parallel to the picture's edges, so room areas need a rotation to follow their rooms.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The participant map uses this site's colors and typography in the light and the dark theme; the selected room is shown by its highlighted shape and its name, without a pin.
- [x] #2 A room area can be rotated, so it follows a room that is not parallel to the edges of the plan picture; an event admin sets the rotation in the floor plan editor.
- [x] #3 The map shows the names of its rooms at a readable size on a phone and on a desktop.
- [x] #4 The local Vienna preview shows the ground floor drawn from the TU Wien map picture, with the event rooms, the toilets and both entrances at their real places, and the route from the Karlsplatz main entrance to the Main room.
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
Model: a room area has a rotation in degrees (clockwise around its center, -180 to 180, default 0), so stored rooms without one stay upright. roomAreaStyle applies it on the participant map and in the builder; the floor plan editor has a Rotation field under Position on map, and a newly marked area is upright.
Participant map: the selected room is filled with the primary color and its name becomes a primary pill; the rose pin and the caption pin icon are gone. Room names are written on the map by the component (10px, 12px from a 28rem wide map), kept level when the area is turned, with an edge in the page color so they stay readable over walls and the route. The route uses primary with the page color as casing and is drawn below the names. The plan image is inverted with a hue turn in the dark theme, in the builder too. The card now takes the plan's width and sits next to the agenda instead of centering a narrow plan in a full-width card. Selected session card uses primary instead of sky.
Closest analog: the existing AccountEventProgramFloorPlan and AdminBuilderFloorPlan molecules were extended; no new component.
Vienna preview: one plan 'TU Wien · Ground floor', drawn from the TUW Maps pictures in MrLesk/codex-build-vienna (floor-plans/wegweiser-route-*.pdf) with a script outside the repository: overlays removed, both pictures merged, walls and rooms redrawn in the site's neutral colors, transparent outside, soft fade where the building goes on to the west, street names Karlsplatz, Karlsgasse, Paniglgasse. Rooms: Main entrance, Check-in (at the finish flag, behind the wing door in front of room 03), U1-1 to U1-7, Catering (the two small rooms between U1-2 and U1-3, as on the first map), WC, Main room, Paniglgasse entrance. Routes: Karlsplatz main entrance to the Main room past check-in, main entrance to check-in, Paniglgasse entrance to check-in.
Decision by Alex on 2026-11-22: one map only. A first attempt with two plans (way in, event rooms) and a centered narrow map was rejected ('who said I want different dropdowns and the map moved to the right').
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The participant map now follows this site's style and the Vienna preview shows the real TU Wien layout on one plan.

What changed
- Room areas can be turned (rotation in degrees, default 0), so they follow rooms that are not parallel to the picture. The floor plan editor has a Rotation field; the builder map shows the turned areas.
- Participant map: no pin. The selected room is filled with the primary color, the route uses primary, room names are written on the map in the site's font, and the dark theme inverts the plan picture. The map card takes the plan's width and sits next to the agenda.
- Vienna preview: one plan drawn from the TUW Maps pictures of the planning repository, in the site's neutral colors, with check-in at the finish flag in front of room 03 and routes from both entrances.

Validation: lint, typecheck, unit (738), integration (723) and the browser suite (126 + 1) pass. Checked by eye at 390 and 1440 px in both themes, including the builder editor.

Test gaps: the turned areas, the room names and the colors have no own automated test (plain markup and a schema field); the existing agenda scenarios cover selection, highlight and routes.

Risks and follow ups
- The catering spot (the two small rooms between U1-2 and U1-3) is taken from the first map and is not confirmed by the venue.
- The plan picture and its room list are made by a script outside the repository. Production needs the same picture and rooms uploaded in the builder.
- A plan image is always inverted in the dark theme. That suits drawn plans; a photo would look wrong.
<!-- SECTION:FINAL_SUMMARY:END -->
