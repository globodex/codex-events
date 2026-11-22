---
id: TASK-480
title: Choose for each session whether the public event page lists it
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T21:51:00Z'
updated_date: '2026-11-22T22:15:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - shared/domains/events/program.ts
  - app/components/public/events/EventAgendaPanel.vue
modified_files:
  - shared/domains/events/program.ts
  - server/domains/events/program.ts
  - server/domains/events/account-event-program-page.ts
  - server/api/public/events/[slug]/index.get.ts
  - server/application/operations/generated-output-schemas.ts
  - app/domains/events/presentation.ts
  - app/components/public/events/EventAgendaPanel.vue
  - app/components/admin/builder/molecules/AdminBuilderProgramSession.vue
  - app/pages/events/[slug]/index.vue
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/api-surface.md
  - docs/permissions-matrix.md
  - docs/tech-stack.md
  - docs/testing-strategy.md
  - stories/public-events/EventAgendaPanel.stories.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/integration/server/mcp/mcp-protocol.test.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/public/public-agenda-sessions.feature
  - tests/bdd/steps/public-agenda-sessions.steps.ts
type: feature
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
An event with a program has two agendas today: the public agenda block with a hand-typed text, and the sessions that only confirmed participants see. Alex wrote on 2026-11-22: 'we shouldn't have 2 agendas. We should just choose what to show on the public event page'. He chose a switch per session (question of 2026-11-22): the public page lists the chosen sessions with time and title inside their block; rooms, details, the map and the version after check-in stay for participants.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the event builder an organizer can mark each session as shown on the public event page. A session is not public until it is marked.
- [x] #2 The public event page lists the public sessions under their agenda block in the order of their start, each with its start time and its title.
- [x] #3 A public session never shows its room, its details or its version for checked-in participants.
- [x] #4 A person who opens the event workspace without reading the program sees the same public sessions on the Agenda tab.
- [x] #5 Saving or deleting the program rotates the public content revision of the event.
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
1. Model: a session can store isPublic. A new shared shape, the public sessions, holds the block id and the public sessions with id, title and start time.
2. Server: loadPublicProgramSessions builds that list. The public event detail carries it as publicSessions. The Agenda page carries it for a caller who does not get the program. Saving and deleting the program rotate the public content revision.
3. App: the public agenda panel lists the sessions under their block. The session editor of the builder gets the checkbox 'Show on the public event page'.
4. Docs, server and browser tests, story, browser check, validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: programSessionSchema has the optional boolean isPublic. A session without it is not public, so stored programs stay as they are.

Server: loadPublicProgramSessions (server/domains/events/program.ts) returns the block id and the public sessions in the order of their start, each with id, title and startsAt, or null. It never returns a room, details or the version after check-in. The public event detail returns it as publicSessions. The Agenda page returns it as page.publicSessions for a caller who does not get the program, and null for a caller who gets it. saveAdminEventProgram and deleteAdminEventProgram write the program and rotate events.public_content_revision in one D1 batch.

App: EventAgendaPanel.vue takes the optional prop publicSessions and lists the sessions below the title and description of their block, with the time format of the block. The public event page and the Agenda tab of a person without the program pass it. AdminBuilderProgramSession.vue has the checkbox 'Show on the public event page' above 'Changes after check-in'. No new component.

Decisions:
- The description of an agenda block stays a field of every block. A block with a description and public sessions shows the description first and the sessions below. The option that Alex chose said that the hand-typed text of the block is removed; I removed that text from the demo event and did not hide the field. This is my reading and Alex was told.
- People who read the program get every session with its isPublic mark. Nothing in the participant view uses it.
- The revision also rotates when a save finds a changed agenda and writes nothing. That only makes public caches read the unchanged event once more.

Local preview: the six sessions at 09:30, 10:00, 10:40, 12:30, 13:15 and 16:15 are public, and the text of the 'Build Time' block is removed.

Browser check, 2026-11-22: in the builder six checkboxes were ticked and saved (PUT 200); after a reload the marks were still set. The public page lists the six sessions with their times under 'Build Time' at 1440x900 dark and light and 390x844 light and dark, without sideways overflow and without page errors. The Agenda tab of the workspace lists the same six sessions when the server answer holds no program (answer changed in the browser, nothing saved); the real answer for the confirmed participant holds the program and publicSessions null.

Validation, 2026-11-22: lint and typecheck passed, 768 integration tests, 135 + 1 browser tests, git diff --check clean. Unit tests: in the chain one test of tests/unit/server/domains/mcp/macro-tools.test.ts ran into its 5 second limit while other processes used the machine; alone it passes in 0.6 seconds, and a second full run passed with 723 tests. The chain ran while another agent's refactor (TASK-481) was in the working tree; that work is committed as 32abc39c.

Found on the way, not changed: ESLint skips app/components/public/** and server/api/public/** because of an ignore pattern for folders named public. Both changed files there pass eslint with --no-ignore.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An organizer chooses for each session whether the public event page shows it. The session editor in the event builder has the checkbox 'Show on the public event page'. The public page lists the chosen sessions under their agenda block with start time and title; rooms, details, floor plans and the version after check-in stay for people who read the program. A person who opens the workspace without reading the program sees the same list on the Agenda tab.

The public event detail and the Agenda page carry the list as publicSessions. Program writes rotate the public content revision.

Checked: server tests for the public detail, the Agenda page of a pending participant, event staff and a confirmed participant, private fields, and the revision; one browser scenario for the public page; the builder and both pages by hand in the preview.

No setup change. Permissions: only event admins and platform admins change the program, as before. Public visitors get the title and start time of public sessions only.

Risks and follow-ups: the description of a block is still a free text, so an organizer can still type a second list there. No automated browser test ticks the checkbox in the builder. ESLint skips files under folders named public; this is older than this task and worth a look.
<!-- SECTION:FINAL_SUMMARY:END -->
