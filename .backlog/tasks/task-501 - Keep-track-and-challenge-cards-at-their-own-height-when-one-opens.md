---
id: TASK-501
title: Keep track and challenge cards at their own height when one opens
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T19:07:00Z'
updated_date: '2026-11-25T19:16:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventChallengeChoice.vue
type: bug
ordinal: 218000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex showed the workspace Overview of the Vienna Build Day: opening one track or challenge card with "Show more" makes the card next to it as tall, with empty space. The cards sit in a CSS grid that stretches every card in a row to the tallest one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opening a track or challenge card leaves the other card in its row at its own height
- [x] #2 Checked in a real browser at 1440 px in light and dark mode
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
Built on 2026-11-25. The card grid in AccountEventChallengeChoice.vue aligns cards to the top (items-start), so a card keeps its own height when its neighbour opens. Collapsed cards in one row can now differ in height when their titles wrap differently. Checked on the local demo Overview at 1440 px in light and dark mode after opening the first card.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Track and challenge cards on the workspace Overview are aligned to the top of their row, so opening one card with Show more no longer stretches the card next to it. Two closed cards in one row can now differ slightly in height when their titles wrap differently.

Verification: pictures of the local demo Overview at 1440 px in light and dark mode after opening the first card; lint, typecheck, unit tests and the full browser suite pass.
<!-- SECTION:FINAL_SUMMARY:END -->
