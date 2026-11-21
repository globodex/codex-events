---
id: TASK-456
title: Remove low-complexity unit tests across the repository with cccc
status: Done
assignee: []
created_date: '2026-11-21T15:41:00Z'
updated_date: '2026-11-21T15:45:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - AGENTS.md
  - docs/testing-strategy.md
  - https://github.com/moznion/cccc
type: enhancement
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The unit suite should spend its maintenance cost on behavior that benefits from unit coverage. Apply the existing cognitive-complexity rule consistently across the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Use cccc results to identify unit tests whose production code has cognitive complexity of 5 or less.
- [ ] #2 Remove eligible low-complexity unit tests, retaining tests that exercise regular expressions.
- [ ] #3 Retain direct integration coverage and any unit coverage required by a documented contract.
- [ ] #4 Record any cases cccc cannot score and retain coverage where the result is uncertain.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repository-wide review used cccc scores of the code under test. Removed low-complexity cases while retaining tests for regular expressions, higher-complexity branches, and required security and request contracts. The cleanup branch passed lint, type checking, and all 729 remaining unit tests.
<!-- SECTION:NOTES:END -->
