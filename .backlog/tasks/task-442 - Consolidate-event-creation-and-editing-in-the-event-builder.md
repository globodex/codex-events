---
id: TASK-442
title: Consolidate event creation and editing in the event builder
status: Done
assignee: []
created_date: '2026-11-21T15:22:00Z'
updated_date: '2026-11-23T22:11:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - docs/domain-model.md
  - TASK-435
  - TASK-436
  - TASK-440
modified_files:
  - app/components/AppButton.vue
  - app/components/AppDateTimeInput.vue
  - app/components/account/events/AccountEventAdminSettingsPanel.vue
  - app/components/account/events/AccountEventAdminTermsCard.vue
  - app/components/account/events/AccountEventSimplifiedClaimingControl.vue
  - app/components/admin/AdminEventCreateEditForm.vue
  - app/components/admin/EventConfigApplicationFieldsTable.vue
  - app/components/admin/EventConfigForm.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
  - app/components/admin/builder/organisms/AdminBuilderLumaConnection.vue
  - app/components/admin/organisms/AdminEventCriteriaEditor.vue
  - app/components/admin/organisms/AdminEventPrizesEditor.vue
  - app/components/admin/organisms/AdminEventVisibilityControl.vue
  - app/composables/useEventBuilder.ts
  - app/domains/events/account-workspace-seo.ts
  - app/domains/events/account-workspace-tabs.ts
  - app/domains/events/admin-event.ts
  - app/domains/events/builder.ts
  - app/domains/events/program-settings.ts
  - app/domains/events/records.ts
  - app/pages/account/admin.vue
  - app/pages/account/events/[slug]/index.vue
  - app/pages/admin/events/builder/[eventId].vue
  - app/pages/admin/events/builder/new.vue
  - app/pages/admin/events/new.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - docs/testing-strategy.md
  - server/api/events/index.post.ts
  - server/application/operations/generated-output-schemas.ts
  - server/database/schema.ts
  - server/domains/events/account-event-page-contract.ts
  - server/domains/events/account-event-prizes-page.ts
  - server/domains/events/account-event-settings-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/index.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-judging-page.ts
  - shared/domains/events/account-event-operations-page.ts
  - shared/domains/events/account-event-page-registry.ts
  - shared/domains/events/account-event-prizes-page.ts
  - shared/domains/events/account-event-settings-page.ts
  - stories/app/AppDateTimeInput.stories.ts
  - tests/bdd/features/authenticated/account-event-workspace.feature
  - tests/bdd/features/authenticated/admin-configuration.feature
  - tests/bdd/features/authenticated/event-builder.feature
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/features/authenticated/simplified-claiming.feature
  - tests/bdd/steps/account-event-workspace.steps.ts
  - tests/bdd/steps/admin-configuration.steps.ts
  - tests/bdd/steps/event-builder.steps.ts
  - tests/bdd/steps/event-program.steps.ts
  - tests/bdd/steps/simplified-claiming.steps.ts
  - tests/bdd/steps/webmcp-events.steps.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - tests/integration/server/api/account-event-settings-page.test.ts
  - tests/integration/server/api/event-builder-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/unit/app/components/admin/lazy-editor-boundaries.test.ts
  - tests/unit/app/composables/account-event-parent-page-topology.test.ts
  - tests/unit/app/composables/account-workspace-page-requests.test.ts
  - tests/unit/app/composables/useShellNavigation.test.ts
  - tests/unit/app/domains/accounts/navigation-guards.test.ts
  - tests/unit/app/domains/events/account-workspace-page.test.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/app/domains/events/admin-event-schema.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - tests/unit/server/domains/events/account-event-page-contract.test.ts
  - tests/unit/server/domains/events/account-event-tab-visibility.test.ts
  - tests/unit/server/domains/events/index.test.ts
type: enhancement
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Organizers currently maintain the same event through two editors, which makes behavior drift and adds work for every new feature. Build Day provides the opportunity to finish the transition to one reusable editor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Organizers use the current builder for event creation and editing, including events already created in either editor.
- [x] #2 The builder preserves existing settings and round-trips saved agenda gaps, overlaps and optional end times until those values are edited.
- [x] #3 Dragging a session or moving it with the keyboard updates its start and end while preserving its duration and existing gaps.
- [x] #4 Controls still in the classic editor are available in the builder before the old editor, entry points and obsolete logic are removed.
- [x] #5 The builder keeps its existing create/edit permissions and WebMCP behavior.
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
Decision by Alex on 2026-11-23 (after TASK-442.1): every option is in the builder now, so the old editor is removed before the event.

1. Luma: the settings data carries the webhook address again and the Luma extra of the builder shows it with a copy button.
2. Entry points: remove the classic create page (/admin/events/new) and its menu entry. "Create event" on the admin dashboard opens the builder.
3. Workspace: remove the Settings tab and the prize configuration on the Prizes tab. Event admins open the builder with an "Edit event" button in the workspace header. The builder leads back to the event workspace. After creating an event the organizer lands on the workspace of the new event.
4. Remove the classic form components and the code that only they used.
5. Remove the creation flow marker from the app, the API and the docs. The database column stays until a later migration, because a release applies migrations before it deploys the new Worker, and the Worker that still runs reads that column.
6. Move the browser and unit tests that used the old editor to the builder.
7. Update docs: domain model, schema outline, API surface, testing strategy.

Choices made by the agent, not confirmed by Alex: the Settings tab goes away completely (no page with only a link), the entry is an "Edit event" button, and the figures of the old Settings tab (created by, number of admins, staff and judges) are not shown anymore.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The build-day branch contains the first agenda timing refactor. Classic editor retirement and parity for remaining controls are still outstanding.

Stack acceptance goal: deliver more Build Day features and make failures easier to recover from, while reducing the amount and complexity of production code. Review the stack against its base and count test deletions separately. A junior developer should be able to follow the main paths and understand why the code behaves as it does.

Decision by Alex on 2026-11-22: the remaining work (moving the last controls into the builder and removing the old editor) waits until after the event on 28 November.

Decision by Alex on 2026-11-23: build the options that only the old editor has into the builder now, before the event (TASK-442.1). Removing the old editor, its entry points and its logic is not part of that decision and stays open here.

TASK-442.1 is done (2026-11-23): every option of the old editor that the Settings tab still showed is in the builder now. Open in this task: removing the old editor, its entry points and its obsolete logic, and making the builder the editor for events created in the old editor.

Removal of the old editor on 2026-11-23 (decision by Alex the same day: every option is in the builder, so the old editor goes now).

- Removed: the classic create page and its menu entry, EventConfigForm, AdminEventCreateEditForm, EventConfigApplicationFieldsTable, AccountEventAdminSettingsPanel, AccountEventSimplifiedClaimingControl, AppDateTimeInput with its story, program-settings.ts, the Settings tab, the prize configuration on the Prizes tab with its page data (showPrizeConfiguration, includeAdminEventConfiguration, adminSettingsEvent), and the creation flow marker in the API, the page payloads and the Drizzle schema.
- New entry point: "Edit event" in the header of the event workspace, for event admins and platform admins. Closest analog: the "Open event builder" button of the removed Settings tab; it is the same AppButton link in a new place, no new component.
- AppButton got the option noPrefetch. Without it the link loaded the builder code on every admin tab, which the browser request check @task-432-5-7 forbids. The "Create event" button on the dashboard uses it too, because the menu it replaces did not load the builder in advance.
- The builder page expires the cached workspace pages and judge score sheets of the event after every save (event, images, terms, criteria, prizes, credits, hide event). Before, the editors in the workspace did that for their own saves.
- buildEventConfigurationPatch sends the check-in flow, the questionnaire questions, the challenges and the photo setting. Before, the builder added them on top, because the old form must not send them.
- Luma: the admin event of the settings page carries lumaWebhookUrl again, and the Luma extra shows it with a copy button.
- Evidence for AC 2: unit test "keeps exact agenda times across a gap, an overlap and a block without an end in the edit payload". Evidence for AC 3: keyboard move in the browser scenario of the builder, and a check of the times in the real builder on 2026-11-23 (the pause stays at its position, each block keeps its duration); dragging uses the same function.
- Validation: lint, typecheck, 719 unit tests, 774 integration tests, 144 browser tests (143 and 1 destructive). Real browser at 1440 px and 390 px, light and dark: dashboard, workspace, builder, Luma extra.
- Test gaps: no browser test presses the copy button of the webhook address or "Try again" of the Luma setup. Dragging with the pointer (agenda blocks, criteria, prizes) is not browser-tested; the keyboard move of agenda blocks is.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event builder is the only editor of an event. The old editor, its create page, the Settings tab of the event workspace and the prize configuration on the Prizes tab are removed, together with the code that only they used (about 3,650 lines removed, 320 added). Event admins open the builder with "Edit event" in the header of the event workspace; the builder leads back to the workspace; a new event lands on its workspace. The Luma extra shows the webhook address of a saved connection.

Verification: lint, typecheck, 719 unit tests, 774 integration tests and 144 browser tests pass; the pages were checked in a real browser at two widths and in both themes.

Risks and follow-ups:
1. The database column events.creation_flow still exists and is unused. A migration that drops it must ship in a release after the one that contains this change: a release applies migrations before it deploys the Worker, and the Worker that still runs reads that column. No task exists for it yet.
2. The builder saves an event only when it has an event start and at least one agenda block. An event that was saved without an agenda (possible in the old editor and through the API) needs both before "Save event" works. Its extras with their own save button (images, terms, credits, criteria, prizes, rooms, hide event) work without that.
3. Choices made by the agent that Alex has not confirmed: the Settings tab is removed completely; the entry is an "Edit event" button in the workspace header; after creating an event the organizer lands on its workspace; the figures of the old Settings tab (created by, number of admins, staff and judges) are not shown anymore.
4. A link button (AppButton with "to") prints the Vue development warning "toRefs() expects a reactive object". It existed before this change and does not appear in production builds.
<!-- SECTION:FINAL_SUMMARY:END -->
