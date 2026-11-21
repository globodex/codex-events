---
id: TASK-453
title: Simplify Nuxt reads and protect data during authorization changes
status: In Progress
assignee: []
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-21T15:51:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - AGENTS.md
  - docs/testing-strategy.md
  - TASK-432
type: enhancement
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The site has overlapping wrappers and manual request orchestration. Align reads with Nuxt's data APIs and preserve the product's authorization, database bookmark and retry rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Protected data is cleared before a new authorization generation renders or runs a request. Pending old requests are canceled.
- [x] #2 Account tab changes load only the active page with centralized activation and cancellation. A tab switch does not refresh the shared account bootstrap.
- [x] #3 Use one shared protected read path and one bootstrap wait. Preserve D1 bookmark handling, request ownership and explicit refresh after writes.
- [x] #4 Independent public reads run concurrently while preserving server rendering, cache behavior and tab visibility.
- [x] #5 Audit the remaining page and action reads for avoidable fan-out, stale responses and duplicate loads. Record any separately scoped changes.
- [ ] #6 Review changes in a small GitHub PR stack with behavior checks at the appropriate layer.
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
In-progress branch work covers clearing authorization data, active-tab gates, shared protected readers and parallel homepage and event-detail reads. Verify behavior before finalizing the task.

Keep registration-entry request consolidation with TASK-448. The public workspace link still uses the per-event access read. Sharing its event list across slugs would need invalidation after application writes.

Draft PRs #6 through #10 cover authorization changes, active tabs, shared protected reads, team workspace reads, and public page reads. The stack passed lint, type checking, 725 unit tests, 508 integration tests, and 102 browser scenarios. Nuxt 4.6.4 and Vite 8.3.8 are already locked. Account tabs use Nuxt reactive request gating. The installed Vue 3.5 compiler emits virtual DOM for Vapor-tagged components. Nuxt Vapor support is opt-in for components and pages with a compatible Vue release.
<!-- SECTION:NOTES:END -->
