---
id: TASK-483
title: Simplify how event pages load, edit and save their data
status: Done
assignee:
  - '@codex'
created_date: '2026-11-22T22:36:00Z'
updated_date: '2026-11-24T21:52:00Z'
labels: []
dependencies: []
modified_files:
  - app/pages/index.vue
ordinal: 199000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Public pages load code and data for hidden sections. Several workspaces duplicate drafts and page records or repeat database and pagination reads, so a successful action can show old data. Keep the changes that make those workflows faster, easier to follow and reliable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public pages request only the data and code needed for the selected view and preserve direct links, caching and section errors.
- [x] #2 Affected workspace reads avoid repeated data access and affected actions keep one clear owner for saved state and edits.
- [x] #3 Two independent junior-developer simplicity reviews are completed, one with conversation context and one without, and their actionable concerns are resolved.
- [x] #4 Automated checks use isolated fixtures and the refactor passes the repository validation suites.
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
Reused existing event cards, gallery, team forms, Markdown renderer, and alert controls. The team directory, detail view and writes use the same Teams page data. The optional public team route replaces both redirect pages. The existing AppAlert owns the shared Retry action.

The cache policy in the API guide now matches the documented split Worker configuration. The two reviewers independently traced stored reads after registration, event renames, assignment grading, program saves and participant decisions. Regression checks exercise repeat visits and edits in the same browser session.

EventOverviewPanel is the shared description card on public and account pages. EventOverviewSection groups the existing public overview panels so Nuxt can load them from one entry only when used. The event detail response also powers the header and the public WebMCP event-details reader on every tab.

Both reviewers rechecked the final program and floor-plan write paths. A successful write expires its original event even after navigation. The fresh reviewer confirmed that keeping full event details for the header and WebMCP lets the public tabs share one read. Catalog rows keep each acknowledged write when another row fails. A lost create response remains ambiguous because the API has no idempotency key.

Fixed on 2026-11-24 after the v1.21.0 release: the home page showed "Events are temporarily unavailable" on Cloudflare (production and the test environment). This task changed the home page from useFetch to useAsyncData with a plain $fetch. On the server a plain $fetch makes an internal request without the Cloudflare context of the page request, so getD1Binding finds no D1 binding and /api/public/discovery answers 500 database_binding_missing. The local dev server adds that context to every request, so local runs and the browser scenarios passed. The page now calls the API with useRequestFetch(), which hands the context on during server rendering and is the normal $fetch in the browser. No other server-rendered page calls $fetch during rendering.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Public discovery returns four cards at a time and its tab links work before hydration. Public event tabs load their own sections. Workspaces use shared reads, keep drafts across refreshes and expire affected reads after writes and navigation. Talk and project submissions persist the visible fields with their new status. Both junior-developer reviewers rechecked their findings and reported none remaining. Lint and Nuxt typecheck passed along with 716 unit, 770 integration and 143 browser tests. Test processes used isolated fixture accounts and made zero attempts to invoke host Codex. The offline Cloudflare production build passed. Its public overview excludes the Markdown parser (38,066 bytes gzip) and the account menu dependencies (29,027 bytes gzip) from the initial JavaScript. These are bundle measurements. The canonical public event data remains shared by the header and WebMCP. Unknown create outcomes after a lost response still require checking the saved catalog.

2026-11-24: the home page calls the discovery API with useRequestFetch() so that server rendering on Cloudflare has the database binding (fix for "Events are temporarily unavailable" after v1.21.0).
<!-- SECTION:FINAL_SUMMARY:END -->
