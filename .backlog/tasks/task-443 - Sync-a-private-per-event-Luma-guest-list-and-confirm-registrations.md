---
id: TASK-443
title: Sync a private per-event Luma guest list and confirm registrations
status: To Do
assignee: []
created_date: '2026-11-21T15:22:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - docs/domain-model.md
  - TASK-367
  - https://docs.luma.com/reference/get_v1-events-guests-list
  - https://docs.luma.com/reference/webhook_guest_updated
type: feature
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build Day participants register with Luma before using Codex Events. Organizers need to resolve registrations from one local guest-status record and recover missed updates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An event using Luma can import its guest list initially and refresh it manually from event settings.
- [ ] #2 Verified webhooks update the correct event guest when status changes, with duplicate deliveries and repeated syncs leaving the record consistent.
- [ ] #3 Codex Events matches the participant's Luma email to the private list. An unmatched guest cannot register.
- [ ] #4 An approved Luma guest is confirmed automatically. A pending guest remains pending and is confirmed when Luma approves them.
- [ ] #5 Guest status and contact details stay private. An organizer can see when reconciliation needs attention.
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
