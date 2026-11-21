---
id: TASK-444
title: Let event staff check in confirmed participants
status: To Do
assignee: []
created_date: '2026-11-21T15:22:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-443
references:
  - docs/permissions-matrix.md
  - TASK-211
  - TASK-212
  - TASK-214
type: feature
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Staff need to help a participant at the entrance when their Luma check-in is late or missing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Event staff can check in a confirmed participant for their event from the participant list.
- [ ] #2 Manual and Luma check-in open the same participant step, and repeated updates do not duplicate attendance.
- [ ] #3 Pending registrations cannot be checked in to unlock the participant flow.
- [ ] #4 Staff actions are limited to the correct event and recorded through the existing audit controls.
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
