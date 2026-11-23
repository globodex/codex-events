---
id: TASK-442
title: Consolidate event creation and editing in the event builder
status: To Do
assignee: []
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-23T21:14:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - docs/domain-model.md
  - TASK-435
  - TASK-436
  - TASK-440
type: enhancement
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Organizers currently maintain the same event through two editors, which makes behavior drift and adds work for every new feature. Build Day provides the opportunity to finish the transition to one reusable editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Organizers use the current builder for event creation and editing, including events already created in either editor.
- [ ] #2 The builder preserves existing settings and round-trips saved agenda gaps, overlaps and optional end times until those values are edited.
- [ ] #3 Dragging a session or moving it with the keyboard updates its start and end while preserving its duration and existing gaps.
- [ ] #4 Controls still in the classic editor are available in the builder before the old editor, entry points and obsolete logic are removed.
- [ ] #5 The builder keeps its existing create/edit permissions and WebMCP behavior.
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
The build-day branch contains the first agenda timing refactor. Classic editor retirement and parity for remaining controls are still outstanding.

Stack acceptance goal: deliver more Build Day features and make failures easier to recover from, while reducing the amount and complexity of production code. Review the stack against its base and count test deletions separately. A junior developer should be able to follow the main paths and understand why the code behaves as it does.

Decision by Alex on 2026-11-22: the remaining work (moving the last controls into the builder and removing the old editor) waits until after the event on 28 November.

Decision by Alex on 2026-11-23: build the options that only the old editor has into the builder now, before the event (TASK-442.1). Removing the old editor, its entry points and its logic is not part of that decision and stays open here.

TASK-442.1 is done (2026-11-23): every option of the old editor that the Settings tab still showed is in the builder now. Open in this task: removing the old editor, its entry points and its obsolete logic, and making the builder the editor for events created in the old editor.
<!-- SECTION:NOTES:END -->
