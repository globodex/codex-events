---
id: TASK-520
title: Make the Claim credits panel on the Overview compact
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T22:42:00Z'
updated_date: '2026-11-26T22:51:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/AccountEventCreditsPanel.vue
type: feature
ordinal: 237000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked to make the Claim credits panel on the Overview more compact: it took much vertical space and pushed everything down. The note stands on the title line, the offers stand side by side on wide screens, and the Claim credit button sits on the title line of its offer. Content and behavior stay the same.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The panel shows the same offers, texts, codes and buttons in less height
- [x] #2 On wide screens two offers stand side by side; on phones they stand one below the other
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
The Claim credits panel on the Overview takes much less height: the note stands on the title line, two or more offers stand side by side on wide screens (one offer uses the full width), and the Claim credit button sits on the title line of its offer. Texts, codes, badges, errors and behavior are unchanged. Docs unchanged (layout only). Validation: lint, typecheck, unit, the credits browser scenarios in the full BDD suite, and a browser check at 1440 px.
<!-- SECTION:FINAL_SUMMARY:END -->
