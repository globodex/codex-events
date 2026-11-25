---
id: TASK-502
title: Make the event workspace work in light mode
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T19:47:00Z'
updated_date: '2026-11-25T19:52:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/pages/account/events/[slug]/index.vue
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
type: bug
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex checked the Vienna Build Day workspace in light mode: a selected challenge card turns unreadable, the agenda times sit on a white strip, and the floor plan map first opens very large and then shrinks. He asked to check the workspace in light mode, fix everything that is broken, and keep dark mode working. The workspace darkens the event picture with a black gradient in light mode too, while its headings, times and highlighted cards are made for a light page (the same cause as TASK-496 on the registration page). The time column of the agenda has a solid page-colored background so that sessions of parallel tracks can scroll under it; without sideways scrolling it shows as a white strip in light mode and a black strip in dark mode. The map only knew the shape of the plan after the whole image had loaded, so until then it had no width limit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In light mode the workspace washes the event picture white, so headings, agenda times and selected cards are readable; dark mode keeps its dark gradient
- [x] #2 The agenda times get a background only while parallel tracks scroll sideways, so no white or black strip shows otherwise
- [x] #3 The floor plan map takes its final size as soon as the browser knows the shape of the plan, and until then keeps the size of a portrait plan instead of the full width
- [x] #4 The map has its own surface in light and dark mode, so the plan never sits on the event picture
- [x] #5 Checked in a real browser at 1440 px and 390 px in light and dark mode: the workspace tabs as participant and platform admin, and the Agenda while the plan loads, after it loaded and with a selected challenge
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
1. app/pages/account/events/[slug]/index.vue: the light-mode overlay becomes the white wash of the registration page; dark mode keeps its gradient.
2. AccountEventProgramTimeline.vue: a resize observer on the timeline and its grid tells whether parallel tracks scroll sideways; only then do the sticky times get the page background.
3. AccountEventProgramFloorPlan.vue: the plan ratio is read as soon as the image gets its height (from its first bytes), and on load for a new floor; until then the card uses a 3:4 placeholder ratio for its width limit and placeholder area; the card has the bg-accented surface in both modes.
4. Check light and dark at 1440 px and 390 px; lint, typecheck, unit and browser suites.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. Light-mode audit on the local demo event with Playwright pictures: Overview, Agenda, Gallery and Staff as the participant; Agenda, Participants, Operations, Certificates and Staff as the platform admin. With the white wash all of them read well; the remaining problems were the time strip and the map size. The Agenda was then pictured with the plan image held back 3 seconds (placeholder at the final card width, no large first frame), after loading, and with the challenge "Make a one-minute game" selected, at 1440 px and 390 px in light and dark mode. In dark mode the map now has the #212121 accented surface instead of the event picture behind the inverted plan.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event workspace works in light mode, and dark mode keeps working. Light mode washes the event picture white behind the workspace (like the registration page), so headings, agenda times and selected challenge or session cards are readable. The agenda times get a background only while parallel tracks scroll sideways, so neither a white nor a black strip shows otherwise. The floor plan map reads the plan's shape as soon as the image gets its size, and until then uses a 3:4 placeholder for its width limit and area, so it no longer opens very large and then shrinks. The map card has the accented surface in both modes.

Verification: Playwright pictures of the local demo workspace at 1440 px and 390 px in light and dark mode (all tabs as participant and admin; the Agenda with the plan image held back 3 seconds, after loading, and with a selected challenge); lint, typecheck, unit tests and the full browser suite (146 + 1 scenarios) pass. No automated test checks colours or the map's first size.
<!-- SECTION:FINAL_SUMMARY:END -->
