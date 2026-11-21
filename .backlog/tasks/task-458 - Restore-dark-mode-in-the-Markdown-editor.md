---
id: TASK-458
title: Restore dark mode in the Markdown editor
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-21T17:36:00Z'
updated_date: '2026-11-21T17:48:00Z'
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
1. Reproduce the editor background issue through the event builder in Chromium.
2. Match the dark theme selector used by the installed editor.
3. Verify theme switching and run the required checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The editor uses a data-theme attribute to mark dark mode. Chromium reproduced the white surface before the selector change and passed the light-to-dark-to-light check afterward, with the rendered Markdown preview visible. The Cloudflare build contains the corrected scoped selector.
<!-- SECTION:NOTES:END -->
