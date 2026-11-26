---
id: TASK-515
title: Put the selected agenda item in the page address so the link can be shared
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T21:24:00Z'
updated_date: '2026-11-26T21:35:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/check-in-flow.steps.ts
  - tests/bdd/steps/event-program.steps.ts
type: feature
ordinal: 232000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked that clicking an agenda item on the Agenda tab shows it in the page address, so he can share the link and others open the same view. Selecting a session or an agenda block with a room writes ?session=<id>; opening that link selects the same item and shows its room on the map. Selecting a challenge or a place on the map removes it. A selection on the agenda also closes an open workshop page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Selecting a session or an agenda block with a room puts its id in the page address
- [x] #2 Opening that address selects the same session or agenda block and shows its room on the map
- [x] #3 Selecting a challenge or a place on the map removes the selection from the address
- [x] #4 Docs and browser tests cover the shareable selection
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The page address uses the existing session query value for both sessions and agenda blocks, because a link already names either one with first. The agenda emits linkSelection with the selected id, or null when a challenge or a place on the map is selected; the page writes it with a replace navigation, so Back still leaves the page. The same navigation removes an open workshop page, so a selection on the agenda never races a separate close. The Show the way link still says first; the address then names the selected item by its id.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Selecting a session or an agenda block with a room on the Agenda tab now writes ?session=<id> into the page address. Opening that link selects the same item and shows its room on the map. Selecting a challenge or a place on the map removes it from the address. A selection on the agenda also closes an open workshop page.

Validation: lint, typecheck, unit (725) and the full BDD suite (148 + 18) pass; the agenda scenario now checks the address and that a reload keeps the selection. A first full BDD run had five public-page failures on a cold dev server (page.goto aborted); the re-run passed. Checked by hand in the local preview: a session, an agenda block, a reload of the link and a challenge.

Risks: none known.
<!-- SECTION:FINAL_SUMMARY:END -->
