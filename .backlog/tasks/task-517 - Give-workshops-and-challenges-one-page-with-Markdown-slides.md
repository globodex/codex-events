---
id: TASK-517
title: Give workshops and challenges one page with Markdown slides
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T22:06:00Z'
updated_date: '2026-11-26T22:51:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/molecules/AccountEventChallengeCard.vue
  - app/components/account/events/molecules/AccountEventChallengeChoiceCard.vue
  - app/components/account/events/organisms/AccountEventChallengeChoice.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/components/account/events/organisms/AccountEventWorkshopEditor.vue
  - app/components/account/events/organisms/AccountEventWorkshopPanel.vue
  - app/components/admin/builder/molecules/AdminBuilderChallengeCard.vue
  - app/components/admin/builder/organisms/AdminBuilderChallengesEditor.vue
  - app/components/admin/builder/organisms/AdminBuilderExtrasBoard.vue
  - app/components/public/events/EventFeedbackForm.vue
  - app/pages/account/events/[slug]/index.vue
  - app/pages/imprint.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/schema-outline.md
  - server/api/events/[eventId]/workshops/[sessionId]/files/[fileId].get.ts
  - server/api/events/[eventId]/workshops/[sessionId]/files/index.post.ts
  - server/api/events/[eventId]/workshops/[sessionId]/index.put.ts
  - server/application/operations/eligibility-manifest.ts
  - server/application/operations/generated-catalog.ts
  - server/application/operations/generated-output-schemas.ts
  - server/auth/authorization.ts
  - server/database/schema.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-program-page.ts
  - server/domains/events/challenges.ts
  - server/domains/events/workshops.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/challenges.ts
  - shared/domains/events/program.ts
  - shared/domains/events/workshops.ts
  - stories/features/fixtures/build-day.fixtures.ts
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/features/authenticated/event-program.feature
  - tests/bdd/steps/challenges.steps.ts
  - tests/bdd/steps/event-program.steps.ts
  - tests/bdd/support/platform-fixtures.ts
  - tests/integration/server/api/challenge-choice-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/integration/server/database/migration.test.ts
  - tests/integration/server/mcp/__snapshots__/mcp-protocol.test.ts.snap
  - tests/unit/app/domains/events/admin-event-schema.test.ts
  - tests/unit/app/domains/events/builder.test.ts
  - app/components/account/events/molecules/AccountEventDeckContent.vue
  - app/components/account/events/organisms/AccountEventChallengePage.vue
  - app/components/account/events/organisms/AccountEventDeckEditor.vue
  - app/components/account/events/organisms/AccountEventDeckPanel.vue
  - drizzle/0095_event_decks.sql
  - server/api/events/[eventId]/challenges/
  - server/domains/events/decks.ts
  - shared/domains/events/decks.ts
type: feature
ordinal: 234000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked for the workshop page also for challenges, with several Markdown slides instead of one description, and for both to use the same component. Decisions with Alex: outside fullscreen all slides stand one after another; fullscreen keeps the agenda and shows one slide at a time with two arrows in a corner; event admins and the challenge's staff edit the challenge page on the page, and the builder keeps title, publishing, open track, rooms and staff notes; the Details button of a challenge card opens the challenge page; uploaded PDFs and links become Materials and Links, and challenges can upload PDFs too. Slides and materials of workshops and challenges live in one table (event_decks), so a builder save never overwrites what staff write on a page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A workshop page and a challenge page show their slides one after another, then Materials and Links
- [x] #2 Fullscreen shows the agenda and one slide at a time, with previous and next arrows in a corner and the keyboard arrows
- [x] #3 Event admins and the workshop staff edit a workshop page; event admins and the challenge staff edit a challenge page; both add, remove and reorder slides and add links or PDFs
- [x] #4 The Details button of a challenge card opens the challenge page beside the agenda; Show more on the Overview shows the same slides and links
- [x] #5 The builder no longer edits challenge instructions and links; existing instructions become the first slide and existing links become Links
- [x] #6 Docs and tests cover the slides, the editing rights, the migration and the private PDFs
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Model: shared/domains/events/decks.ts (slides and resources of kind material or link). Storage: event_decks by event, subject kind (workshop or challenge) and subject id; migration 0095 moves workshop descriptions to slide 1 and their slides items to materials, moves challenge instructions to slide 1 and challenge resources to links, strips them from events.challenges_json and drops event_workshops. The builder saves challenges_json, so it never writes over a deck. Server: decks.ts saves and serves decks; workshops.ts and challenges.ts own who may edit or read, and each route checks first and passes the editor in, which avoids import cycles. EventAuthorization carries staffChallengeId.

Component choices:
- AccountEventDeckContent (molecule): slides one after another, then Materials and Links. Closest analog EventTrackDetails (description and one Resources group of public links); it cannot show several slides, two groups and private PDFs without changing the public track layout. Shared by the page and by Show more on the Overview.
- AccountEventDeckPanel and AccountEventDeckEditor (organisms) replace the workshop panel and editor and serve both kinds; same read, Edit and lazy editor pattern as AccountEventStaffInstructionsPanel.
- AccountEventChallengePage (organism) is a thin wrapper for the two places that show a challenge page: beside the program agenda and beside the public agenda without a program.

The three new routes pushed Nuxt's typed fetch over TypeScript's depth limit (TS2589) in the only two components that called raw $fetch, EventFeedbackForm and the imprint page; both now use the shared useApiClient like the rest of the app.

Deploy note: the migration changes challenges_json and drops event_workshops, so for the seconds between migration and Worker switch, old code can fail reads of challenges and workshops.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Workshops and challenges now share one page on the Agenda tab: Markdown slides one after another, then Materials and Links. Fullscreen keeps the agenda and shows one slide at a time with previous and next arrows in the corner; the arrow keys and Page Up and Page Down work too. The Details button of a challenge card opens its page beside the agenda (also without a program); event admins and the staff of the challenge edit it, and Show more on the Overview shows the same deck. The builder keeps title, publishing, open track and staff instructions and links to each published challenge page. Existing instructions became slide 1 and links became Links (migration 0095, tested).

Validation: lint, typecheck, unit (725), integration (all, new challenge page and migration tests), topology (26) and full BDD (149 + 1; the workshop scenario now adds two slides and checks the arrows and keys, the challenge scenarios read the challenge page). Checked in the local preview as admin and participant at 1440 and 390 px, light and dark.

Risks: a few seconds during deploy where old code meets migrated data; challenge page editing in the browser is covered by the shared editor in the workshop scenario and by integration tests, not by its own browser scenario.
<!-- SECTION:FINAL_SUMMARY:END -->
