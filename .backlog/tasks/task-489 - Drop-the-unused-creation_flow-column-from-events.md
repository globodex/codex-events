---
id: TASK-489
title: Drop the unused creation_flow column from events
status: In Progress
assignee: []
created_date: '2026-11-23T22:17:00Z'
updated_date: '2026-11-23T22:34:00Z'
labels: []
dependencies:
  - TASK-442
modified_files:
  - drizzle/0087_drop_event_creation_flow.sql
  - server/database/schema.ts
  - tests/integration/server/database/migration.test.ts
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
- [ ] #1 A migration drops `events.creation_flow`, and the migration tests apply it to a database with events without losing an event row or breaking a foreign key
- [ ] #2 Creating, reading and updating an event work after the migration in the local database and in the test environment
- [ ] #3 The comment about the leftover column is removed from `server/database/schema.ts`
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add migration 0087 that drops events.creation_flow.
2. Add a migration test that applies it to a database with an event that other rows reference, and checks that the column is gone, the event row is unchanged and no foreign key is broken.
3. Remove the comment about the leftover column from server/database/schema.ts.
4. Apply the migration to the local demo database, then run lint, typecheck, unit, integration and browser tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision by Alex on 2026-11-23: the migration goes to main now and ships in the next production release together with the code that stopped reading the column (TASK-442). He was told the cost before he chose: production runs v1.20.10, which reads the column, and the last release applied its migrations about 80 seconds before the new Worker was live (run of v1.20.10: migrations 13:22:59 to 13:23:03, Worker deploy 13:23:03 to 13:24:25). For about that long during the next release, every page that reads an event fails in production. The first acceptance criterion (release first) is removed for that reason.
<!-- SECTION:NOTES:END -->
