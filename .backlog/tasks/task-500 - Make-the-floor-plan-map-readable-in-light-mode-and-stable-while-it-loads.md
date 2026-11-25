---
id: TASK-500
title: Make the floor plan map readable in light mode and stable while it loads
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T19:07:00Z'
updated_date: '2026-11-25T19:16:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
type: bug
ordinal: 217000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex showed the Agenda tab of the Vienna Build Day in light mode: the floor plan map looks broken. The plan image has a transparent background with light floors and grey walls, and the map card has no background, so in light mode the plan sits on the darkened event picture (dark mode inverts the image and looks right). The hint "Tap a session to see its room" is hard to read for the same reason. Before the image loads, the map has no height, so every room name piles up in one line at the top.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In light mode the floor plan map has a solid light surface, so the plan, its room names and the hint above it are readable over the event picture
- [x] #2 While the plan image loads, the map keeps a fixed placeholder area and shows no room names; the rooms appear in place once the image has loaded
- [x] #3 Dark mode of the map stays as it is
- [x] #4 Checked in a real browser at 1440 px and 390 px in light and dark mode, including a slow image load
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
1. AccountEventProgramFloorPlan.vue: the figure gets the bg-accented surface in light mode and stays transparent in dark mode.
2. The map keeps a 4:3 placeholder (soft pulse, none with reduced motion) and shows no rooms or route until the plan image has loaded; a new floor image starts over.
3. Check with a slowed-down image at 1440 px and 390 px, light and dark; lint, typecheck, unit and browser suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. The plan image (1400 x 2254 PNG) has a transparent background with floors #f3f3f5, rooms #ffffff and walls #99a0ad, so in light mode it showed the darkened event picture through the card. Light mode now uses the theme surface bg-accented (#ececf0), where the white rooms stand out; dark mode keeps its inverted image on the dark page. visibleRooms shows the rooms only once the image has loaded, because their areas are fractions of the image. Checked with a Playwright script on the local demo event that delays the plan image by 4 seconds: the placeholder shows no room names; after loading the map is complete at 1440 px and 390 px in light and dark mode. The program browser scenario waits for the image before it checks rooms.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The floor plan map on the Agenda tab has a solid light surface in light mode (bg-accented), so the plan, its room names and the hint above it no longer sit on the darkened event picture. Dark mode keeps its inverted plan on the dark page. While the plan image loads, the map shows a 4:3 placeholder without room names; the rooms and the route appear once the image has loaded, also after switching floors.

Verification: pictures on the local demo event with the plan image delayed by 4 seconds, at 1440 px and 390 px in light and dark mode; lint, typecheck, unit tests and the full browser suite (146 + 1 scenarios) pass. No automated test checks the map colours.
<!-- SECTION:FINAL_SUMMARY:END -->
