---
id: TASK-469
title: Open session details in a popup instead of growing the agenda item
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T13:14:00Z'
updated_date: '2026-11-22T13:21:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - docs/domain-model.md
ordinal: 185000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex reviewed the participant Agenda on 2026-11-22: selecting an agenda item must not make it grow. Today a selected session shows its details below its title, which makes the item taller and moves the items after it. He wants a button on the item that does not change its size and opens a popup with the session's details (his example: the workshops).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a session in the Agenda does not change the size of its item or the position of other items.
- [x] #2 A selected session that has details shows a Details button inside its item; the button opens a popup with the session's title, time, room and details.
- [x] #3 The popup can be closed with its close button, the Escape key and a click outside, and focus returns to the Details button.
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
The session item (AccountEventProgramSession) no longer shows the details text when it is selected. A selected session with details shows a small Details button in the free bottom right corner of the item (absolutely placed; the line with duration and room keeps that end free), so the item and the items after it keep their size and place. The button opens a dialog with the session's title, time, room and details.
Closest analog: AdminBuilderCreditsInfoDialog (reka-ui dialog with trigger, overlay, title, description and close button). No new component: the dialog belongs to the session item and uses the shared AppButton for its trigger and close button.
Checked in the preview at 390 and 1440 px in both themes: the size and place of every agenda item is the same before and after selecting, the dialog shows title, time, room and details, Escape closes it and focus returns to the Details button.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selecting an agenda item no longer changes its size. A selected session with details shows a Details button in the corner of its item; the button opens a dialog with the session's title, time, room and details.

Validation: lint, typecheck and unit tests (738) pass; the agenda browser scenarios pass (the filtered run ends with 'No tests found' for the second suite, which has no agenda scenario). Checked in the preview at 390 and 1440 px in both themes: item sizes and places stay the same on selection; the dialog closes with its close button, Escape and a click outside, and focus returns to the button.

Test gaps: no own automated test; the item and the dialog have no logic beyond showing the session's data.

Risks and follow ups: the button shows only on the selected item, as requested. On a phone, selecting a session with a room moves the page to the map, so the button is reached through 'Back to session'. Showing the button on every item with details would avoid that; this is Alex's decision.
<!-- SECTION:FINAL_SUMMARY:END -->
