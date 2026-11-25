---
id: TASK-497
title: Make the feedback form's rating panel readable in light mode
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T17:47:00Z'
updated_date: '2026-11-25T17:48:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/public/events/EventFeedbackForm.vue
type: bug
ordinal: 214000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While fixing the light-mode registration form (TASK-496) on 2026-11-25, the post-event feedback form showed a dark grey rating panel in light mode: the panel in EventFeedbackForm.vue uses bg-[#0F0F10]/70 in both themes, while its question labels, prompts and scale labels use light-mode text colours, so they are hard to read. Participants of the Vienna Build Day (28 November 2026) use this form after the event. Alex asked to fix it on 2026-11-25.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In light mode, the rating panel of the feedback form has a light background, so its question labels, prompts, rating buttons and scale labels are readable
- [x] #2 Dark mode of the feedback form and the rating buttons on the judging pages stay unchanged
- [x] #3 Checked in a real browser at 1440 px and 390 px in light and dark mode on a completed event with the Vienna picture as background
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
1. app/components/public/events/EventFeedbackForm.vue: the rating panel gets bg-white/70 in light mode and keeps dark:bg-[#101112]. AppRatingOption stays as it is, because the judging pages share it.
2. Check on a local fixture event set to completed for the check (restored afterwards), with the Vienna picture: 1440 px and 390 px, light and dark.
3. Lint and typecheck, commit and push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. Checked on the local fixture event e2e-fixture-event, set to completed with the Vienna picture for the check and restored afterwards: at 1440 px and 390 px the panel is light in light mode and unchanged in dark mode. AppRatingOption is unchanged, because the judging pages share it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In light mode, the rating panel of the post-event feedback form now has a light background (bg-white/70) instead of a dark grey one, so its question labels, prompts, rating buttons and Poor/Okay/Excellent labels are readable. Dark mode keeps its panel, and the shared rating buttons are unchanged, so the judging pages look the same.

Verification: checked on a local completed event with the Vienna picture at 1440 px and 390 px in light and dark mode after a fresh load. Lint and typecheck pass. No automated test checks colour contrast; this is a styling change only.
<!-- SECTION:FINAL_SUMMARY:END -->
