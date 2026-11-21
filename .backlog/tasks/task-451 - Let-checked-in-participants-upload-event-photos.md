---
id: TASK-451
title: Let checked-in participants upload event photos
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
  - docs/permissions-matrix.md
  - docs/domain-model.md
type: feature
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants need a way to contribute pictures to the event's existing gallery. The team still needs to decide whether staff review is required before attendees see uploads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Eligible participants can upload photos to the existing event gallery after the check-in flow.
- [ ] #2 Organizers keep their existing controls for the event gallery.
- [ ] #3 Participant uploads become visible under the agreed review rules, and that rule is enforced for both listing and opening a photo.
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
Decision by Alex on 2026-11-22: participant photos appear in the event gallery in an "Uploaded by participants" section. They are not public by default. Staff and admins can hide them.
<!-- SECTION:NOTES:END -->
