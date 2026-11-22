---
id: TASK-470
title: Merge the Details tab of the event workspace into Agenda and Overview
status: In Progress
assignee:
  - '@claude'
created_date: '2026-11-22T13:50:00Z'
updated_date: '2026-11-22T14:10:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - app/components/public/events/EventAgendaPanel.vue
  - app/components/public/events/EventTimeline.vue
  - app/domains/events/account-workspace-seo.ts
  - app/domains/events/account-workspace-tabs.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - server/application/operations/generated-output-schemas.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-shell.ts
  - server/domains/events/account-event-program-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/program.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/program.ts
  - stories/features/AccountEventProgramAgenda.stories.ts
  - stories/features/AccountEventProgramTimeline.stories.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/unit/app/domains/accounts/shell-navigation.test.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/server/domains/events/account-event-page-shell.test.ts
  - app/components/account/events/AccountEventAdminSettingsPanel.vue
  - tests/bdd/features/authenticated/account-event-workspace.feature
  - tests/bdd/steps/account-event-workspace.steps.ts
  - tests/bdd/support/platform-fixtures.ts
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex reviewed the participant event workspace on 2026-11-22: the Details tab repeats the Agenda tab and holds little of use (the registration window for people who are already registered, one attendance line, and the public agenda blocks). He approved removing the Details tab and splitting its content between Agenda and Overview. He added that the public agenda must stay a high-level overview of the day and must not show workshop details, but it should say more than today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The event workspace has no Details tab; links that pointed to it lead to the new place of their content.
- [ ] #2 Everyone who can open the event workspace can open the Agenda tab when the event has an agenda. Confirmed participants and event admins see the sessions with the map and the public agenda items outside the session block. Other people, and events without sessions, see the public agenda list without sessions.
- [ ] #3 Overview shows the event's location, the address when the person may see it, and the Discord and slides links. The registration window is not shown in the workspace.
- [ ] #4 Participants choose their track and read track resources on Overview.
- [ ] #5 Event admins edit the schedule, the location and the images on the Settings tab.
- [ ] #6 A public agenda item shows its text with line breaks, so an organizer can write a short outline of the day.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Tabs: the Details tab is removed from the shared tab list, the server tab rule and the app helpers. The Agenda tab now appears when the event has at least one public agenda block (hasAgenda), not only when a program exists.
Agenda page (GET /api/account/events/:slug/program): open to everyone who can open the workspace. Its page is { program }, where program is null for people who may not read it and for events without a program; canViewEventProgram is the one rule for event admins and confirmed participants. The page shows AccountEventProgramAgenda with the sessions, or the existing EventAgendaPanel with the public blocks.
Whole day: the timeline takes the public blocks before and after the program's block (outsideItems) and shows them as plain rows in the same grid; they have no room, so they cannot be selected. Blocks that start inside the program's time are covered by the sessions and are not shown.
Overview: the existing EventTimeline card with hideRegistrationWindow shows location, address and links; the existing AccountEventTracksPanel moved here with the anchor event-tracks. The prompts and the card that sent people to the Details tab are gone; the selected track notice links to the track list.
Settings: the existing admin panel in its details mode (schedule, location, images) is shown above the settings form, fed by the settings page. I first proposed the Agenda tab for it; Settings is the better owner because the panel also edits location and images, and it needs no extra data on the Agenda tab.
Public agenda: EventAgendaPanel keeps the line breaks of a block's text. No session is published. The preview's Build Time block got a six-line outline of the day.
Closest analogs reused: EventTimeline, EventAgendaPanel, AccountEventTracksPanel, AccountEventAdminSettingsPanel. No new component.
Alex's idea of one page that transforms (2026-11-22) was withdrawn by him in the same hour: he had looked at the public page by mistake.
<!-- SECTION:NOTES:END -->
