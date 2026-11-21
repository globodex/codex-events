---
id: TASK-450
title: Publish event challenges participants can pick up
status: To Do
assignee: []
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-21T23:43:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-448
references:
  - docs/domain-model.md
type: feature
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Event organizers need to offer practical tasks to participants after the check-in flow. The team still needs to agree what picking up and completing a challenge should record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An event admin can publish challenges with instructions and resources for their event.
- [ ] #2 A participant who has completed the check-in flow can pick up published challenges independently of an event credit claim.
- [ ] #3 The team has approved the rules for what gets recorded when a challenge is picked up or completed before implementation.
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
Decision by Alex on 2026-11-22: nothing is recorded when a participant picks a challenge. Challenges are a published list with instructions and resources.
<!-- SECTION:NOTES:END -->
