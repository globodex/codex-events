---
id: TASK-522
title: Show an error summary next to Continue on the account sign-up page
status: Done
assignee:
  - '@claude'
created_date: '2026-11-27T14:18:00Z'
updated_date: '2026-11-27T14:22:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/pages/account/register.vue
  - tests/bdd/steps/registration-email.steps.ts
type: bug
ordinal: 239000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-27 Alex asked to verify and release a fix to the account sign-up page (/account/register): after Continue with unchecked consent boxes, an error summary above the Continue button names the missing Privacy Policy and Platform Terms, in addition to the error under each checkbox. The change was prepared outside this session; this task verifies and releases it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After Continue, a summary above the button names each unchecked consent document, and it disappears once both are checked
- [x] #2 The error under each unchecked checkbox stays
- [x] #3 The registration email browser scenario covers the summary
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The account sign-up page (/account/register) shows an error summary above Continue after a submit with unchecked consent boxes: Review the required checkboxes, and which of the Privacy Policy and the Platform Terms are missing. It updates as boxes are checked and disappears when both are. The error under each unchecked box stays. The change was prepared outside this session and verified here: lint, typecheck, unit (728), full BDD (149 + 1, the registration email scenarios check the summary step by step), and a browser check of the page at 1440 px dark and 390 px light with a demo account without consent (restored afterwards). Docs unchanged: they do not describe this copy.
<!-- SECTION:FINAL_SUMMARY:END -->
