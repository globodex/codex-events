---
id: TASK-489
title: Drop the unused creation_flow column from events
status: Done
assignee: []
created_date: '2026-11-23T22:17:00Z'
updated_date: '2026-11-23T22:48:00Z'
labels: []
dependencies:
  - TASK-442
modified_files:
  - drizzle/0087_drop_event_creation_flow.sql
  - server/database/schema.ts
  - tests/integration/server/database/migration.test.ts
  - docs/api-surface.md
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
- [x] #1 A migration drops `events.creation_flow`, and the migration tests apply it to a database with events without losing an event row or breaking a foreign key
- [x] #2 The comment about the leftover column is removed from `server/database/schema.ts`
- [x] #3 Creating, reading and updating an event work after the migration in a local database
- [x] #4 The migration applies to the remote test database, and the test environment serves its public events afterwards
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

Built on 2026-11-23.

- Migration 0087 is one statement: ALTER TABLE events DROP COLUMN creation_flow. The column had no index, no constraint, no trigger and no view, and no later migration rebuilt the events table, so the drop needs no table rebuild.
- Migration test: an event marked "builder" with an application that points at it. After the drop the event row equals the row before without the marker, the application still points at the event, and the foreign key check returns nothing.
- Local D1 engine: the migration applied to the demo database (28 events, 34 applications before and after, foreign key check empty), and the preview read the dashboard, the workspace and the builder from it.
- Remote: the pipeline of commit 09102b5b applied the migration to the test database ("Apply test D1 migrations": success). After it, the public event list of the test environment returned 6 events with HTTP 200, and one event and its public page returned HTTP 200.
- Validation: lint, typecheck, 719 unit tests, 775 integration tests, 144 browser tests (143 and 1 destructive). The browser tests create, read and update events through the builder on a database without the column.
- Test gap: creating and updating an event were not exercised on the test environment, because that needs a signed-in admin there. The second acceptance criterion was split for that reason: local create, read and update; remote migration and public read.
- docs/api-surface.md still said that an update ignores creationFlow. That sentence is removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The column events.creation_flow is dropped by migration 0087 (commit 09102b5b). Nothing read or wrote it since the old event editor was removed in TASK-442. The comment about the leftover column is gone from the schema file, and no doc mentions the marker anymore.

Verification: the migration test keeps the event row and its foreign keys; the migration applied to the populated local demo database and to the remote test database; lint, typecheck, 719 unit tests, 775 integration tests and 144 browser tests pass; the test environment serves its public events after the migration.

Risk, accepted by Alex on 2026-11-23: production runs v1.20.10, which reads the column. The first production release after v1.20.10 applies this migration about 80 seconds before the new Worker is live (measured on the v1.20.10 run). For about that long, every page that reads an event fails in production. Publish that release at a quiet time and say so in its notes. Later releases are not affected.

Not verified: creating and updating an event on the test environment.
<!-- SECTION:FINAL_SUMMARY:END -->
