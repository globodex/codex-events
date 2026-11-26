---
id: TASK-516
title: Cover the workshop page with a browser test
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T21:59:00Z'
updated_date: '2026-11-26T22:04:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/event-program.steps.ts
type: chore
ordinal: 233000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked for a browser test of the workshop page (TASK-514 was checked by hand only). The scenario covers the session popup with the staff, the workshop page, editing by its staff with a link and a PDF, fullscreen, and the read-only view of a confirmed participant who opens the PDF.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A staff member opens the workshop page from the session popup, which names the staff
- [x] #2 The staff member adds a link and a PDF, and the page shows them
- [x] #3 Fullscreen hides the header and the event tabs until it ends
- [x] #4 A confirmed participant sees the items without Edit and opens the PDF
- [x] #5 The scenario leaves the fixture event without staff, also when it fails
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
The Parallel event agenda feature has a workshop scenario. The judge persona becomes staff of the fixture event and of the build session. As that staff member it opens the session popup, which names the staff, opens the workshop page, adds a link and a PDF, and checks that fullscreen hides the app header and the event tabs until it ends. A confirmed participant then sees the items without an Edit button and opens the PDF (200, application/pdf). A tagged After hook removes the staff role, also when the scenario fails. Validation: lint and the full BDD suite (149 + 1) pass. Docs unchanged: the test covers documented behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
