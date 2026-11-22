---
id: TASK-465
title: Load more registrations in the participant list
status: To Do
assignee:
  - '@claude'
created_date: '2026-11-22T10:48:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
type: enhancement
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The participant list returns the newest 100 registrations of an event. Search finds everyone, but an organizer cannot page through a larger event. Alex asked on 2026-11-22 for a way to load more.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 While the event has more registrations than the list shows, the organizer can load the next registrations and they are added to the list.
- [ ] #2 The list never shows a registration twice, and the counts keep describing the whole event.
- [ ] #3 Search still finds every participant while only part of the list is loaded.
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
