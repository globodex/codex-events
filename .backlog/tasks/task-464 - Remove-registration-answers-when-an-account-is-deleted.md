---
id: TASK-464
title: Remove registration answers when an account is deleted
status: To Do
assignee:
  - '@claude'
created_date: '2026-11-22T10:48:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
type: enhancement
ordinal: 180000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Account deletion keeps the registration record of every event. Until now it also kept what the participant wrote in the registration form and in the questionnaire after check-in. Alex decided on 2026-11-22: the registration answers are removed with the account; photos that the participant added stay in the gallery, because participants agree to give them to the organizers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Deleting an account removes the registration form answers and the questionnaire answers of every registration of that user.
- [ ] #2 The registration records with their status and attendance stay, and the photos that the participant added stay in the gallery.
- [ ] #3 Organizer views show no answers for the registration of a deleted account.
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
