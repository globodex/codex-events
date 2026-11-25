---
id: TASK-498
title: Place buttons and content inside alerts at full width
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T18:53:00Z'
updated_date: '2026-11-25T19:08:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/AppAlert.vue
type: bug
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex showed the Luma panel of the event builder: the "Try again" button under "Luma is not connected" sits squeezed at the left edge without its button look. AppAlert renders on a grid whose first column is 0 px wide unless the alert has an icon; its title and description are placed in the content column, but anything passed in its slot (and its own retry button) falls into the 0 px column. Other alerts with slot content share the problem unless they place it themselves (AdminApplicationsReviewPanel does).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Content passed into an AppAlert, and its retry button, use the full width of the alert under the title and description
- [x] #2 The Try again button in the Luma panel shows as a normal button inside the alert
- [x] #3 Checked in a real browser in light and dark mode
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
1. app/components/AppAlert.vue: the slot content and the retry button span the full grid width (col-span-full col-start-1), with a comment on why.
2. Check the Luma panel alert locally (saved Luma credentials without a configured webhook on the demo event), light and dark.
3. Lint and typecheck, commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. AppAlert now wraps its slot content in a div with col-span-full col-start-1 and gives its retry button the same classes, so both use the full width under the title and description. Checked the Luma panel alert ("Luma is not connected" with Try again) on the local demo event with failed Luma credentials in light and dark mode; the credentials were removed afterwards. The other alerts with slot content (builder rooms error, submission interventions, the next-step notice, the application review panel) now get the same full-width row.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Content passed into an AppAlert, and its retry button, now span the whole alert under the title and description. Before, they fell into the alert's 0 px icon column, so the Try again button in the Luma panel sat squeezed at the left edge without its button look. Four other alerts with their own content (builder rooms error, submission interventions, the next-step notice, the application review panel) get the same full-width row.

Verification: the Luma panel alert with failed credentials on the local demo event in light and dark mode; lint, typecheck, unit tests and the full browser suite (146 + 1 scenarios) pass. No automated test checks the alert layout; this is a styling change only.
<!-- SECTION:FINAL_SUMMARY:END -->
