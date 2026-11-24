---
id: TASK-492
title: >-
  Show how to get there before check-in and the credits after check-in at the
  top of the Overview
status: Done
assignee: []
created_date: '2026-11-24T19:39:00Z'
updated_date: '2026-11-24T20:17:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/components/account/events/organisms/AccountEventProgramAgenda.vue
  - app/lib/query-values.ts
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/testing-strategy.md
  - tests/bdd/features/authenticated/challenges.feature
  - tests/bdd/features/authenticated/credit-claims.feature
  - tests/bdd/steps/check-in-flow.steps.ts
type: enhancement
ordinal: 209000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex's sketch of 2026-11-24 puts one card at the top of the Overview of an event with the check-in flow: 'How to get there' before check-in and the credit claims after check-in. 'How to get there' points to the Agenda tab with the first item selected, so the map shows where to go.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Before check-in, a confirmed participant sees one card at the top of the Overview with 'How to get there', which opens the Agenda tab with the first program session that has a room selected, and the way to tell the page that the check-in happened
- [x] #2 After check-in the same card shows the credit offers to claim instead
- [x] #3 The Agenda tab selects the session that a link names
- [x] #4 Docs and tests cover both states of the card and the link to the Agenda
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
1. The next-step card shows "How to get there" before check-in with "Show the way" (Agenda tab, session=first) and "I've checked in".
2. After check-in the page hides the card when the event has credit offers, so the credits stand at the top; without offers the card lists the activities.
3. The Agenda tab reads ?session=<id|first> and selects that session on open (normalizeSessionQueryValue, AccountEventProgramAgenda linkedSession).
4. Docs and browser steps; browser check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built 2026-11-24 from Alex's sketch and answer "how to get there should point to the agenda and preselect the first item". "First" is the session with a room and the smallest start offset; a session without a room cannot be selected on the map.
Kept "I've checked in" in the card: the page does not notice a check-in by itself. An event without credit offers keeps the "You're checked in" card with its activity links after check-in.
Verification: lint, typecheck, unit, integration, full BDD (check-in steps now assert "How to get there" and "Show the way"; the sold-out credit scenario asserts the credits replace the next step and the Agenda tab still opens), browser check at 1440 light and 390 dark: card before check-in, Show the way selects "Doors open and check-in" and the map shows the route; after check-in the credits are at the top (demo check-in reset by SQL for the picture and restored).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In an event with the check-in flow, the top of the Overview shows "How to get there" before check-in: "Show the way" opens the Agenda tab with the first session that has a room selected, so the map shows the route, and "I've checked in" reads the page again. After check-in the credit offers take its place; an event without offers keeps the card with its activity links. The Agenda tab selects a session named in the link (?session=<id> or first). Verified with lint, typecheck, unit, integration, the full browser suite and a browser check. Risk: an event whose first session has no room opens the Agenda without a selection.
<!-- SECTION:FINAL_SUMMARY:END -->
