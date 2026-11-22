---
id: TASK-473
title: Show a second agenda title and room to checked-in participants
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T19:29:00Z'
updated_date: '2026-11-22T19:58:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - shared/domains/events/program.ts
  - server/domains/events/program.ts
modified_files:
  - shared/domains/events/program.ts
  - server/domains/events/program.ts
  - server/domains/events/floor-plans.ts
  - server/domains/events/account-event-program-page.ts
  - app/pages/account/events/[slug]/index.vue
  - app/components/admin/builder/molecules/AdminBuilderProgramSession.vue
  - tests/integration/server/api/event-program-routes.test.ts
  - server/application/operations/generated-output-schemas.ts
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
type: feature
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
At the Vienna Build Day the first agenda item sends an arriving participant to check-in. Once the participant is checked in, that item has no use for them: they should then read where breakfast is. Alex asked on 2026-11-22 that the item flips to Breakfast in room U1-3 after check-in, and approved a per-session setting in the event builder: a checkbox 'Changes after check-in' with a second title and a second room.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the event builder an organizer can give a session a second title and a second room for participants who are checked in, and can remove them again.
- [x] #2 On the Agenda tab a checked-in participant sees the second title and room of such a session. Every other person sees the first title and room.
- [x] #3 After check-in the participant sees the second version once they reload the page or use the reload of the next-step card.
- [x] #4 The second room follows the rules of a session room: it must exist on a floor plan of the event, and it cannot be removed from the plan while a session names it.
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
1. Model: an optional afterCheckIn object (title, room) on a program session in shared/domains/events/program.ts.
2. Server: the participant Agenda page resolves each session for the caller: a checked-in participant gets the second title and room without the details of the first version, everyone else the first version. The answer never carries afterCheckIn. The room checks on program save and floor plan update read both rooms of a session through one shared SQL fragment.
3. Page: the reload after a check-in step also reads the Agenda page again.
4. Builder: checkbox 'Changes after check-in' in the session editor with 'Title after check-in' and 'Room after check-in'.
5. Docs, integration tests, generated MCP schemas, preview data (Doors open and check-in -> Breakfast in U1-3), browser check, full validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: a session can carry afterCheckIn with a title and an optional room. The second version has no details of its own, so a checked-in participant sees no Details button on it.

Server: showTracksTo in server/domains/events/program.ts resolves every session for the caller. The Agenda page route passes isCheckedIn from the caller's registration (effective attendance, so an attendance override counts). An event admin reads the first version. The response never holds afterCheckIn; the admin program route returns it for the builder.

Room rules: sessionRoomJoins in server/domains/events/floor-plans.ts lists both rooms of every session. The program save check and the floor plan update check both read through it, so a second room must exist and cannot be removed while a session names it.

Page: the reload after a check-in step (button 'I have checked in' on the next-step card, and sending the questionnaire) now also reads the Agenda page again.

Builder: every session has the checkbox 'Changes after check-in'. Ticking it shows 'Title after check-in' and 'Room after check-in'; the second version starts with an empty title and the session's room. An empty title stops the save with 'Enter the title after check-in.'

Local preview: the session 'Doors open and check-in' has the second version 'Breakfast' in U1-3. Browser walk-through at 1440x900 (script shoot-473-flip.mjs in the session scratchpad): before check-in the first item reads 'Doors open and check-in, Check-in' and shows the route; after a staff check-in and a click on 'I have checked in' the Agenda tab reads 'Breakfast, U1-3' without a new page load, and selecting it highlights U1-3.

Test gap: no browser scenario covers the second version or the new builder inputs. The server behavior is covered by the integration test 'shows the second title and room of a session to a participant who is checked in'; the page reload and the builder inputs were checked by hand in the local preview.

Validation on the final working tree (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 727 tests passed; bun run test:integration 52 files, 765 tests passed; bun run test:bdd 126 passed plus 1 destructive passed; bun run mcp:generate-output-schemas was run after the model change; git diff --check clean. codehygiene on the changed .ts files flags only zod chains, the style of the repository.

Builder check without saving (script check-473-builder-toggle.mjs in the session scratchpad): 11 sessions, one with a second version. Ticking 'Changes after check-in' on another session shows the two inputs with an empty title and the session's room; the browser does not submit the form while the title is empty; unticking removes the inputs. No request wrote data.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A session can now have a second title and room for participants who are checked in. Organizers set it in the event builder with the checkbox 'Changes after check-in'. The Agenda page resolves every session on the server for the caller: a participant with effective attendance gets the second title and room without details, everyone else the first version, and the response never carries the setting. Both rooms of a session follow the room rules through one shared SQL fragment. The reload after a check-in step reads the Agenda page again, so the item changes without a new page load. In the local preview 'Doors open and check-in' becomes 'Breakfast' in U1-3. Checks: lint, typecheck, 727 unit, 765 integration, 126 + 1 browser tests, and a browser walk-through of the check-in. Risks and follow-ups: the Agenda tab changes only after a reload or the next-step reload, not by itself; no browser scenario covers the second version; the production event needs the setting entered in the builder.
<!-- SECTION:FINAL_SUMMARY:END -->
