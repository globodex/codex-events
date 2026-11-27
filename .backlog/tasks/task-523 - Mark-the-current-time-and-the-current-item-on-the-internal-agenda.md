---
id: TASK-523
title: Mark the current time and the current item on the internal agenda
status: Done
assignee:
  - '@claude'
created_date: '2026-11-27T15:51:00Z'
updated_date: '2026-11-27T16:01:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/domains/events/program-timeline.ts
  - app/components/events/molecules/EventAgendaPhaseLabel.vue
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/account/events/molecules/AccountEventProgramAgendaItem.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - app/components/public/events/EventAgendaPanel.vue
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/event-program.steps.ts
type: feature
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-27 Alex asked that every internal agenda (the Agenda tab of the event workspace, also in fullscreen and without a program) shows the current time and highlights the current item, without getting in the way of selecting an item to see its room. The public event page stays without it. The timeline already marked running program sessions and had a dot on the rail during the program; agenda blocks before and after the program were never marked, the dot showed no time, and the agenda without a program marked nothing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 From one hour before the first item until the last one ends, the timeline shows a green dot with the current time on its rail
- [x] #2 The running session or agenda block shows Now with the time left and a green card; the next one shows Next with the time until it starts; past items are dimmed
- [x] #3 The Agenda tab without a program marks the running and the next agenda block the same way
- [x] #4 Selecting an item still shows its room, and its selected look wins over the running look
- [x] #5 The public event page shows no current time
- [x] #6 Docs and browser tests cover the marks
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
One rule for the whole agenda: getAgendaPhases in app/domains/events/program-timeline.ts takes every item as a span in minutes after one shared start (sessions, and agenda blocks through getAgendaBlockSpans) and returns whether the agenda is live and each item's phase and line. The timeline and the agenda panel without a program both use it, and timelineCardClass and EventAgendaPhaseLabel give sessions and blocks the same look. EventAgendaPhaseLabel lives in components/events/molecules because the public agenda panel uses it too; that panel marks items only with showCurrentTime, which only the workspace sets. Closest analog for the label: the inline phase line of AccountEventProgramSession, which now uses it. Unit tests skipped for the helpers (cognitive score 5 or lower); the browser scenario covers a running block, the time on the rail and the next session.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The internal agenda shows the current time and the current item. From one hour before the first item until the last one ends, the timeline shows a green dot with the time on its rail; the running session or agenda block is green with the time left, the next one shows when it starts, and past ones are dimmed. Agenda blocks before and after the program are now marked like sessions (a block without an end counts as one hour, or until the next block). The Agenda tab without a program marks its blocks the same way; the public event page does not. Selection keeps its own look and still shows the room. Validation: lint, typecheck, unit (728), topology (26), full BDD (149 + 1, new steps for a running check-in, the time on the rail and the next session), and a browser check at a simulated event time at 1440 px dark and 390 px light, approved by Alex.
<!-- SECTION:FINAL_SUMMARY:END -->
