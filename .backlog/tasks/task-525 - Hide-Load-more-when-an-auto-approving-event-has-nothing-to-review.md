---
id: TASK-525
title: Hide Load more when an auto-approving event has nothing to review
status: Done
assignee:
  - '@claude'
created_date: '2026-11-27T19:13:00Z'
updated_date: '2026-11-27T19:19:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/applications/AdminApplicationsReviewPanel.vue
type: bug
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-27 Alex saw Load more under Nothing to review in the Participant Review of an event that approves participants automatically. The review shows no list in that state, but the button appeared because the event has more registrations than one page. Load more now stays hidden while the panel says there is nothing to review.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An auto-approving event with nothing to review shows no Load more in the Participant Review
- [x] #2 Load more still shows wherever the panel shows a list that is cut
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Load more in the Participant Review now stays hidden while an auto-approving event has nothing to review, because that state shows no list. Load more still shows when a cut list is shown. Docs unchanged: they do not describe this button. Test gap: no automated test for this panel state, because the panel has no mounting test setup; checked in the browser instead with 106 demo registrations: no Load more with nothing to review, and Load more back once a registration waits for review. Validation: lint, typecheck, unit (728), full BDD (150 + 1).
<!-- SECTION:FINAL_SUMMARY:END -->
