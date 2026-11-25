---
id: TASK-503
title: Show the description and details cards of the workspace like its other cards
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T20:08:00Z'
updated_date: '2026-11-25T21:02:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/public/events/EventOverviewPanel.vue
  - app/components/public/events/EventOverviewSection.vue
  - app/components/public/events/EventDetailsCard.vue
type: bug
ordinal: 220000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex compared the workspace Overview of the Vienna Build Day in light mode: the event description card is darker than the track and challenge cards above it, and the light grey card is the right one. The description card (EventOverviewPanel) and the event details card (EventDetailsCard) carry the translucent glass look of the public event page, where cards sit on the event picture; in the workspace, which washes the picture white in light mode, the glass looks different from the plain cards around it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the workspace Overview, the description card and the event details card have the same surface as the other workspace cards, in light and dark mode
- [x] #2 The public event page keeps its glass cards
- [x] #3 Checked in a real browser at 1440 px in light and dark mode on the workspace Overview and the public event page
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
1. EventOverviewPanel.vue gets a glass prop (off by default) for the glass look; EventOverviewSection.vue, the public page, turns it on.
2. EventDetailsCard.vue, used only by the workspace, drops the glass classes and uses the plain AppCard surface.
3. Pictures of the workspace Overview and the public page in light and dark mode; lint and typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. EventOverviewPanel has a glass prop that only EventOverviewSection (the public event page) turns on; EventDetailsCard is used only by the workspace and lost its glass classes. In the workspace both cards now use the plain AppCard surface (bg-default at 80 %), which on the white-washed page looks the same as the solid bg-default track and challenge cards. Checked on the local demo event at 1440 px: the workspace Overview in light and dark mode, and the public event page in light and dark mode with its glass cards unchanged.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In the workspace Overview, the event description card and the event details card now use the plain AppCard surface, like the other workspace cards, so the description no longer looks darker than the track and challenge cards. EventOverviewPanel has a glass option that only the public event page turns on, so the public page keeps its glass cards on the event picture; EventDetailsCard is used only in the workspace and lost its glass look.

Verification: the workspace Overview and the public event page on the local demo event at 1440 px in light and dark mode; lint, typecheck, unit tests and the full browser suite pass.
<!-- SECTION:FINAL_SUMMARY:END -->
