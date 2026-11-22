---
id: TASK-479
title: Show credits on the Overview tab and manage them in the event builder
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T21:18:00Z'
updated_date: '2026-11-22T21:48:00Z'
labels: []
milestone: m-3
dependencies: []
references:
  - app/components/account/events/AccountEventCreditsPanel.vue
  - app/components/admin/builder/organisms/AdminBuilderRegularCreditsManager.vue
modified_files:
  - app/components/account/events/AccountEventCreditsPanel.vue
  - app/components/admin/builder/organisms/AdminBuilderRegularCreditsManager.vue
  - app/domains/events/account-workspace-seo.ts
  - app/domains/events/account-workspace-tabs.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/permissions-matrix.md
  - docs/testing-strategy.md
  - server/application/operations/generated-output-schemas.ts
  - server/domains/credits/index.ts
  - server/domains/events/account-event-entry-page.ts
  - server/domains/events/account-event-page-shell.ts
  - server/domains/events/account-event-settings-page.ts
  - server/domains/events/account-event-tab-visibility.ts
  - shared/domains/credits/claim-access.ts
  - shared/domains/events/account-event-entry-page.ts
  - shared/domains/events/account-event-settings-page.ts
  - stories/participant/AccountEventCreditsPanel.stories.ts
  - tests/bdd/features/authenticated/account-event-workspace.feature
  - tests/bdd/features/authenticated/check-in-flow.feature
  - tests/bdd/features/authenticated/credit-claims.feature
  - tests/bdd/steps/account-event-workspace.steps.ts
  - tests/bdd/steps/credit-claims.steps.ts
  - tests/bdd/support/account-event-workspace-topology.ts
  - tests/integration/server/api/account-event-competition-pages.test.ts
  - tests/integration/server/api/account-event-entry-prizes-pages.test.ts
  - tests/integration/server/api/account-event-settings-page.test.ts
  - tests/integration/server/api/credit-claim-check-in-flow-routes.test.ts
  - tests/integration/server/api/event-challenges-routes.test.ts
  - tests/unit/app/components/admin/event-builder-credits-section.test.ts
  - tests/unit/app/domains/accounts/shell-navigation.test.ts
  - tests/unit/app/domains/events/account-workspace-tabs.test.ts
  - tests/unit/server/domains/events/account-event-entry-prizes-page.test.ts
  - tests/unit/server/domains/events/account-event-page-shell.test.ts
  - tests/unit/server/domains/events/account-event-tab-visibility.test.ts
  - tests/unit/shared/domains/events/account-event-entry-prizes-pages.test.ts
  - app/components/admin/builder/molecules/AdminBuilderCreditOffer.vue
  - stories/features/AdminBuilderCreditOffer.stories.ts
type: feature
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The event page has a Credits tab. Participants claim their credits there, and organizers manage the offers there. Alex asked on 2026-11-22: 'Let's remove the credits tab and put them in the overview as soon as one is checked-in and finishes the questionnaire'. For the organizer tools he chose the event builder (question of 2026-11-22): its Credits group already adds offers, uploads CSV files and deletes offers, and it gets the two things that only the tab has today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The event page has no Credits tab, and the next-step card names no Credits activity.
- [x] #2 The Overview tab shows the credit offers to a person who can claim them: a confirmed participant who finished check-in and the questions (every confirmed participant when the event has no check-in flow) and event staff. The person claims there.
- [x] #3 Before a participant can claim, the Overview tab shows no credit offer. A code that the person already claimed stays on the Overview tab.
- [x] #4 In the Credits group of the event builder an organizer can change the name and the participant instructions of an offer.
- [x] #5 In the Credits group of the event builder an organizer can see the uploaded codes of an offer and who claimed each.
- [x] #6 The entry page carries no organizer credit data. The settings page carries each offer with its codes.
- [x] #7 An event with simplified claiming behaves as before.
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
1. Server: the entry page carries only the offers that the Overview tab shows (listEventCreditOffersForOverview in the credit domain). The tab rule and the page shell lose the Credits tab and the credit read. The settings page carries each offer with its codes (listAdminEventCreditOffers).
2. Event page: AccountEventCreditsPanel.vue keeps only the participant part and stands on the Overview tab below the next-step card. The Credits section, the tab entries and the Credits activity of the next-step card are removed.
3. Event builder: the offer row of AdminBuilderRegularCreditsManager.vue becomes the molecule AdminBuilderCreditOffer.vue with a form for name and instructions and the list of codes.
4. Docs, unit, integration and browser tests, stories, browser check, full validation chain.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rule: listEventCreditOffersForOverview (server/domains/credits/index.ts) decides what the Overview tab gets. An offer that the caller already claimed is always listed. Every other offer is listed only when the caller can claim (getEventCreditClaimAccess says can_claim) and the offer has at least one uploaded code. The entry page carries this list as participantCredits; adminCredits is gone.

Event page: AccountEventCreditsPanel.vue keeps only the participant part (about 230 lines, before 1100) and stands on the Overview tab below the next-step card. It gets the offers and shows a claim button on every listed offer without a claimed code that has a free code. The page no longer computes the claim rule; the server does.

Removed: the Credits tab id, tabVisibility.hasCreditInventory, the credit read of the page shell, the Credits activity of the next-step card, the notes 'Finish your next step to claim your credits' and 'Credit claims are closed for this event', the organizer half of the panel, listAdminEventCreditOfferSummaries.

Event builder: the settings page carries each offer with its codes (listAdminEventCreditOffers). New molecule AdminBuilderCreditOffer.vue shows one offer: counts, Upload CSV, Edit (name and participant instructions), Show codes (code or link, who claimed it, when), Delete while nothing is claimed. Closest analog: the offer row inside AdminBuilderRegularCreditsManager.vue and the organizer block of the old Credits panel. A new component because the row now has a form and a code list with state per offer; inside the manager that state needed five maps keyed by the offer id.

Decisions and assumptions:
- Before a participant can claim, the Overview tab shows nothing about credits. This follows Alex's sentence; he was not asked again.
- An offer without uploaded codes is not listed for participants.
- The credit list route GET /api/events/:eventId/credits is unchanged. It still names the offers to a confirmed participant before check-in.
- The edit form in the builder uses the same plain fields as 'Add an offer', not the Markdown editor of the old tab.

Browser check on the local preview, 2026-11-22 (1440x900 dark and light, 390x844 light and dark): before the questions the page has the tabs Overview, Agenda, Gallery and no credits card; after 'Send answers' the card appears with the offer; a claim shows the code; the next-step card lists Agenda and Gallery. Builder: the code list names the participant and the time; an edit saves with 200 and closes the form; an empty name is refused in the form and Cancel removes the message; no sideways overflow at 1440, 820 and 390 pixels. No page errors. The demo participant is back in the state 'checked in, questions open'.

Validation on the final tree, 2026-11-22: lint and typecheck passed, 726 unit tests, 766 integration tests, 125 + 1 browser tests, git diff --check clean. After the chain two small edits followed (Cancel clears the form message; one more assertion for event staff): typecheck, eslint on the changed files and the changed integration file passed again.

Test gaps: no automated browser test edits an offer or opens the code list in the builder; both were checked by hand. The settings page test covers the codes with the person who claimed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The event page has no Credits tab. Credits stand on the Overview tab: a person sees an offer when they can claim it now or already claimed it, so a participant sees the offers right after check-in and the questions, and event staff at once. Organizers manage credits only in the event builder, which now also edits an offer's name and instructions and lists every code with the person who claimed it.

The server owns the rule (listEventCreditOffersForOverview). The entry page carries no organizer credit data, and the page shell reads no credit tables. The settings page carries each offer with its codes.

Checked: the flow in the browser (questions, credits appear, claim), the builder (code list, edit, empty name, cancel), and the full validation chain.

No setup change. Permissions: the builder and the settings page are for event admins and platform admins, as before; participants and staff still read only their own claimed code.

Risks and follow-ups: the builder has no automated browser test for the new form and the code list. An event admin who is not staff and not a participant sees no credits on the Overview tab and uses the builder. The settings page now loads all codes of the event on every builder load; for a very large code list this response grows.
<!-- SECTION:FINAL_SUMMARY:END -->
