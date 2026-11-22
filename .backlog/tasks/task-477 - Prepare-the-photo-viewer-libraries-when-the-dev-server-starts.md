---
id: TASK-477
title: Prepare the photo viewer libraries when the dev server starts
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T20:43:00Z'
updated_date: '2026-11-22T20:56:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - nuxt.config.ts
modified_files:
  - nuxt.config.ts
type: bug
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-22 Alex got 'null is not an object (evaluating currentRenderingInstance.ce)' in Safari on the local preview. The dev server log shows that error from his browser right before 'Vite discovered new dependencies at runtime: photoswipe, photoswipe/lightbox' for EventGalleryPanel.vue. The gallery loads the photo viewer on first use, and the dev server then bundled it while the page was open. The other libraries that load late are already in vite.optimizeDeps.include for this reason (commit 510d114b); the photo viewer from TASK-451 was missing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The dev server prepares photoswipe and photoswipe/lightbox at its start and does not discover them when the Gallery is opened.
- [x] #2 Opening the Gallery from another tab and opening a photo works without a page error on a dev server that started with an empty dependency cache.
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
1. Add photoswipe and photoswipe/lightbox to vite.optimizeDeps.include in nuxt.config.ts.
2. Start the preview with an empty dependency cache, go from the Agenda tab to the Gallery tab, open a photo, and read the page errors and the server log.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reproduction: the error did not appear in Chromium, neither with the old list and an empty dependency cache (Agenda tab, then Gallery tab, then a photo) nor on a fresh load of the Agenda tab in Safari. So the exact trigger in Safari is not proven. The link to the late bundling of the photo viewer rests on the server log of 21:36, where the two lines stand next to each other. With the new list and an empty cache the four photoswipe files exist before the Gallery is opened, the same walk-through shows no page error, no console error and no failed request, and the server log has no 'discovered new dependencies' line.

Validation (2026-11-22): bun run lint passed; bun run typecheck passed; bun run test:unit 143 files, 728 tests passed; bun run test:bdd 126 passed plus 1 destructive passed, and the server log of that run has no 'discovered new dependencies' line; git diff --check clean. The change touches only the dev server's dependency list, so no test was added. Test gap: the Safari error itself could not be reproduced, so no test proves that it is gone.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added photoswipe and photoswipe/lightbox to vite.optimizeDeps.include in nuxt.config.ts, next to the other libraries that load late. The dev server now prepares the photo viewer at its start: with an empty dependency cache the four photoswipe files exist before the Gallery is opened, the walk from the Agenda tab to the Gallery and into a photo shows no page error, and the server log has no late-bundling line. This removes the dev-server event that stood next to the Safari error 'null is not an object (evaluating currentRenderingInstance.ce)' in the log. Risk: the error was never reproduced, neither in Chromium nor on a fresh load in Safari, so the cause is likely but not proven; if it comes back, the page and the click that showed it are needed. Production builds do not use this list.
<!-- SECTION:FINAL_SUMMARY:END -->
