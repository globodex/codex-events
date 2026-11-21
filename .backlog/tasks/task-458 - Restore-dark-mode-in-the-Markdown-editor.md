---
id: TASK-458
title: Restore dark mode in the Markdown editor
status: Done
assignee:
  - '@codex'
created_date: '2026-11-21T17:36:00Z'
updated_date: '2026-11-21T18:09:00Z'
labels: []
dependencies: []
references:
  - app/components/admin/AdminMarkdownEditorClient.client.vue
  - tests/bdd/features/authenticated/event-builder.feature
  - tests/bdd/steps/event-builder.steps.ts
modified_files:
  - tests/bdd/features/authenticated/event-builder.feature
  - tests/bdd/steps/event-builder.steps.ts
  - app/components/admin/AdminMarkdownEditorClient.client.vue
type: bug
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Event organizers see light editor text and controls against a white background in dark mode, including in the event Description field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The shared Markdown editor has the correct background in light and dark modes and updates when the user switches themes.
- [x] #2 Browser coverage verifies the actual editor background and keeps the Markdown preview visible.
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
1. Reproduce the editor background issue through the event builder in Chromium.
2. Match the dark theme selector used by the installed editor.
3. Verify theme switching and run the required checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The editor uses a data-theme attribute to mark dark mode. Chromium reproduced the white surface before the selector change and passed the light-to-dark-to-light check afterward, with the rendered Markdown preview visible. The Cloudflare build contains the corrected scoped selector.

Three local API tests hit time limits under heavy machine load and passed on a targeted retry. The standard backend checks passed on GitHub. A separate account overview navigation test failed in the first full browser run, passed in the focused workflow, and passed in the full-suite retry.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The shared Markdown editor follows the current library dark theme selector. The event builder browser scenario verifies the background in light and dark modes and checks that the preview remains visible. Lint, type checking, unit and integration checks, the Cloudflare build, CodeQL, and all 102 browser scenarios passed. The test site serves the corrected stylesheet from c022fe76. [Full browser suite](https://github.com/globodex/codex-events/actions/runs/44932135688) · [Test deployment](https://github.com/globodex/codex-events/actions/runs/44932117739)
<!-- SECTION:FINAL_SUMMARY:END -->
