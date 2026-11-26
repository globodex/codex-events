---
id: TASK-518
title: Keep the agenda and gallery links above the credits after check-in
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T22:09:00Z'
updated_date: '2026-11-26T22:13:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - app/pages/account/events/[slug]/index.vue
  - docs/domain-model.md
  - tests/bdd/features/authenticated/credit-claims.feature
  - tests/bdd/steps/check-in-flow.steps.ts
type: bug
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex noticed that after check-in the Overview hides the next-step card with the links to the agenda and the gallery when the event has credit offers, because the credits took its place. Since the credit fix 26d2347d staff and platform admins assigned as staff also get credits, so they lost the links too. The links stay on top, and the credits stand below them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After check-in the next-step card with the activity links shows above the credit offers
- [x] #2 Docs and the credits browser test describe the links above the credits
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
After check-in the Overview now always shows the next-step card with the links to the agenda and the gallery, and the credit offers stand below it. Before, the credits took the place of the card, so a participant with credits, and since 26d2347d also staff and platform admins assigned as staff, lost the links. The domain model and the sold-out credits scenario describe the links above the credits; an event without activities shows "You're checked in" above the credits. Validation: lint, typecheck, unit (725) and the full BDD suite (149 + 1) pass.
<!-- SECTION:FINAL_SUMMARY:END -->
