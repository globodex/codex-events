---
id: TASK-524
title: Show the event activities on the Overview to the event team
status: Done
assignee:
  - '@claude'
created_date: '2026-11-27T19:06:00Z'
updated_date: '2026-11-27T19:11:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - tests/bdd/features/authenticated/check-in-flow.feature
  - tests/bdd/steps/check-in-flow.steps.ts
type: feature
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-27 Alex, event admin and staff of Vienna without a registration, saw the credit offers on the Overview but no links to the agenda and the gallery, because the next-step card is only for confirmed participants. Event admins and event staff without a confirmed registration now see a card with the links to the event's activities, without the check-in step, while the event uses the check-in flow and is not completed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An event admin or staff member without a confirmed registration sees Event activities with the Agenda and Gallery links on the Overview
- [x] #2 Confirmed participants keep their next step, and nobody else sees the card
- [x] #3 Docs and a browser scenario cover the event team card
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
Event admins and event staff without a confirmed registration of their own now see Event activities with the links to the agenda and the gallery at the top of the Overview, while the event uses the check-in flow and is not completed. It reuses the next-step card with a forEventTeam mode; the participant rules (next step, check-in polling, gallery hint) are unchanged. Validation: lint, typecheck, unit (728), full BDD (150 + 1, new scenario for an event admin without a registration), and a browser check as the demo admin (Event activities: Agenda, Gallery) and as a checked-in participant (unchanged).
<!-- SECTION:FINAL_SUMMARY:END -->
