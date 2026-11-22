---
id: TASK-478
title: Show open tracks as their own group below the challenges
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T20:49:00Z'
updated_date: '2026-11-22T21:05:00Z'
labels: []
milestone: m-3
dependencies:
  - TASK-476
references:
  - shared/domains/events/challenges.ts
  - app/components/account/events/organisms/AccountEventChallengeList.vue
modified_files:
  - shared/domains/events/challenges.ts
  - app/components/admin/builder/molecules/AdminBuilderChallengeCard.vue
  - app/components/account/events/organisms/AccountEventChallengeList.vue
  - stories/features/fixtures/build-day.fixtures.ts
  - docs/schema-outline.md
  - docs/domain-model.md
  - tests/integration/server/api/event-challenges-routes.test.ts
  - server/application/operations/generated-output-schemas.ts
type: feature
ordinal: 194000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Agenda tab lists the event challenges next to the map. At the Vienna Build Day two entries are not challenges: 'Build your own idea' with a technical and a non-technical track. Alex asked on 2026-11-22 to separate the open track from the four challenges.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In the event builder an organizer can mark an entry of the challenge list as an open track.
- [x] #2 The Agenda tab lists the challenges under 'Challenges' and the open tracks in a second group under 'Open track', each in their saved order.
- [x] #3 An open track behaves like a challenge: it shows its rooms, selecting it highlights them, and Details opens its text.
- [x] #4 An event without an open track looks as before, and an event with open tracks only shows no 'Challenges' heading.
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
1. Model: eventChallengeSchema gets the boolean isOpenTrack, false when it is not stored.
2. Builder: the challenge card gets the checkbox 'List under Open track'.
3. Agenda tab: AccountEventChallengeList.vue renders two groups, 'Challenges' and 'Open track', from the same list.
4. Docs, integration test for the stored flag, browser check, preview data, full validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: eventChallengeSchema has the optional boolean isOpenTrack. An entry without it is a challenge, so stored lists stay as they are.

Builder: the challenge card has the checkbox 'List as open track, below the challenges' under 'Published'.

Agenda tab: AccountEventChallengeList.vue builds two groups from the one list, 'Challenges' and 'Open track', and leaves an empty group out. The cards, the room highlight and the Details popup are the same for both groups.

Local preview: the two 'Build your own idea' entries are open tracks, technical in U1-4 and non-technical in U1-5. Browser check at 1440x900 dark and light and 390x844 light and dark: the first group holds the four challenges, the second the two tracks; selecting the non-technical track highlights U1-5 and names it 'U1-5 · AEU125'. No page errors or console errors.

Test gap: no automated test reads the two group headings. The stored mark is covered by the fixture 'reviewChallenge' of event-challenges-routes.test.ts, which every save and read test compares.

Builder check on the local preview, 2026-11-22: the challenge group lists the six entries with their marks. Ticking 'List as open track, below the challenges' on 'Make a one-minute game' and saving the event returned 200; after a reload the builder showed the mark and the Agenda tab listed the game under 'Open track'. Unticking and saving put it back under 'Challenges'. The stored program and floor plans were the same before and after the two saves; the only stored difference is 'isOpenTrack: false' on the game, which means the same as no mark.

Headings check with a changed server answer (nothing saved): every entry marked gives one group 'Open track' with 6 cards; no entry marked gives one group 'Challenges' with 6 cards. Details of the non-technical track opens with its room 'U1-5 · AEU125' and its text. No page errors.

Validation on the final tree, 2026-11-22: lint and typecheck passed, 728 unit tests, 765 integration tests, 126 + 1 browser tests, git diff --check clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An entry of the challenge list can now be an open track. The event builder has the checkbox 'List as open track, below the challenges' on every challenge card. The Agenda tab shows two groups from the one list: 'Challenges' and 'Open track', each in the saved order, and leaves an empty group out. Cards, room highlight and Details are the same in both groups.

Checked: the builder saves and shows the mark, the Agenda tab moves the entry between the groups, both heading cases, Details of an open track, and the full validation chain (lint, typecheck, unit, integration, browser tests).

No setup or permission change: the mark is saved with the challenge list under the existing rule for editing an event.

Risks and follow-ups: no automated browser test reads the two headings or ticks the builder checkbox; the stored mark is covered by the challenge route tests. In the local preview the technical track is in U1-4 and the non-technical track in U1-5; this mapping is an assumption that Alex should confirm before the real event is set up.
<!-- SECTION:FINAL_SUMMARY:END -->
