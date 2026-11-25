---
id: TASK-506
title: Let agenda blocks name a room on the floor plan
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T21:28:00Z'
updated_date: '2026-11-25T21:55:00Z'
labels: []
milestone: m-3
dependencies:
  - TASK-505
modified_files:
  - shared/domains/events/program.ts
  - drizzle/0092_agenda_item_rooms.sql
  - server/database/schema.ts
  - server/domains/events/floor-plans.ts
  - server/domains/events/program.ts
  - server/application/operations/generated-output-schemas.ts
  - app/domains/events/program-map.ts
  - app/domains/events/program-timeline.ts
  - app/components/admin/builder/molecules/AdminBuilderRoomSelect.vue
  - app/components/admin/builder/molecules/AdminBuilderProgramSession.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramTrack.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramEditor.vue
  - app/components/account/events/molecules/AccountEventProgramAgendaItem.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/event-program.steps.ts
  - tests/bdd/steps/check-in-flow.steps.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - stories/features/AccountEventProgramTimeline.stories.ts
  - stories/features/AdminBuilderProgramEditor.stories.ts
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
  - docs/lifecycle-and-state-machines.md
type: feature
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 the Vienna Build Day agenda was split into public blocks (check-in, kickoff, build time, demo walk, networking). Only program sessions have rooms, so "Doors open and check-in" lost its room and the arrows to check-in on the Agenda map. Alex chose to let an agenda block name a room, so tapping it shows the room and its routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An organizer can give an agenda block a room from the event floor plans in the builder, or none
- [x] #2 The server refuses a block room that is not on one of the event floor plans
- [x] #3 Only people who read the program (event admins and confirmed participants) receive the rooms of blocks; public payloads never contain them
- [x] #4 On the Agenda tab, a block with a room shows the room name and can be tapped to show the room and its routes on the map
- [x] #5 Docs and tests cover block rooms and their privacy
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
1. Store the rooms of agenda blocks with the private program: event_agenda_programs.agenda_item_rooms_json (migration 0092), agendaItemRooms in the program schema, at most one room per block.
2. Check block rooms like session rooms: they must exist on a floor plan of the event, and a floor plan cannot drop a room that a block names.
3. Send agendaItemRooms only in the admin program and the participant program, never on agenda items, which reach public, applicant and judge payloads.
4. Agenda tab: a block with a room shows its room and can be selected like a session; "How to get there" also considers blocks with a room.
5. Builder: a room select for each agenda block outside the program, shared with the session room selects.
6. Docs, integration and browser tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Block rooms live in the program record, not on agenda items: serializeEvent sends agenda items to judges, applicants and the event shell, while the program reaches only event admins and confirmed participants. A block id that names no outside block has no effect, like a room challengeId.

New components and their closest analogs:
- AccountEventProgramAgendaItem: closest analog AccountEventProgramSession. A session card shows a duration, a live phase and a details dialog; an agenda block shows a time range that can be missing, has no phase and keeps its details inline, so the session card cannot express it through props. The block markup moved out of the timeline organism into this molecule.
- AdminBuilderRoomSelect: extracted from the two room selects of AdminBuilderProgramSession, so sessions and agenda blocks use one room select. programRoomOptions in app/domains/events/program-map.ts replaces the options list that AdminBuilderProgramTrack built.

"How to get there" links to session=first. Since the Vienna agenda split moved check-in out of the program, first now picks the earliest session or agenda block with a room, which restores the way to check-in.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A program can name the room of each public agenda block outside it (`agendaItemRooms`, stored in `event_agenda_programs.agenda_item_rooms_json` by migration 0092). The rooms stay with the private program, so public, applicant, staff and judge payloads never contain them. The server refuses a block room that is not on a floor plan of the event and keeps a floor plan from dropping a room that a block names. On the Agenda tab a block with a room shows its room and can be selected like a session, which shows the room and its routes on the map. "How to get there" now selects the earliest session or block with a room, so it shows the way to check-in again. The builder has a room select for each block before and after the program; sessions and blocks share the new AdminBuilderRoomSelect.

Verification: lint, typecheck, 724 unit, 783 integration and 147 browser tests pass. The program API test covers storage, the participant answer, the public answer without rooms, the unknown room and the room in use. The browser scenario selects the check-in block and sees both routes, and checks the saved block room in the builder. Checked in a real browser at 1440 px and 390 px in light and dark mode, including the builder section and "How to get there".

Follow-up for Vienna after release: name the rooms of the check-in and kickoff blocks.
<!-- SECTION:FINAL_SUMMARY:END -->
