---
id: TASK-440
title: Add native WebMCP event tools
status: Done
assignee:
  - '@codex'
created_date: '2026-08-25 21:47'
updated_date: '2026-08-25 22:03'
labels: []
dependencies: []
references:
  - 'https://learn.chatgpt.com/docs/webmcp'
modified_files:
  - app/composables/useWebMcpTool.ts
  - app/domains/events/webmcp.ts
  - 'app/pages/events/[slug]/index.vue'
  - app/pages/admin/events/builder/new.vue
  - docs/mcp.md
  - tests/unit/app/composables/useWebMcpTool.test.ts
  - tests/unit/app/domains/events/webmcp.test.ts
  - tests/bdd/features/public/webmcp-events.feature
  - tests/bdd/features/authenticated/webmcp-events.feature
  - tests/bdd/steps/webmcp-events.steps.ts
priority: high
type: feature
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Let Codex work with Codex Events through native WebMCP site tools. On a public event page, Codex can read the canonical details already shown on that page. On the protected new-event builder page, an authorized event organizer or platform admin can create a draft event through the existing validated event creation flow. The integration remains page-scoped, uses the signed-in browser session, and does not replace the existing Agent Plugin MCP server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A supported browser visiting a public event detail page discovers one read-only get_event_details site tool that returns the current canonical public event details.
- [x] #2 A supported browser visiting the new-event builder page discovers create_event only when the loaded actor can create events.
- [x] #3 Anonymous users and actors without event-organizer or platform-admin authority never receive create_event.
- [x] #4 create_event accepts a compact documented event draft contract, validates it, creates the event through the existing POST /api/events flow, and returns the created event and its platform URL.
- [x] #5 Server-side event authorization and validation remain authoritative for every create_event call.
- [x] #6 Site tools are removed when their page or current authority is no longer active, and browsers without WebMCP continue to use the normal interface without errors.
- [x] #7 Unit and browser-level tests cover discovery, role filtering, input validation, successful reads and creation, cleanup, and unsupported browsers.
- [x] #8 Canonical MCP documentation explains the separate roles of page-scoped WebMCP and the independent Agent Plugin MCP server.
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
1. Add an events-domain WebMCP contract module with the two tool descriptors, compact strict create-event Zod/JSON schema, and mapping through createEmptyEventFormState, eventConfigFormSchema, and buildEventCreateBody.
2. Add one focused client composable that feature-detects document.modelContext.registerTool, registers the current page tool with an AbortController, replaces it on reactive changes, and unregisters it on authority loss or unmount.
3. Wire get_event_details into the public event detail route from its already-loaded PublicEvent value, and wire create_event into the protected builder route only after the shared account bootstrap is ready and canCreateEvent is true; execute creation through useApiClient POST /api/events and return the created event with its account workspace URL.
4. Add focused unit tests for compact validation/mapping and registration lifecycle, plus Playwright BDD coverage with an injected fake modelContext for exact page discovery, public read parity, creator/unauthorized filtering, valid persistence, and invalid-input non-persistence.
5. Update docs/mcp.md to distinguish page-scoped WebMCP from the independent MCP server, run all required validation suites, audit the diff, finalize TASK-440 with evidence, then commit and push directly to origin/main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented native page-scoped WebMCP support with exactly two tools. The public event page registers read-only get_event_details from its already-loaded PublicEvent and marks organizer-authored output as untrusted content. The protected new-event builder registers create_event only after the shared bootstrap reports canCreateEvent, rechecks authority at execution, maps the strict compact draft through existing event-form defaults and validation, and posts through the session-authenticated /api/events endpoint. The lifecycle aborts registrations on replacement, authority loss, and unmount; unsupported browsers are a quiet no-op. Added focused unit and browser coverage and updated docs/mcp.md.

Validation evidence:
- bun run lint: passed
- bun run typecheck: passed
- bun run test:unit: 174 files, 1152 tests passed
- bun run test:integration: 44 files, 496 tests passed
- bun run test:bdd: regular/authenticated 95 passed; destructive 2 passed
- git diff --check: passed
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added native page-scoped WebMCP event tools without changing the normal interface or the independent MCP server. get_event_details exposes the current public event only on its detail page and labels organizer-authored output as untrusted. create_event is capability-gated on the protected builder, uses the existing client mapping and authoritative session-authenticated API, and returns the created draft with its Codex Events URL. Unit and real-browser tests cover discovery, exact tool scope, read parity, role filtering, lifecycle cleanup, unsupported browsers, successful persistence, and invalid-input non-persistence. All required validation suites pass. No test gap or setup change remains. Risk is limited to WebMCP browser availability; unsupported browsers intentionally remain a no-op. No follow-up is required.
<!-- SECTION:FINAL_SUMMARY:END -->
