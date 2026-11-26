---
id: TASK-519
title: >-
  Show Go to event space instead of Register for people who already have the
  event
status: Done
assignee:
  - '@claude'
created_date: '2026-11-26T22:41:00Z'
updated_date: '2026-11-26T22:51:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/composables/usePublicEventWorkspaceAccess.ts
  - app/domains/applications/participant-application.ts
  - app/pages/events/[slug]/index.vue
  - tests/bdd/features/public/event-discovery.feature
  - tests/bdd/steps/public-events.steps.ts
  - tests/unit/app/composables/usePublicEventWorkspaceAccess.test.ts
  - tests/unit/app/domains/applications/participant-application.test.ts
  - docs/domain-model.md
type: feature
ordinal: 236000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-26 Alex asked that the Register button on the public event page reads "Go to event space" for a signed-in person who already registered, so they go to their event page instead of the registration form. The public page stays cacheable: the button changes in the browser after the account check, which now also runs while registration is open, and only for signed-in people.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A signed-in person who has the event among their events sees Go to event space, which opens their event page, also while registration is open
- [x] #2 Visitors without the event keep Register while registration is open, and the public page HTML stays the same for everyone
- [x] #3 Tests cover the button for a guest, a member with the event, and a failed account check
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
The access check (usePublicEventWorkspaceAccess) now always runs after the account check, so its needed flag is gone; it still asks only for a signed-in person with accepted platform documents. The public HTML stays the same for everyone and is cacheable; the button changes in the browser. The domain model sentence about the button ships in the TASK-517 commit, because both tasks edit the same paragraph area.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
On the public event page a signed-in person who already has the event among their events, for example after registering, sees Go to event space instead of Register, also while registration is open. It opens their event page. Guests and people without the event keep Register; after registration closes only people with the event see a button. The session-held scenario now expects Go to event space and one account events request for the returning member, and Register with no such request for a guest or a failed account check. Validation: lint, typecheck, unit (725), full BDD (149 + 1), and a browser check as a registered participant.
<!-- SECTION:FINAL_SUMMARY:END -->
