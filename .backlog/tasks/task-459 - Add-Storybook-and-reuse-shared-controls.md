---
id: TASK-459
title: Add Storybook and reuse shared controls
status: Done
assignee: []
created_date: '2026-11-21T17:43:00Z'
updated_date: '2026-11-21T17:55:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - DEVELOPMENT.md
type: enhancement
ordinal: 175000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Give contributors one place to inspect the shared UI, common event workflows and control states without signing in.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Storybook runs locally with fixture data and no live API or authentication.
- [x] #2 Shared application controls and generated primitive families have working stories, with event builder, agenda, public and participant examples.
- [x] #3 Repeated button and selection styles use shared controls while preserving accessibility and behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AppButton and the existing filter pills were the closest analogs. AppFilterButton extends AppButton for selected pills with counts. AppSectionTab keeps event tab styling in one place for link and button tabs. AppRatingOption keeps the shared radio markup and rating states together. The builder choice card replaces the matching choice markup from credits and judging.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Storybook provides 166 examples across 74 groups, including all shared App components, generated primitive families, and composed event workflows. The catalog runs on local sample data without sign-in. The button audit removed repeated styling and consolidated action, filter, rating, tab, and choice controls. Chromium rendered all stories with live requests blocked.
<!-- SECTION:FINAL_SUMMARY:END -->
