---
id: TASK-505
title: Let a room on the floor plan have several routes
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T21:28:00Z'
updated_date: '2026-11-25T21:55:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - shared/domains/events/program.ts
  - drizzle/0091_room_routes.sql
  - tests/integration/server/database/migration.test.ts
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue
  - app/components/admin/builder/molecules/AdminBuilderFloorPlanMap.vue
  - server/application/operations/generated-output-schemas.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/event-program.steps.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - docs/domain-model.md
  - docs/schema-outline.md
type: feature
ordinal: 222000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex asked that the Agenda map shows the way to check-in from both entrances of the Vienna Build Day venue (TU Wien: the main entrance and the Paniglgasse entrance). A room on a floor plan has at most one route today, a list of points from a starting point to the room.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A room can have up to 4 routes, each with 2 to 40 points on the plan
- [x] #2 Existing rooms keep their route as their only route, through a data migration
- [x] #3 The Agenda map draws every route of the selected room with its arrows and starting point
- [x] #4 In the builder, an organizer can draw another route for a room, choose which route to edit, and remove one route
- [x] #5 Docs and tests cover several routes and the migration
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
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. shared/domains/events/program.ts: route becomes routes (1 to 4 routes of 2 to 40 points).
2. drizzle/0091_room_routes.sql: every room with a route gets routes = [route] in event_floor_plans.rooms_json, with a migration test.
3. AccountEventProgramFloorPlan.vue draws all routes of the selected room.
4. AdminBuilderFloorPlanEditor.vue and AdminBuilderFloorPlanMap.vue: draw, choose and remove routes of the active room.
5. Docs (domain-model, schema-outline, api-surface), unit, integration and browser tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rooms keep their routes in event_floor_plans.rooms_json. Migration 0091 turns each room route into routes with that one route. The builder keeps routes as a list per room while editing: Route N buttons choose the route that Draw route, Undo point, Remove route and the point fields change, and Add route starts another route at once. The builder map draws the other routes of the room lighter. The Agenda map draws every route of the selected room in one image named "Routes to <room>" when there are several.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A room on a floor plan can have up to 4 routes of 2 to 40 points (`routes` in `rooms_json`). Migration 0091 keeps each existing route as the only route of its room. The Agenda map draws every route of the selected room with arrows and a start point, in one image named "Routes to <room>" when there are several. In the builder, Route N buttons choose the route that Draw route, Undo point, Remove route and the point fields change; Add route starts another one, and the map draws the other routes lighter.

Verification: lint, typecheck, 724 unit, 783 integration and 147 browser tests pass. The migration test checks the conversion; the program API test stores two routes and refuses a one-point route and five routes; the browser scenario draws two routes in the builder and sees both on the Agenda map. Checked in a real browser at 1440 px and 390 px in light and dark mode, and removing route 2 in the builder leaves route 1.

Follow-up for Vienna after release: the Check-in room should get the route from the Paniglgasse entrance as its second route. On the live plan that route is drawn on the "Paniglgasse entrance" room.
<!-- SECTION:FINAL_SUMMARY:END -->
