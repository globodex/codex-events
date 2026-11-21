---
id: TASK-447
title: Let confirmed participants save sessions to My agenda
status: Done
assignee: []
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-21T16:54:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-445
references:
  - docs/permissions-matrix.md
type: feature
ordinal: 165000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Participants need a short personal schedule so they can see where to be and when during a day with parallel sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A confirmed participant can save or unsave a session before check-in.
- [x] #2 My agenda filters the day to that participant's saved sessions and keeps their times and room links.
- [x] #3 Saving affects only the participant's favorites and persists across visits.
- [x] #4 The flow uses favorites without a seat reservation or workshop subscription.
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
Confirmed participants can save and unsave sessions before check-in. My agenda shows only their saved sessions with timing and room links. Favorites persist across reloads and are cleared when their session, program or account is removed.
<!-- SECTION:FINAL_SUMMARY:END -->
