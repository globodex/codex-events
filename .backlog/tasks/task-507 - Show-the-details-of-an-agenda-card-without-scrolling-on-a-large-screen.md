---
id: TASK-507
title: Show the details of an agenda card without scrolling on a large screen
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T22:00:00Z'
updated_date: '2026-11-25T22:03:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventDetailsDialog.vue
type: bug
ordinal: 224000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex saw that the Details popup of a challenge on the Agenda tab needs scrolling on his desktop. The popup is 28rem wide on every screen. On a large screen it should be wider and taller, so the details of a challenge or session fit without scrolling. Phones and tablets keep the narrow popup and scroll.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On a screen at least 1024 px wide the Details popup is wider and taller than on smaller screens
- [x] #2 The longest Vienna challenge details fit without scrolling at 1440 x 900
- [x] #3 Phones and tablets keep the current popup, which scrolls when its content is long
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
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Only the classes of AccountEventDetailsDialog change: from 1024 px the popup is 42rem wide and up to 90dvh high. The size is a visual property, so no automated test covers it; it was measured in real browsers.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
On screens at least 1024 px wide, the Details popup of the Agenda tab is 42rem wide and up to 90% of the screen high. Smaller screens keep the 28rem popup, which scrolls. Every card on the Agenda tab with a Details button uses this popup.

Verification: lint, typecheck and 724 unit tests pass. On the live Vienna Agenda tab, I applied the new size in my browser tab only, at 1200 x 863 as an event admin with staff instructions. The six challenge popups need 299 to 595 px and none scrolls; at the old size the OpenAI API challenge scrolled. In the local preview the popup is 670 px wide at 1440 px and 356 px wide at 390 px, in light and dark mode.
<!-- SECTION:FINAL_SUMMARY:END -->
