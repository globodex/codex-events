---
id: TASK-485
title: Show one status per event on My events
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T23:04:00Z'
updated_date: '2026-11-22T23:07:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/events/EventParticipationCard.vue
modified_files:
  - app/components/events/EventParticipationCard.vue
  - app/domains/events/participation.ts
  - app/pages/account/events/[slug]/index.vue
  - tests/unit/app/domains/events/participation.test.ts
type: enhancement
ordinal: 201000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A card on the My events page shows three badges for a registered person: the state of the event ('Registration open'), 'Application submitted', and the person's own status ('Approved'). The first two say nothing new. The meta line also carries the labels 'Type:' and 'Date:'. Alex asked on 2026-11-22 to find more simplifications in the patterns of this session and to build them; the header of the event page already shows only the person's own status while registration is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A card on My events shows the person's own status and no 'Application submitted' badge.
- [x] #2 The card shows the state of the event only when it tells a registered person something new, by the same rule as the header of the event page.
- [x] #3 The meta line shows the event type and the date without the labels 'Type:' and 'Date:'.
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
EventParticipationCard.vue shows one status badge. The 'Application submitted' badge is gone: it only ever stood beside the application status, which says more. formatParticipationStageLabel and getParticipationStageColor had no other use and are removed.

The rule for the state badge of the event has one owner now: showsEventStateBesideOwnStatus in app/domains/events/participation.ts. The card and the header of the event page both call it.

The meta line shows the type and the date as plain values.

Browser check on the local preview, 2026-11-23 (1440x900 dark, 390x844 light): an approved and a pending person see one badge; a person who was not approved sees 'Registration open' and 'Not approved'; the header of the event page still shows only 'Approved'. No sideways overflow, no page errors.

Validation, 2026-11-23: lint and typecheck passed, 716 unit tests passed. The browser suite was not run for this small change; no scenario reads the removed texts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A card on My events now shows the person's own status only. The state of the event appears beside it only when it adds something, by the same rule as the header of the event page, and that rule lives in one function. The labels 'Type:' and 'Date:' are gone.

No docs change: the docs do not describe these cards. No setup or permission change.

Risk: none known. Follow-up: the browser suite runs with the next group of simplifications.
<!-- SECTION:FINAL_SUMMARY:END -->
