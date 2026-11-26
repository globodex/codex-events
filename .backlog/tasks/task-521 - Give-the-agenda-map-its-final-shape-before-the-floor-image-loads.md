---
id: TASK-521
title: Give the agenda map its final shape before the floor image loads
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T23:03:00Z'
updated_date: '2026-11-26T23:07:00Z'
labels: []
milestone: m-3
dependencies: []
type: bug
ordinal: 238000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-27 Alex noticed that the map on the Agenda tab opens as a larger box and then shrinks. The map used a portrait 3:4 placeholder until the browser knew the image size, and the Vienna plan is wide. The server now reads the pixel size of each floor plan image when it is uploaded or replaced, stores it, and sends it with the floor plans, so the map has its final shape from the start. The one existing production plan gets its size when its image is replaced once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Uploading or replacing a floor plan image stores its width and height, read from the PNG or JPEG header; an image without a readable size is refused
- [x] #2 Floor plans carry imageWidth and imageHeight, and the map uses that shape before the image loads
- [x] #3 Docs and tests cover the size reading and the recorded size
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map on the Agenda tab keeps its final shape from the start. The server reads the pixel size of a floor plan image from its PNG or JPEG header when it is uploaded or replaced (readImageSize in server/utils/image-signatures.ts), stores it in event_floor_plans.image_width and image_height (migration 0096), and sends imageWidth and imageHeight with each floor plan; the map uses that shape until the image loads. An image whose size cannot be read is refused. A plan stored before has null until its image is replaced; production has one such plan (Vienna), replaced once after the deploy. Validation: lint, typecheck, unit (728, new size reading tests), integration (all), full BDD (149 + 1).
<!-- SECTION:FINAL_SUMMARY:END -->
