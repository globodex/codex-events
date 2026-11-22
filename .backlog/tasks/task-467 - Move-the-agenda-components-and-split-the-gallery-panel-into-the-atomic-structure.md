---
id: TASK-467
title: >-
  Move the agenda components and split the gallery panel into the atomic
  structure
status: To Do
assignee:
  - '@claude'
created_date: '2026-11-22T11:01:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
type: chore
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AGENTS.md asks for an atomic component tree and for Alex's approval before components that predate the rule are migrated. Alex approved two migrations on 2026-11-22: the four agenda components of the participant Agenda tab (TASK-461), and the shared gallery panel, which grew to about 700 lines with the participant photo section (TASK-451).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The four agenda components live in molecules or organisms folders and every caller is updated, without aliases.
- [ ] #2 The gallery panel is split into smaller components with one clear job each, and the panel composes them.
- [ ] #3 The screens look and behave as before; the browser suite passes without changed expectations.
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
