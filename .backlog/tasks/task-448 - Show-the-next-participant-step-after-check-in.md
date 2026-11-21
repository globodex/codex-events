---
id: TASK-448
title: Show the next participant step after check-in
status: To Do
assignee: []
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-21T23:21:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-444
references:
  - docs/lifecycle-and-state-machines.md
type: feature
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A participant arriving at an event needs to see the next thing to do without browsing the full account workspace.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A confirmed participant can browse the agenda sessions before check-in.
- [ ] #2 After check-in the account page presents the event questionnaire when configured and tracks completion.
- [ ] #3 Events can omit the questionnaire. The account page then opens the available activities directly after check-in.
- [ ] #4 The account page shows one clear next action and keeps participant-facing text brief.
- [ ] #5 The flow and questionnaire are optional per event and use the same result for Luma and staff check-ins.
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
