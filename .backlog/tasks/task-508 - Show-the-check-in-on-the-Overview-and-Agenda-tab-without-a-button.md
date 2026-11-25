---
id: TASK-508
title: Show the check-in on the Overview and Agenda tab without a button
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T22:35:00Z'
updated_date: '2026-11-25T22:48:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - app/composables/usePolling.ts
  - app/pages/account/events/[slug]/index.vue
  - app/components/account/events/organisms/AccountEventNextStepCard.vue
  - server/domains/events/account-event-program-page.ts
  - shared/domains/events/program.ts
  - server/application/operations/generated-output-schemas.ts
  - tests/integration/server/api/event-program-routes.test.ts
  - tests/integration/server/mcp/mcp-protocol.test.ts
  - tests/bdd/features/authenticated/check-in-flow.feature
  - tests/bdd/steps/check-in-flow.steps.ts
  - docs/domain-model.md
  - docs/lifecycle-and-state-machines.md
  - docs/api-surface.md
  - tests/bdd/features/authenticated/credit-claims.feature
type: feature
ordinal: 225000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On 2026-11-25 Alex asked to replace the "I have checked in" button of the next step on the Overview with polling every 5 seconds plus 1 to 3 seconds of jitter, which reads the check-in state again, and to do the same on the Agenda tab. The polling stops once the participant is checked in.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The next step on the Overview has no button; until the check-in, the Overview reads its data again 6 to 8 seconds after each read while the page is visible
- [x] #2 The Agenda tab of a confirmed participant who waits for check-in reads its page again the same way, also when it is opened by a direct link
- [x] #3 The reading stops once the participant is checked in and pauses while the page is hidden
- [x] #4 Docs and tests cover the reading and its stop
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
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
app/composables/usePolling.ts owns the timing: it reads again 5 s plus a random 1 to 3 s after the last read finished, only while its condition holds and the document is visible, and never runs two reads at once. The account event page uses it once: on the Overview while the next step shows and the participant is not checked in, and on the Agenda tab while the program page says waitingForCheckIn. Each read is refreshAfterCheckInStep, the read the removed button made: the entry page and the Agenda page read again, and a disabled Gallery read waits for its tab. The server computes waitingForCheckIn on the Agenda page (approved, check-in flow on, no effective attendance, event not completed), so a direct link to the Agenda tab polls too.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The next step on the Overview has no "I have checked in" button any more. Until a confirmed participant is checked in, the Overview and the Agenda tab read their data again 5 seconds plus a random 1 to 3 seconds after each read, only while the page is visible, and stop once the participant is checked in (app/composables/usePolling.ts). The Agenda page tells by itself whether its viewer waits for check-in (waitingForCheckIn), so a direct link to the Agenda tab polls too. Before check-in, the card now shows only when there is a way to show; an event without an agenda shows the card after check-in.

Verification: lint, typecheck, 725 unit and 784 integration tests pass; the full browser suite passed apart from one scenario that met the agenda-less card, and the three affected features (10 scenarios) pass after the fix. Locally, the Overview read again after 6.3 s and 6.1 s, switched by itself after a check-in and made no reads in the next 10 s; the Agenda tab read after 6.3 s and 8.0 s and stopped after the check-in; a hidden page made no reads for 12 s and read again within 9 s once visible. Pictures at 1440 px and 390 px in light and dark mode.
<!-- SECTION:FINAL_SUMMARY:END -->
