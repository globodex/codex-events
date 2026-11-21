---
id: TASK-460
title: Consolidate repeated event and account panels
status: Done
assignee: []
created_date: '2026-11-21T18:40:00Z'
updated_date: '2026-11-21T19:18:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - DEVELOPMENT.md
type: enhancement
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reuse panels and sections that have the same structure and interactions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Platform admin and event organizer rosters render through one role-aware panel.
- [x] #2 Blind and pitch reviews use the existing submission panel directly.
- [x] #3 Shortlisted and remaining teams share a results section.
- [x] #4 Public and participant tracks share guideline and resource rendering.
- [x] #5 Place the touched components in their domain molecules and organisms folders and keep their previews connected.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Canonical docs were updated or confirmed unchanged
- [x] #2 Code behavior matches canonical docs
- [x] #3 Relevant validation commands pass
- [x] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [x] #6 Config and developer workflow docs were updated when setup changed
- [x] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The platform role panel combines the Platform admins and Event organizers panels using the existing roster row, candidate search, and mutation runner. The judging workspace uses the existing submission panel and action footer for both review modes. The results panel loops over the two ranked team lists with their own rank labels. EventTrackDetails replaces the matching Markdown and resource sections and accepts the authorized staff content from the account panel.

The platform role roster, both track panels, the judging workspace, and the prize redemptions panel are organisms. EventTrackDetails and JudgeSubmissionPanel are shared sections in their domains’ molecules folders.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The four refactors remove 620 lines of application code. Five panels live in their domain organisms folders and two shared sections live in molecules folders. Storybook has 11 new examples for the role rosters, judging, rankings, and tracks. Browser coverage checks that switching roster tabs loads the correct list and resets the search. Lint, type checking, 725 unit tests, 510 integration tests, 105 isolated browser scenarios, and rendering all 177 stories passed.
<!-- SECTION:FINAL_SUMMARY:END -->
