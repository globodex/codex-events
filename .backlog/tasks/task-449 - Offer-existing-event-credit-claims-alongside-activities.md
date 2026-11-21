---
id: TASK-449
title: Offer existing event credit claims alongside activities
status: To Do
assignee: []
created_date: '2026-11-21T15:23:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-448
references:
  - docs/domain-model.md
type: enhancement
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants who have completed the check-in flow can use the existing credit giveaway while they start work on challenges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eligible checked-in participants can claim available credits through the existing event credit flow once any configured questionnaire is complete.
- [ ] #2 Credit claims remain optional and do not block challenges or gallery uploads.
- [ ] #3 When the event inventory runs out the giveaway ends and participants can continue with event activities.
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
