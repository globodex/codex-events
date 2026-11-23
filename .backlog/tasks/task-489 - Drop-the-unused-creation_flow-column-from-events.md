---
id: TASK-489
title: Drop the unused creation_flow column from events
status: To Do
assignee: []
created_date: '2026-11-23T22:17:00Z'
labels: []
dependencies:
  - TASK-442
type: chore
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-442 (commit 019d813b, 2026-11-23) nothing reads or writes `events.creation_flow`. The column recorded which editor created an event, and the old editor is gone. The column still exists in every database: migration 0073 added it as `text DEFAULT 'classic' NOT NULL`, so inserts keep working without it in the Drizzle schema.

The column was not dropped together with the code for one reason: a production release applies the D1 migrations before it deploys the new Worker (`.github/workflows/deploy-production.yml`). The Worker that still runs at that moment selects the column by name, so every read of an event would fail between the two steps. Dropping the column is safe only when the Worker that runs during the migration already comes from a release that contains commit 019d813b.

This is the first migration of the repository that drops a column. `server/database/schema.ts` has a comment at the place of the removed column that explains the leftover.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A production release that contains commit 019d813b is live before the migration is merged to main
- [ ] #2 A migration drops `events.creation_flow`, and the migration tests apply it to a database with events without losing an event row or breaking a foreign key
- [ ] #3 Creating, reading and updating an event work after the migration in the local database and in the test environment
- [ ] #4 The comment about the leftover column is removed from `server/database/schema.ts`
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
