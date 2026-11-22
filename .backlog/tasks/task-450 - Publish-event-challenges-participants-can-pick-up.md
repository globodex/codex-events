---
id: TASK-450
title: Publish event challenges participants can pick up
status: Done
assignee:
  - '@claude'
created_date: '2026-11-21T15:23:00Z'
updated_date: '2026-11-22T06:58:00Z'
labels:
  - build-day
milestone: m-3
dependencies:
  - TASK-448
references:
  - docs/domain-model.md
modified_files:
  - docs/domain-model.md
  - docs/schema-outline.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/api-surface.md
  - docs/testing-strategy.md
  - README.md
  - drizzle/0083_event_challenges.sql
  - server/database/schema.ts
  - shared/domains/events/challenges.ts
  - server/domains/events/challenges.ts
  - shared/domains/credits/simplified-giveaways.ts
  - server/domains/events/index.ts
  - shared/domains/events/account-event-settings-page.ts
  - shared/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-shell.ts
  - app/domains/events/records.ts
  - app/domains/events/admin-event.ts
  - app/domains/events/builder.ts
  - app/components/admin/builder/molecules/AdminBuilderChallengeCard.vue
  - app/components/admin/builder/organisms/AdminBuilderChallengesEditor.vue
  - app/components/admin/builder/organisms/AdminBuilderSettingsBoard.vue
  - app/components/admin/builder/molecules/AdminBuilderCustomQuestionCard.vue
  - app/domains/events/account-workspace-tabs.ts
  - app/domains/events/account-workspace-seo.ts
  - app/pages/account/events/[slug]/index.vue
  - app/components/account/events/organisms/AccountEventChallengesPanel.vue
  - server/application/operations/generated-output-schemas.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/server/domains/events/index.test.ts
  - tests/unit/server/domains/events/account-event-page-shell.test.ts
  - shared/domains/events/custom-questions.ts
  - tests/unit/app/domains/events/builder.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/steps/challenges.steps.ts
  - app/composables/useEventBuilder.ts
  - tests/unit/app/domains/events/admin-event-schema.test.ts
type: feature
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Event organizers need to offer practical tasks to participants after the check-in flow. The team still needs to agree what picking up and completing a challenge should record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin can publish challenges with instructions and resources for their event.
- [x] #2 A participant who has completed the check-in flow can pick up published challenges independently of an event credit claim.
- [x] #3 The team has approved the rules for what gets recorded when a challenge is picked up or completed before implementation.
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
1. Docs first: domain-model (EventChallenge, nothing recorded), schema-outline (events.challenges_json), permissions-matrix (write: event admin/platform admin; read: staff, admins, confirmed participants who finished the check-in flow), api-surface (PATCH input, admin serialization, /entry page field), testing-strategy, README capability row.
2. Data: migration 0083 adds events.challenges_json (default '[]'); mirror in server/database/schema.ts. One shared Zod schema in shared/domains/events/challenges.ts owns the challenge shape, its limits and the reader rule canReadEventChallenges.
3. Server: PATCH /api/events/:eventId accepts challenges (update only, not create); serializeAdminEvent returns all challenges; one server function listReadableEventChallenges (server/domains/events/challenges.ts) feeds the reader rule from stored records via hasApplicationFinishedCheckInFlow. Entry page gets challenges (published only, only for readers); entry page and page shell add the tab challenges through buildAccountEventTabVisibility.
4. Organizer: builder settings group Challenges (edit only) with a list editor modelled on the builder question editor (add, edit, remove, reorder, draft/published). Unfinished challenges and unfinished After check-in questions become a line in the builder checklist, which already gates the save button.
5. Participant: Challenges tab on the account event page fed by the entry page data (no extra request), read-only list with instructions (Markdown) and resource links; Challenges entry in participantActivities.
6. Tests: integration (save rules, page data per viewer, admin event round trip), unit (checklist lines, tab mapping), BDD @task-450 with dedicated fixture events.
7. Validate (lint, typecheck, unit, integration, bdd, git diff --check, hygiene), regenerate MCP output schemas and catalog, apply the migration to the local preview, add demo challenges, take the screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision by Alex on 2026-11-22: nothing is recorded when a participant picks a challenge. Challenges are a published list with instructions and resources.

Design as built (2026-11-22): challenges are one ordered JSON list on the event (events.challenges_json, migration 0083). shared/domains/events/challenges.ts owns the shape, the limits and the reader rule canReadEventChallenges; server/domains/events/challenges.ts has the one server function listReadableEventChallenges, used by the entry page loader and the direct-link page shell. The entry page carries the published challenges only for readers; the Challenges tab renders from that data without another request.

Closest analogs. Organizer editor: the builder question editor (AdminCustomQuestionEditor builder variant + AdminBuilderCustomQuestionCard on AdminBuilderTrackRow). It edits question definitions and cannot express a title, Markdown instructions, resources and a draft state, so the challenge editor is a new organism (AdminBuilderChallengesEditor) with a new molecule (AdminBuilderChallengeCard) that reuse AdminBuilderTrackRow, useAdminSortableLists and AdminMarkdownEditorField. Participant view: AccountEventTracksPanel. It owns track selection and staff modes, so the Challenges tab is a new organism (AccountEventChallengesPanel) that reuses AppCard and EventTrackDetails (Markdown plus resource links).

Unfinished entries: the builder checklist (getBuilderChecklist) gets one line for the first unfinished challenge and one for the first unfinished After check-in question, for example 'Challenge 2: Add a title.'. The checklist already gates the save button and focuses the field on click, so no new validation UI was needed. The wording of each problem lives in the shared list schemas.

Link rule: challenge resource links reuse isHttpsCouponUrl (HTTPS, no embedded credentials), the only shared HTTPS-only link rule of the platform.

Save path: only the event builder sends the challenge list (useEventBuilder.buildPatchBody). buildEventConfigurationPatch, which the older settings form also uses, sends no challenges, so a save from that form cannot drop or change the stored challenges, also when its data is stale. The admin event (settings page, entry page adminSettingsEvent) carries every challenge for the builder.

Acceptance criterion 3: settled by Alex's decision of 2026-11-22. Nothing is recorded when a participant opens, picks or completes a challenge, and the implementation stores no per-participant challenge data (challenges live only in events.challenges_json).

Test gaps: (1) Reordering challenges by drag and by keyboard was checked by hand in the local preview; no automated test drags. (2) No browser scenario presses the save button of the older settings form; a unit test proves that its request has no challenges, and a server test proves that an update without challenges keeps the stored ones. (3) The new components have no Storybook stories.

Local preview: migration 0083 applied with 'CI=1 CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false node_modules/.bin/wrangler d1 migrations apply DB --local --persist-to .wrangler/demo-Hdc7do/state --config wrangler.jsonc'. The demo event build-day-demo has three demo challenges (two published, one draft), added through the event builder.

Validation on the final tree (2026-11-22): bun run lint (exit 0), bun run typecheck (exit 0), bun run test:unit (142 files, 736 tests passed), bun run test:integration (51 files, 651 tests passed), bun run test:bdd (123 passed plus 1 destructive passed), git diff --check (clean). Readability check: one dense_line flag on a zod method chain in shared/domains/events/challenges.ts, left as allowed. mcp:generate-output-schemas changed generated-output-schemas.ts; mcp:generate-operation-catalog changed nothing; the MCP snapshot test passes unchanged. No setup or configuration changed, so OPERATOR.md and DEVELOPMENT.md stay as they are.

Review (2026-11-22): read the full diff; re-ran lint, typecheck, unit (736), integration (651), the full browser suite (123 plus 1), the readability check (one allowed dense_line flag on a zod chain) and git diff --check on the final tree; looked at the screenshots. Changed in review: the after-check-in settings (checkInFlowEnabled, questionnaireQuestions) are now sent only by the event builder (buildPatchBody in useEventBuilder), the same way as challenges. buildEventConfigurationPatch sends none of the three builder-only settings, so a save from the older settings form cannot overwrite them; the unit test and docs/testing-strategy.md say so.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Event admins and platform admins write, order and publish challenges (title, Markdown instructions, up to 10 https resources, draft or published) in a new Challenges group of the event builder; the list is stored on the event (events.challenges_json, migration 0083) and saved through PATCH /api/events/:eventId. Published challenges appear in a new Challenges tab of the account event page and as an activity on the next-step card. The server sends them only to event staff, event admins, platform admins and confirmed participants who finished the check-in flow: one shared rule (canReadEventChallenges) and one server function (listReadableEventChallenges) decide it for the entry page and the direct-link shell. Nothing is recorded when a participant picks or completes a challenge. The builder checklist now names an unfinished challenge or After check-in question and keeps the save button off until it is fixed.

Verification: lint, typecheck, 736 unit tests, 651 integration tests and 123 plus 1 browser scenarios pass; the feature was checked in the local preview in both themes at 390 and 1440 px.

Risks and follow-ups: (1) The entry page carries the challenge texts for readers on every entry-fed tab (worst case about 80 KB with 20 full challenges). (2) Only the event builder edits and sends challenges; the older settings form has no challenge editor. (3) The link rule reuses isHttpsCouponUrl, whose name is about credits; a neutral name would be a small follow-up. (4) The new components have no Storybook stories. (5) Challenges stay readable after an event is completed; confirm that this is wanted.
<!-- SECTION:FINAL_SUMMARY:END -->
