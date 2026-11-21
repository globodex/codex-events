---
id: TASK-461
title: Redesign the participant agenda and map with a route to the room
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T22:30:00Z'
updated_date: '2026-11-21T23:19:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-446
references:
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
  - https://maps.tuwien.ac.at/?q=AEU141
  - >-
    https://github.com/MrLesk/codex-build-vienna/blob/main/07-rooms-tu-wien-karlsplatz.md
modified_files:
  - shared/domains/events/program.ts
  - app/domains/events/program-map.ts
  - app/components/account/events/AccountEventProgramFloorPlan.vue
  - app/domains/events/program-timeline.ts
  - app/components/account/events/AccountEventProgramSession.vue
  - app/components/account/events/AccountEventProgramTimeline.vue
  - app/components/account/events/AccountEventProgramAgenda.vue
  - server/application/operations/generated-output-schemas.ts
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanMap.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
  - tests/integration/server/api/event-program-routes.test.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - stories/features/AccountEventProgramFloorPlan.stories.ts
  - stories/features/AccountEventProgramTimeline.stories.ts
  - tests/bdd/steps/event-program.steps.ts
  - tests/bdd/features/authenticated/event-program.feature
type: enhancement
ordinal: 177000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants arriving at Vienna Build Day need to find the Main room from the Karlsplatz main entrance. The Agenda tab lists sessions as plain cards and shows no way to a room, and the floor plan does not look like the venue map people know from TU Wien. Alex asked for a livelier agenda, a map closer to maps.tuwien.ac.at, and arrows from the entrance to the room when a participant selects the first agenda item.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Agenda tab shows sessions on a vertical time line for single and parallel tracks, and longer sessions are taller.
- [x] #2 While the program is running, the session in progress shows the time left, the next session shows when it starts, and finished sessions are de-emphasized.
- [x] #3 Selecting a session shows its details with the session. On phones, selecting a session with a room moves to the map.
- [x] #4 An event admin can draw, change and remove a route to a room on its floor plan in the event builder.
- [x] #5 Selecting a room with a route, or a session held in it, shows the route on the map with a start marker, direction arrows and a pin on the room. A room without a route shows the pin and highlight only.
- [x] #6 Rooms stay selectable by tap, click and keyboard, and the map stays in view beside the agenda on larger screens.
- [x] #7 The local Vienna Build Day preview shows a ground-floor plan in the style of the TU Wien campus map, with the route from the Karlsplatz main entrance to the Main room when a participant selects the first agenda item.
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
1. Add an optional route (ordered points) to a floor plan room in the shared program contract and update the canonical docs.
2. Redesign the participant timeline: time rail, duration-based height, details with the session, live now and next state.
3. Restyle the participant map: pin and highlight on the selected room, route with start marker and arrows, map stays in view on larger screens.
4. Add route drawing to the floor plan editor in the event builder.
5. Update stories, browser and integration tests, and generated operation schemas.
6. Draw the Vienna ground-floor plan in the TU Wien style and load it, with the entrance route, into the local preview.
7. Run lint, typecheck, unit, integration and browser checks, and verify at two widths in both themes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closest analogs reused: the existing program components (AccountEventProgramAgenda, Timeline, Session, FloorPlan) were redesigned in place, and the builder floor plan editor and map got the route tool. No new component was created. AppButton, AppSelect, AppIcon and the countdown formatter are reused.

A route belongs to a room: an optional list of 2 to 40 points on the floor plan image, stored with the room in rooms_json, so no migration is needed. The participant map draws the route in screen pixels, so the line and arrows keep the same size at every width.

The timeline now uses one grid for single and parallel tracks. Session details moved into the session card, and the side panel holds only the map, which stays in view on larger screens. This replaces the earlier rule that the agenda column matches the plan height.

The live state appears from one hour before the program starts until it ends. Outside that window all sessions look the same.

Vienna preview: the plan is an own schematic of the TU Wien main building ground floor, not to scale, drawn from the room order on the public TU Wien map and the planning repository. TU Wien map data is not copied because their API requires credentials. The preview now runs from the main checkout through .claude/launch.json with a copy of the demo data in .wrangler/demo-Hdc7do.

After Alex reviewed the first version: the Vienna plan was redrawn with north on top and a taller shape, and labels were removed from rooms outside the event except the WC. On larger screens a tall plan now gets narrower so the whole plan fits on the screen, and selecting a session with a room scrolls just enough to show the whole map. Final checks on this code: lint, type checking, 725 unit tests, 510 integration tests and 106 browser scenarios pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Agenda tab now shows sessions on a time line with a rail, duration-based height and details inside the selected session. While the program runs, the running session shows the time left, the next session shows when it starts, and finished sessions fade. The map marks the selected room with a pin and a highlight, stays in view on larger screens, and shows a route with a start marker and direction arrows when the room has one. Event admins draw, undo and remove a route in the floor plan editor, or enter its points as percentages. A route is an optional list of 2 to 40 points stored with the room, so there is no migration.

Verified with lint, type checking, 725 unit tests, 510 integration tests, 106 browser scenarios including a new route and live-state scenario, the Storybook build, and screenshots at 1440 and 390 pixels in both themes. The look of the pin, the arrows and the time line is checked by screenshots only.

The local Vienna preview shows an own ground-floor schematic in the TU Wien style with the route from the Karlsplatz main entrance to the Main room. The plan is not to scale. Its room layout, entrance and check-in spot must be confirmed with the venue under TASK-454 before the event uses it. The four program components still sit outside the molecules and organisms folders. The change is not committed yet and waits for review by Alex.
<!-- SECTION:FINAL_SUMMARY:END -->
