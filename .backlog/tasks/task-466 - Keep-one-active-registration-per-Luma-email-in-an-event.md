---
id: TASK-466
title: Keep one active registration per Luma email in an event
status: To Do
assignee:
  - '@claude'
created_date: '2026-11-22T11:01:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
type: enhancement
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The platform matches a Luma guest to a registration by the Luma email saved on the account, and it cannot prove that the email belongs to the account. Two accounts with the same Luma email in one event made the match ambiguous, so Luma updates and Luma check-ins stopped for both. Alex decided on 2026-11-22: registration must stay as smooth as possible for people who registered on Luma and sign up on the spot at the event, and he cannot approve registrations by hand on the event day. So automatic confirmation stays, no approval step and no extra step for the participant is added, and the platform only makes sure that one Luma email belongs to one active registration per event. Proof of email ownership (for example a code sent to the Luma email) is not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In an event that uses Luma, a second account cannot register with a Luma email that another active registration of that event already uses, and it is told why.
- [ ] #2 An account cannot change its Luma email to one that another active registration uses in an event where both are registered.
- [ ] #3 A withdrawn or rejected registration frees its Luma email, and a withdrawn registration cannot be restored while another active registration uses its Luma email.
- [ ] #4 Registration with an approved Luma guest email is still confirmed at once, without an approval by the organizer.
- [ ] #5 The registration form suggests the account email as the Luma email when the account has no Luma email yet.
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
