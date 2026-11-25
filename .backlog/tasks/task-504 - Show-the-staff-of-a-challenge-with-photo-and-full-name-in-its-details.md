---
id: TASK-504
title: Show the staff of a challenge with photo and full name in its details
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T20:13:00Z'
updated_date: '2026-11-25T21:06:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
type: feature
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex asked that opening the Details of a challenge on the Agenda tab shows its staff with their profile picture and full name. The challenge card shows the staff only as small profile icons, with the name on hover (TASK-488), which participants on a phone cannot see.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Details of a challenge on the Agenda tab list its staff members, each with profile icon (or initials) and full name, before the instructions
- [x] #2 A challenge without staff shows no staff section
- [x] #3 Checked in a real browser at 1440 px and 390 px in light and dark mode
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Canonical docs were updated or confirmed unchanged
- [x] #2 Code behavior matches canonical docs
- [x] #3 Relevant validation commands pass
- [x] #4 Tests were added or updated when behavior changed
- [x] #5 Test gaps are documented when automation is not practical
- [x] #6 Config and developer workflow docs were updated when setup changed
- [x] #7 Auth and permissions changes follow the documented platform model
- [x] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. AccountEventChallengeCard.vue: inside the details dialog, a Staff section lists each staff member with AppAvatar (sm) and full name, from the same challenge.staff data as the card.
2. Check the dialog in the browser; lint and typecheck; browser suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. Checked with a Playwright script on the local demo Agenda tab: the Details of "Build a site someone can use" list STAFF with Backup Judge and Platform Admin Grant Target (initials, the demo users have no photos) before the instructions, at 1440 px and 390 px in light and dark mode.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The Details of a challenge on the Agenda tab list its staff under a Staff heading, each with profile icon (or initials) and full name, before the instructions. A challenge without staff shows no staff section. Participants on a phone, who cannot hover the small icons on the card, now see who supports the challenge.

Verification: the demo challenge with two staff members at 1440 px and 390 px in light and dark mode; lint, typecheck, unit tests and the full browser suite pass. No automated test checks the staff list in the dialog.
<!-- SECTION:FINAL_SUMMARY:END -->
