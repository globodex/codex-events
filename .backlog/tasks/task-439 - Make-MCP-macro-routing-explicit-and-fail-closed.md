---
id: TASK-439
title: Make MCP macro routing explicit and fail closed
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-22 18:47'
updated_date: '2026-08-22 19:02'
labels: []
dependencies: []
priority: high
type: enhancement
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make every MCP operation declare its business domain so macro routing cannot silently choose the wrong tool. Move prize actions from the event macros to the participation macros. Keep role-filtered discovery, exact input validation, server-side authorization, and the public macro tool set stable apart from this approved move. Simplify actor resolution and mutation auditing so execution and audit use the same selected action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every MCP-eligible operation declares exactly one approved domain: events, participation, judging, or administration.
- [x] #2 Prize actions are exposed through participation_read or participation_upsert and are absent from events_read and events_upsert.
- [x] #3 No regex-based or default domain routing remains.
- [x] #4 Role-filtered action discovery and exact server-side authorization remain fail closed.
- [x] #5 Mutation auditing uses the same validated action selected for execution and cannot depend on reparsing the raw RPC body.
- [x] #6 The MCP request actor is resolved once and reused.
- [x] #7 Unused per-operation MCP tool names and hard-coded operation totals are removed.
- [x] #8 Required lint, typecheck, unit, integration, and BDD validation passes.
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
1. Add an explicit required domain to each MCP operation and group macro actions only by that field.
2. Move prize actions to participation macros while preserving capabilities and exact schemas.
3. Reuse one resolved actor and make mutation audit consume the validated selected action from execution.
4. Remove unused toolName metadata and derive generated totals instead of storing magic numbers.
5. Add invariant and role-catalog tests, update canonical docs where the approved prize grouping is described, and run all required validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented explicit operation domains across every MCP-eligible structured route and removed per-operation toolName metadata. Macro grouping now uses only the operation domain and existing effect. Exact persona snapshots verify unchanged permissions and the approved prize move. Mutation integration coverage verifies successful and failed audits from the selected operation, and actor coverage verifies one resolution per request. Final validation passed: bun run lint; bun run typecheck; bun run test:unit with 172 files and 1,143 tests; bun run test:integration with 44 files and 496 tests; bun run test:bdd with 92 regular and 2 destructive browser tests; and git diff --check. No automation gaps, setup changes, task-specific risks, or follow-up work remain.

The first pull request head failed CI lint because the Linux CI rule requires parentheses around the Promise resolver arrow argument in server/routes/mcp.post.ts. The duplicated push and pull-request runs reported the same deterministic finding. The task was reopened for the scoped correction before review and merge.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Made MCP macro routing explicit and fail closed by requiring one approved domain on every eligible operation, grouping only by domain and effect, and moving all prize operations to participation macros. Reused one resolved actor, made mutation auditing consume the same selected operation as execution, removed unused operation tool names, and derived operation totals from the manifest. Updated canonical MCP and testing docs and verified the complete lint, typecheck, unit, integration, and BDD suites.
<!-- SECTION:FINAL_SUMMARY:END -->
