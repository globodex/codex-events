---
id: TASK-487
title: Rebuild the event builder as five levels with one score and extras as tiles
status: Done
assignee:
  - '@claude'
created_date: '2026-11-23T19:15:00Z'
updated_date: '2026-11-24T19:05:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/admin/builder/AdminBuilderWorkspace.vue
  - app/domains/events/builder.ts
modified_files:
  - app/components/AppMeter.vue
  - app/components/account/events/AccountEventAdminTermsCard.vue
  - app/components/admin/EventConfigProgramIdentitySection.vue
  - app/components/admin/builder/AdminBuilderWorkspace.vue
  - app/components/admin/builder/molecules/AdminBuilderBlockCard.vue
  - app/components/admin/builder/molecules/AdminBuilderMeterRow.vue
  - app/components/admin/builder/organisms/AdminBuilderAgendaTrack.vue
  - app/components/admin/builder/organisms/AdminBuilderBlockPalette.vue
  - app/components/admin/builder/organisms/AdminBuilderProgramEditor.vue
  - app/components/admin/builder/organisms/AdminBuilderTemplateGallery.vue
  - app/composables/useEventBuilder.ts
  - app/domains/events/builder.ts
  - app/pages/admin/events/builder/[eventId].vue
  - app/pages/admin/events/builder/new.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/testing-strategy.md
  - server/api/events/[eventId]/index.patch.ts
  - server/application/operations/generated-output-schemas.ts
  - server/domains/events/account-event-settings-page.ts
  - server/domains/events/program.ts
  - shared/domains/events/account-event-settings-page.ts
  - shared/domains/events/program.ts
  - stories/features/AdminBuilderProgramEditor.stories.ts
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/challenges.steps.ts
  - tests/bdd/steps/check-in-flow.steps.ts
  - tests/bdd/steps/event-builder.steps.ts
  - tests/bdd/steps/event-program.steps.ts
  - tests/bdd/steps/luma-guest-list.steps.ts
  - tests/bdd/steps/participant-photos.steps.ts
  - tests/bdd/steps/simplified-claiming.steps.ts
  - tests/integration/server/api/account-event-settings-page.test.ts
  - tests/unit/app/composables/account-event-parent-page-topology.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - app/components/admin/builder/molecules/AdminBuilderExtraPanel.vue
  - app/components/admin/builder/molecules/AdminBuilderStepChip.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
  - app/components/admin/builder/organisms/AdminBuilderScorePanel.vue
  - app/components/admin/builder/organisms/AdminBuilderWhenWhereForm.vue
  - stories/features/AdminBuilderExtrasBoard.stories.ts
  - app/components/admin/builder/molecules/AdminBuilderExtraTile.vue
  - app/components/admin/builder/molecules/AdminBuilderLevelBar.vue
  - app/components/admin/builder/molecules/AdminBuilderLevelNav.vue
  - app/components/admin/builder/organisms/AdminBuilderEventForm.vue
  - app/components/admin/builder/organisms/AdminBuilderRegistrationForm.vue
  - tests/bdd/support/event-builder.ts
type: enhancement
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The event builder is one page: the demo event is about 9,900 px tall on a desktop, with 13 open sections, a checklist and two score cards ("Event health" and "Event balance"). Alex asked on 2026-11-23 for a proper restyling: ambassadors worldwide create events without instructions, so the builder must be as simple as a videogame, with few labels and no tutorials. He approved a drawing with five levels (event, when and where, agenda, sign-up, extras), one score ring with four small bars and one tip, and extras as tiles that show their state. The options that only the old editor has (prizes, judging criteria, exact times, hide event, Luma webhook status, track reordering) are the open part of TASK-442 and are not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The builder shows one level at a time: event, when and where, agenda, sign-up, extras. A level bar shows the current level and which levels are complete, and the organizer can open any level from it.
- [x] #2 The level bar replaces the checklist. A level that still needs something names its open steps, and a step takes the organizer to its field.
- [x] #3 Saving an event that still has open steps opens the level of the first open step instead of doing nothing.
- [x] #4 The agenda level shows one score: a ring, four small bars for energy, focus, variety and return, and at most one tip.
- [x] #5 Every other option of the builder is a tile on the extras level. A tile shows the state of its option, opens only that option, and is not shown for an event type it does not fit.
- [x] #6 Every option the builder had before stays available, including rooms and sessions, credits, Luma, terms and images.
- [x] #7 The levels have no heading with a line of text below it and no line that explains how to use the builder. The editors inside the extras keep their own texts.
- [x] #8 The builder works on a phone width and a desktop width, in the light and the dark theme.
- [x] #9 Unit tests, browser tests and the canonical docs describe the new builder.
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
1. Rules (app/domains/events/builder.ts): add the five levels; give every checklist step its level (and its extra); replace the settings groups with extras definitions that return the state a tile shows.
2. New parts: level bar, open-step chips, score panel (ring, four bars, one tip), sign-up form, extras board with tiles and one open option, bottom bar with Back, Next and Save.
3. Workspace: one level at a time; a level is mounted on its first visit and then kept, so nothing typed is lost when the organizer changes level; Save with open steps opens the first open step.
4. Edit page: the parallel agenda editor becomes the extra "Rooms and sessions" and still loads only when it is opened.
5. Settings page contract: add the number of sessions, so the tile can show it before the editor loads.
6. Remove the checklist card, the two score cards, the side panel and the settings board; update stories.
7. Update unit tests, browser test steps and docs; run lint, typecheck, unit, integration and browser tests; check two widths and both themes in the browser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-23.

Levels: the builder shows one level at a time (Event, When and where, Agenda, Registration, Extras). The rules are in app/domains/events/builder.ts: eventBuilderLevels, a level and an optional extra on every checklist step, and getEventBuilderLevelBarItems for the state of each level in the bar (done, open, ahead). A level is mounted on its first visit and then only hidden, so nothing typed or opened is lost on a level change. The fourth level is named "Registration", the word its fields already use, not "Sign-up" as in the drawing.

Open steps: the steps of the current level that are not complete appear as chips next to the level bar and lead to their field. Saving with an open step sends nothing, opens the level (and the extra) of the first open step and shows the messages below the fields.

Score: AdminBuilderScorePanel replaces the checklist card, the two score cards, the two curves and the tips list: one ring with band and total duration, four bars, at most one tip.

Extras: the settings groups became extras (getEventBuilderExtras). Each definition returns the state its tile shows. An open extra replaces the tiles and has an arrow back; it is mounted on first open and kept. The after-check-in group became the two extras Check-in and Photos. Application form, capacity and team size moved to the Registration level.

Rooms and sessions: the "Parallel agenda" disclosure of the edit page became the extra "Rooms and sessions"; its editor still loads only when it is opened. The settings page now carries builder.programSessionCount, so the tile shows the number before the editor loads.

Save bar: one bar at the bottom for all widths with Back, Next and the save button. It is hidden while an extra with its own save button is open (rooms and sessions, terms), because "Save event" would not save what is typed there.

New components and their closest analogs: AdminBuilderLevelBar (closest: AdminBuilderEventTypePicker, a row of radio buttons; it cannot show a state per step and a current step). AdminBuilderExtraTile (closest: AdminBuilderChoiceCard, a radio or checkbox card with a description; a tile is a button that opens something and shows an icon and a state). AdminBuilderLevelNav (closest: the phone-only strip that was inline in the workspace; now one bar for all widths with Back and Next). AdminBuilderEventForm and AdminBuilderRegistrationForm hold what was inline in the basics form and in the settings board, one organism per level. Renamed with a new role: SettingsGroupCard to ExtraPanel, ChecklistRow to StepChip, SidePanel to ScorePanel, SettingsBoard to ExtrasBoard, BasicsForm to WhenWhereForm.

Also changed: AppMeter takes a name for screen readers; the images section and the terms card show no heading of their own inside the builder; an agenda row uses two lines on a phone, where its delete button was outside the window before.

2026-11-24, on Alex's feedback after TASK-490: the open-step chips next to the level bar are gone (criterion #2 described them). Alex chose a note next to the save button instead: after a save that did not happen, one line above the buttons names every open step ("Before saving: ..."), it gets shorter while the organizer fills in what is missing, and the builder still opens the field of the first open step. The bottom bar lost its card (border, round corners, shadow, blur); it stays sticky with the page color behind the buttons so content scrolls under it. AdminBuilderStepChip is removed. Browser steps now read the note (event-builder-missing-steps) instead of the chips.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event builder now shows one level at a time (Event, When and where, Agenda, Registration, Extras) instead of one page of about 9,900 px. A level bar opens any level and shows which levels are done. A level that needs something names its open steps; saving with an open step sends nothing and opens the first open step. The Agenda level has one score (ring, band, total duration, four bars, at most one tip). Every optional part of an event is a tile on the Extras level that shows its state and opens that part alone. The edit page still loads the rooms and sessions only when that extra is opened; the settings page carries the number of sessions for the tile.

Removed on purpose: the checklist card, the cards "Event health" and "Event balance", the two curves per agenda block next to the score (the template preview keeps them), the list of all tips (one at a time now), the "Audience voting, coming soon" card, the lines below headings and the "how to" lines of the levels. The fourth level is named "Registration", not "Sign-up" as in the drawing, because its fields already use that word.

Checks on 2026-11-23: lint and type check pass; 717 unit tests, 770 integration tests and 142 browser tests pass (two of the new browser assertions were wrong at first and were corrected). Checked in a real browser at 1440 px and 390 px, in the light and the dark theme: every level, every extra, a new event from the first level to the extras, and saving with open steps. No console error and no Vue warning.

Risks and follow-ups: (1) Rooms and sessions, terms, images and credits still save with their own actions, not with "Save event". The save bar is hidden while rooms and sessions or terms are open, so the organizer cannot mistake it; one save for everything is not built. (2) The options that only the old editor has (prizes, judging criteria, exact start and end times, hide event, Luma webhook status, track reordering) are not part of this task; they are the open part of TASK-442. (3) The editors inside the extras (credits, images, terms) keep their own headings and lines.
<!-- SECTION:FINAL_SUMMARY:END -->
