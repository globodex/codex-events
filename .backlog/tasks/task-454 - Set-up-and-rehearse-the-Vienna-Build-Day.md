---
id: TASK-454
title: Set up and rehearse the Vienna Build Day
status: To Do
assignee: []
created_date: '2026-11-21T15:23:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-442
  - TASK-443
  - TASK-444
  - TASK-445
  - TASK-446
  - TASK-447
  - TASK-448
  - TASK-449
  - TASK-450
  - TASK-451
  - TASK-452
  - TASK-453
references:
  - docs/testing-strategy.md
  - >-
    https://github.com/MrLesk/codex-build-vienna/blob/main/07-rooms-tu-wien-karlsplatz.md
type: task
ordinal: 172000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The first use of the new format is Vienna Build Day. Venue notes confirm the AE U1 corridor, and final track-to-room assignments are still draft.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An organizer can configure the venue, workshop rooms, agenda, Luma sync, questionnaire, challenge list, credits and gallery from the event editor.
- [ ] #2 The Vienna schematic uses the booked corridor and clear room names, with final room assignments confirmed before publishing.
- [ ] #3 A phone rehearsal covers pending registration, confirmation, saved sessions, room highlighting, Luma and manual check-in, and the questionnaire.
- [ ] #4 A failed or stale Luma update can be recovered with manual sync. Unavailable credit inventory does not block a challenge.
- [ ] #5 The workflow is verified with event staff and participant accounts before the event.
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
