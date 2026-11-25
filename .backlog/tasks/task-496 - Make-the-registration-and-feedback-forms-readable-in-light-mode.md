---
id: TASK-496
title: Make the registration form readable in light mode
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T17:33:00Z'
updated_date: '2026-11-25T17:36:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/pages/events/[slug]/register.vue
type: bug
ordinal: 213000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex reported that on the Vienna Build Day registration form, several questions have no contrast with the background in light mode, while dark mode is fine. The public event pages darken the event picture with a black gradient (20% at the top to 68% at the bottom) in light mode too. The event page, the feedback page and the application terms page put their text on light cards, but the registration form puts dark text straight on the darkened picture, so labels, hints and the attendance confirmation are almost invisible, worst near the bottom of the screen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In light mode, the registration page washes the event picture with white, so its labels, hints and question text are readable over the whole page height
- [x] #2 Dark mode of the registration page, and the light mode of the event page, the feedback page and the application terms page, stay unchanged
- [x] #3 Checked in a real browser at 1440 px and 390 px in light and dark mode, on an event with the Vienna picture as background
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
1. app/pages/events/[slug]/register.vue: the light-mode overlay becomes a white wash (from-white/40 via-white/50 to-white/60); dark mode keeps its black gradient. A comment says why this page differs from the event page.
2. Check the page with the Vienna picture on the local demo event: 1440 px and 390 px, light and dark.
3. Lint and typecheck, commit and push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. Reproduced on the local demo event (build-day-demo) with the Vienna picture as background: in light mode the labels (#424654) and hints (#535b6d) sit on the black-darkened picture. The white wash makes them readable at 1440 px and 390 px; dark mode looks the same as before. The feedback page was checked on a local fixture event set to completed for the check (restored afterwards): its form sits on a light card, so it keeps the dark overlay. Seen in passing, outside this task: in light mode the rating panel of EventFeedbackForm.vue (line 127) uses bg-[#0F0F10]/70, so its questions and scale labels have low contrast.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In light mode, the registration page now washes the event picture with white instead of darkening it, so the form's dark labels, hints and attendance confirmation are readable down the whole page. Dark mode keeps its black gradient, and the event, feedback and application terms pages are unchanged, because they already put their text on light cards.

Verification: reproduced and checked on the local demo event with the Vienna picture as background, at 1440 px and 390 px in light and dark mode after a fresh load. Lint and typecheck pass. No automated test checks colour contrast; this is a styling change only.

Follow-up seen in passing (not done): in light mode the rating panel of the feedback form (EventFeedbackForm.vue, bg-[#0F0F10]/70) gives its questions and scale labels low contrast.
<!-- SECTION:FINAL_SUMMARY:END -->
