---
id: TASK-481
title: Represent unresolved session and page reads explicitly across the Vue app
status: Done
assignee:
  - '@codex'
created_date: '2026-11-22T21:53:00Z'
updated_date: '2026-11-22T22:10:00Z'
labels: []
dependencies: []
ordinal: 197000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Signed-in visitors see login controls during public rendering. Failed or unfinished reads also produce incorrect navigation, empty messages, and editable defaults across account and event screens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public pages stay cacheable and usable while the shared session resolves, and confirmed identity and workspace access drive private actions.
- [x] #2 Loading and failed reads cannot produce false empty, missing or denied states or overwrite early edits across affected views.
- [x] #3 Route guards, cache isolation, cancellation and single-request navigation are preserved, with delayed and failed responses verified in the browser.
- [x] #4 Automated authentication checks use fixture identities and can run without starting the host Codex login or reading the developer account.
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
Make the shared session expose only committed identity, migrate consumers, simplify event entry, and model initial reads, errors and editable data explicitly. Verify with browser scenarios and the repository validation suite.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The pre-change Chromium checks reproduced the signed-in header and Register link, a failed public document read reported as unpublished, and a saved support email replacing text typed during a delayed read. The shared PublicLegalDocument presentation replaces the matching terms and privacy page templates, keeping each route responsible for its read. Alex approved focused component restructuring and removal of the Groma experiment. Automated auth checks use fixture identities and cannot spawn the host Codex CLI.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Public pages share one client session read and reserve account controls until identity is known. Account, event, legal and judging pages represent loading and errors explicitly. Settings and event drafts preserve edits during reads. Removed the experimental Groma map and its publishing workflows. Lint, typecheck, 723 unit tests, 767 integration tests and 135 browser scenarios passed on the scoped changes in a separate checkout. The browser suite used fixture accounts. A separate executable guard recorded zero attempts to start the host Codex CLI. The source of the previously reported ChatGPT prompt is unconfirmed.
<!-- SECTION:FINAL_SUMMARY:END -->
