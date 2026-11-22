---
id: TASK-486
title: Say each event fact once on the public page and in the workspace
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T23:10:00Z'
updated_date: '2026-11-22T23:18:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/pages/events/[slug]/index.vue
  - app/components/public/events/EventTimeline.vue
modified_files:
  - app/components/public/events/EventDetailsCard.vue
  - app/components/public/events/EventOverviewSection.vue
  - app/domains/events/presentation.ts
  - app/pages/account/events/[slug]/index.vue
  - app/pages/events/[slug]/index.vue
  - app/components/AppMeter.vue
  - docs/domain-model.md
  - stories/public-events/EventDetailsCard.stories.ts
type: enhancement
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The public event page says when registration closes three times (state badge, a card with a progress bar, a note below it) and names the place twice (header line, 'Event Details' card). The workspace Overview repeats the city and the attendance in its 'Event Details'. Alex asked on 2026-11-22 to find more simplifications in the patterns of this session (one place for each piece of information, fewer blocks) and to build them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The header line of the public event page names the next registration deadline while registration is the current state of the event, and the page has no registration window card.
- [x] #2 The public event page has no event details card. When the event has a Luma link, the header line offers it.
- [x] #3 The Overview tab of the workspace shows the address with its map link and the links of the event, and no longer repeats the city, the team size, or that an in-person event takes place in person.
- [x] #4 An online event still says in the workspace that no in-person attendance is required.
- [x] #5 The Overview tab offers withdrawal as one quiet button. Its confirmation names the consequence, and a person who cannot withdraw reads the reason below the button.
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
Public event page: the header line now ends with the next registration deadline (describeRegistrationDeadline in app/domains/events/presentation.ts) while the state of the event is registration_open, and with a 'Luma event' link when the event has one. The 'Registration Window' card and the 'Event Details' card are gone from the page. The header line already named the date, the start time, the place and the team size.

Workspace Overview: EventTimeline.vue became EventDetailsCard.vue. It shows the address with its map link for people who may see it, 'No in-person attendance required' for an online event, and the links of the event (Luma, Discord, slides). It no longer shows the city, the attendance of an in-person event, the team size or a heading. It is not rendered without a row. Closest analog and reason for the rename: the same component, which no longer shows a timeline.

Withdraw: the block with a title, a sentence and a button is one quiet button 'Withdraw from this event'. The confirmation that already existed names the consequence. The reason why a person cannot withdraw stays below the button.

Removed because nothing uses them any more: getEventWindowProgress, getEventDateTimePresentation, the type PublicDateTimePresentation, and the export of describeEventWindowStatus (the state badge still uses it inside the file).

Browser check on the local preview, 2026-11-23 (1440x900 dark, 390x844 light): the public page shows 'Sat, Nov 28, 2026 · 09:30 AM · Vienna, Austria · Registration closes Nov 28', the description and the agenda, with no other card; the Overview shows the address row with a map link and the withdraw button. No sideways overflow, no page errors.

Not checked by hand: the Luma link in the header and an online event (the demo event has neither), and the header before registration opens and after it closes. The story 'Online' shows the card of an online event.

Validation, 2026-11-23: lint and typecheck passed, 716 unit tests, 142 + 1 browser tests, git diff --check clean. No server code changed, so the integration suite was not run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The public event page says each fact once: its header line carries the date, time, place, team size and now the next registration deadline and the Luma link; the two cards that repeated this are gone. In the workspace the details card shows only the address and the event's links, and withdrawing is one quiet button whose confirmation explains the consequence.

Docs: docs/domain-model.md describes both pages as they are now. No setup or permission change.

Risks and follow-ups: the exact opening and closing times of registration are no longer on the public page, only the next deadline as a date (or as a time on the last day). The Luma link in the header and the online case were not checked in the browser.
<!-- SECTION:FINAL_SUMMARY:END -->
