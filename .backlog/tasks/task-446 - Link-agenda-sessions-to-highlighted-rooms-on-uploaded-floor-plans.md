---
id: TASK-446
title: Link agenda sessions to highlighted rooms on uploaded floor plans
status: Done
assignee: []
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-21T16:54:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-445
references:
  - docs/permissions-matrix.md
  - >-
    https://github.com/MrLesk/codex-build-vienna/blob/main/07-rooms-tu-wien-karlsplatz.md
  - https://maps.tuwien.ac.at/?q=AEU141
  - >-
    https://www.tuwien.at/fileadmin/Assets/dienstleister/gebaeude_und_technik/Veranstaltungen/Studierendenfeste/Veranstaltungsflaechen_FS-Feste_Karlsplatz.pdf#page=2
type: feature
ordinal: 164000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Ambassadors need to provide their own static venue plans. Participants should be able to select an agenda item and immediately see the room it uses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin can upload or replace their own static plan images, name the floors and rooms, and mark each room area once on the relevant image.
- [x] #2 Sessions select a reusable room record and display its name. Choosing a session highlights the room area and shows the right floor.
- [x] #3 The agenda is on the left and the plan is on the right on larger screens. On phones the selected map is reachable from the agenda item.
- [x] #4 Confirmed participants can view the plan before check-in. Pending registrations and direct unauthenticated file requests cannot view it.
- [x] #5 The full plan remains readable without cropping labels. Uploading or replacing a plan preserves unsaved agenda edits.
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction preview verified in Chromium on desktop and mobile. It uses sample sessions and an illustrative venue schematic. Production upload, room-area editing and protected access are tracked by the acceptance criteria.

The floor editor reuses the existing event image picker and App controls. A separate room editor is needed to mark reusable map rectangles. Selecting a session highlights its room on the correct floor. Protected images stream at their full aspect ratio. Replacing an image updates only that floor, preserving event and schedule drafts.
<!-- SECTION:NOTES:END -->
