---
id: TASK-442.1
title: Bring the remaining options of the old editor into the event builder
status: Done
assignee:
  - '@claude'
created_date: '2026-11-23T20:34:00Z'
updated_date: '2026-11-23T21:14:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/account/events/AccountEventAdminSettingsPanel.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
modified_files:
  - app/components/account/events/AccountEventAdminSettingsPanel.vue
  - app/components/admin/builder/AdminBuilderWorkspace.vue
  - app/components/admin/builder/molecules/AdminBuilderBlockCard.vue
  - app/components/admin/builder/organisms/AdminBuilderAgendaTrack.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - app/composables/useEventBuilder.ts
  - app/domains/events/builder.ts
  - app/pages/admin/events/builder/[eventId].vue
  - docs/domain-model.md
  - docs/testing-strategy.md
  - tests/bdd/features/authenticated/admin-configuration.feature
  - tests/bdd/features/authenticated/event-builder.feature
  - tests/bdd/steps/admin-configuration.steps.ts
  - tests/bdd/steps/event-builder.steps.ts
  - tests/unit/app/components/admin/lazy-editor-boundaries.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - app/composables/useEventCatalogDraft.ts
  - app/components/admin/organisms/AdminEventCriteriaEditor.vue
  - app/components/admin/organisms/AdminEventPrizesEditor.vue
  - app/components/admin/organisms/AdminEventVisibilityControl.vue
parent_task_id: TASK-442
type: enhancement
ordinal: 205000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the builder was rebuilt as levels and tiles (TASK-487), six things can still be done only in the old editor on the Settings tab: judging criteria, prizes, an exact start and end time for an agenda item, hiding an event, the Luma webhook address with the retry of the Luma setup and the visible API key, and the order of tracks and their resources. Alex asked on 2026-11-23 for every option of the old editor in the builder in a simplified way, and on the same day decided not to wait for the event any longer. The old editor itself stays for now.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin edits, orders and saves the judging criteria of a Hackathon in the builder.
- [x] #2 An event admin edits, orders and saves the prizes of a Hackathon in the builder.
- [x] #3 The old editor and the builder use the same criteria editor and the same prize editor, so both behave the same.
- [x] #4 Each agenda block can get an exact start and an exact end in the builder, and a block can have no end. The blocks after it keep their durations and their gaps.
- [x] #5 An event admin hides an event with a reason and makes it visible again in the builder.
- [x] #6 The Luma extra offers a retry when the Luma setup failed and can show the API key while it is typed.
- [x] #7 Tracks and the resources of a track can be moved up and down in the builder.
- [x] #8 Unit tests, browser tests and the canonical docs cover the new options.
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
1. Move the criteria editor and the prize editor out of the old settings panel into two shared organisms with one shared draft composable (useEventCatalogDraft) and the shared sortable helper. The old panel and the builder both render them.
2. Builder extras: "Judging criteria" and "Prizes" (Hackathon, saved event, own save button), and "Hide event" (saved event). The hide control moves out of the old panel into one shared organism as well.
3. Agenda block details: "Starts at" and "Ends at" next to the description. A new start changes the gap before the block; a new end changes its duration; an empty end means no end. The first block starts with the event.
4. Luma extra: webhook address with copy, retry of the Luma setup when it failed, and a show/hide button on the API key field.
5. Tracks extra: buttons to move a track and a resource up and down.
6. Tests (unit for the block times, browser scenarios for criteria, prizes, hide event, times, Luma details and track order), docs, and all checks.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Finding on 2026-11-23: the Luma webhook address with its status block and its retry button exists in the code of the old form, but the Settings tab has not shown it since TASK-432.5.4 (commit f0f554f8): the account event pages build the admin event with an empty app base URL, so lumaWebhookUrl is always null there, and the old form hides the block without it. The builder therefore gets the retry (in the warning of a connection that is not configured) and the show/hide button of the API key, and no webhook address. Showing the address would need the settings page to send it.

Built on 2026-11-23.

One implementation for both editors: the criteria editor, the prize editor and the hide control moved out of AccountEventAdminSettingsPanel.vue (1,498 lines before, 595 after) into app/components/admin/organisms (AdminEventCriteriaEditor, AdminEventPrizesEditor, AdminEventVisibilityControl). The draft logic of criteria and prizes is the composable useEventCatalogDraft; sorting uses the shared useAdminSortableLists instead of hand-written Sortable code. The old workspace shows the criteria and the hide control on the Settings tab and the prizes on the Prizes tab, through the same panel. The two editors no longer lock each other while one saves, and the prize editor shows its own save error.

Builder: three more extras (app/domains/events/builder.ts): "Judging criteria" and "Prizes" for a Hackathon and "Hide event" for every type, all for a saved event and all with their own save, so the save bar is hidden while one is open. The tiles count the saved criteria and prizes and say "Hidden". The edit page warns before leaving while criteria or prizes hold a change that is not saved.

Exact times: the details of an agenda block (the chevron) now hold "Starts at" and "Ends at" next to the description. setBlockStart and setBlockEnd in app/domains/events/builder.ts own the rules: a start changes the pause before the block, an end changes the duration, and a block that loses its end or gets one again leaves the later blocks where they are as long as the pause is long enough. A block without an end shows "No end" instead of the duration buttons. The first block starts with the event, so its start changes the event start.

Luma: the API key field has a show/hide button, and the warning of a connection that is not configured has "Try again" (POST /luma/actions/retry-configuration).

Tracks: buttons move a track and a resource of a track up and down; the track name field is bound to its label.

No new component kind: the three organisms hold code that already existed in the old settings panel.

Sorting library: the browser request check "unrelated account event tabs should not request editor or sortable chunks" failed for the Prizes tab once the prize editor used the shared sortable helper, because the helper loads the library as soon as the list is on the page. The criteria editor and the prize editor now turn sorting on only for a list with two rows or more, so an empty or one-row list loads nothing (the old code loaded it only after the list changed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event builder now has the options that only the old editor had: judging criteria and prizes of a Hackathon (two new extras), hiding an event and making it visible again (a new extra), an exact start and end for each agenda block including a block without an end (in the details of a block), a retry of a failed Luma setup and a show/hide button on the Luma API key, and buttons that move tracks and their resources up and down.

The criteria editor, the prize editor and the hide control are one implementation for both editors: they moved out of the old settings panel (1,498 lines before, 595 after) into three shared organisms with one draft composable, and the old Settings tab and Prizes tab render the same parts.

Checks on 2026-11-23: lint and type check pass; 722 unit tests and 775 integration tests pass; 145 browser tests pass, including the old criteria scenario and new scenarios for criteria, a prize, hide and unhide, an exact start, a removed end, the order of two tracks and the visible API key. Checked in a real browser on the local preview at 1440 px and 390 px, in the light and the dark theme, in the builder and on the old Settings and Prizes tabs.

Found and fixed on the way: the first full run failed the browser check that tabs other than Settings load no sorting library, because the prize editor loaded it on the Prizes tab; the two editors now load it only for a list with two rows or more. The account deletion scenario of the separate destructive group failed once with a protocol error when the test read a response body after a reload; it passed in two reruns and does not touch this change.

Not done and not checked: (1) The Luma webhook address is not shown; the old Settings tab has not shown it since TASK-432.5.4 either, because the settings data carries no address. (2) "Try again" for a failed Luma setup has no browser test (no fixture with a failed setup); the route existed before. (3) Dragging criteria or prizes with the mouse was not tested in the browser; the arrow buttons were. (4) The criteria and prize rows keep the look of the old editor inside the builder. (5) The old editor is still there: removing it, its entry points and its logic is the open part of TASK-442.
<!-- SECTION:FINAL_SUMMARY:END -->
