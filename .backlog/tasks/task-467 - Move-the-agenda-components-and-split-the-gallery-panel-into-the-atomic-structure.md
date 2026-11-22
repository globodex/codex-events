---
id: TASK-467
title: >-
  Move the agenda components and split the gallery panel into the atomic
  structure
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T11:01:00Z'
updated_date: '2026-11-22T11:44:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventProgramFloorPlan.vue
  - app/components/account/events/molecules/AccountEventProgramSession.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/organisms/AccountEventProgramTimeline.vue
  - app/components/events/EventGalleryPanel.vue
  - app/components/events/molecules/EventGalleryPhotoCard.vue
  - app/components/events/molecules/EventGalleryUploadStatus.vue
  - app/pages/account/events/[slug]/index.vue
  - stories/features/AccountEventProgramAgenda.stories.ts
  - stories/features/AccountEventProgramFloorPlan.stories.ts
  - stories/features/AccountEventProgramTimeline.stories.ts
  - app/components/account/events/AccountEventProgramFloorPlan.vue
  - app/components/account/events/AccountEventProgramSession.vue
  - app/components/account/events/AccountEventProgramAgenda.vue
  - app/components/account/events/AccountEventProgramTimeline.vue
type: chore
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
AGENTS.md asks for an atomic component tree and for Alex's approval before components that predate the rule are migrated. Alex approved two migrations on 2026-11-22: the four agenda components of the participant Agenda tab (TASK-461), and the shared gallery panel, which grew to about 700 lines with the participant photo section (TASK-451).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The four agenda components live in molecules or organisms folders and every caller is updated, without aliases.
- [x] #2 The gallery panel is split into smaller components with one clear job each, and the panel composes them.
- [x] #3 The screens look and behave as before; the browser suite passes without changed expectations.
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
1. Move the participant Agenda components: the session card and the floor plan to molecules, the timeline and the agenda panel to organisms; update the imports, the lazy component name on the event page, and the stories.
2. Gallery panel: extract the photo card and the upload status line into molecules next to the panel; the panel keeps the upload, filter and lightbox logic and composes them. Same markup and classes, so the screens do not change.
3. Validate with the full browser suite and a look at the Agenda tab and the gallery in the local preview.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in the main session on 2026-11-22. Agenda: the session card and the floor plan are molecules (app/components/account/events/molecules), the timeline and the agenda panel are organisms (app/components/account/events/organisms); imports, the lazy component name on the account event page and the three stories follow. Gallery: EventGalleryPhotoCard (one photo with its controls) and EventGalleryUploadStatus (the uploading line, used twice before) are molecules in app/components/events/molecules; the panel went from 708 to 495 lines and keeps the upload, filter and photo viewer logic. Markup and classes are unchanged. Canonical docs name no component paths, so they are unchanged; no behavior changed, so no tests were added. Validation: lint, typecheck, unit (738), integration (723), browser suite (126 plus 1) with unchanged expectations, git diff --check; the Agenda tab and the organizer gallery were checked in the local preview. Not run: the Storybook build (the stories are type-checked).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The four components of the participant Agenda tab now live in the atomic folders, and the shared gallery panel is split: the photo card and the upload status line are their own components. Nothing looks or behaves differently.

Verification: lint, typecheck, unit, integration and the full browser suite pass without changed expectations; checked in the local preview.

Risks and follow-ups: none known. The gallery panel still owns upload, drag and drop, filters and the photo viewer; a further split is possible if it grows again.
<!-- SECTION:FINAL_SUMMARY:END -->
