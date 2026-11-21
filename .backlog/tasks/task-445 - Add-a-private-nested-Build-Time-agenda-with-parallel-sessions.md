---
id: TASK-445
title: Add a private nested Build Time agenda with parallel sessions
status: Done
assignee: []
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-21T17:41:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-442
references:
  - docs/api-surface.md
  - docs/domain-model.md
type: feature
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The public needs a simple day outline. A confirmed participant needs the actual choice of simultaneous workshops and the times and rooms for each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The public day agenda shows Build Time as one entry without its private sessions or room details.
- [x] #2 Confirmed participants can open Build Time before check-in. Pending participants see the public agenda.
- [x] #3 An event admin can schedule sessions in parallel tracks with independent times and gaps.
- [x] #4 A session has a stable identity and displays its time and assigned room when configured.
- [x] #5 The editor and protected read work for other events and are configurable per event.
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The existing event builder attaches named tracks and timed sessions to one public block. Confirmed participants can open the Agenda tab from Build Time in Overview or Details before check-in. Sessions preserve their offsets when the public block moves. The Agenda tab uses the public agenda time format and shows concurrent sessions and gaps in separate track columns.
<!-- SECTION:FINAL_SUMMARY:END -->
