---
id: TASK-466
title: Keep one active registration per Luma email in an event
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T11:01:00Z'
updated_date: '2026-11-22T11:36:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
modified_files:
  - app/pages/events/[slug]/register.vue
  - docs/api-surface.md
  - docs/domain-model.md
  - docs/permissions-matrix.md
  - docs/testing-strategy.md
  - server/api/account.patch.ts
  - >-
    server/api/events/[eventId]/applications/[applicationId]/actions/undo-withdrawal.post.ts
  - server/api/events/[eventId]/applications/index.post.ts
  - >-
    server/api/events/[eventId]/applications/me/actions/verify-luma-email.post.ts
  - server/api/public/events/[slug]/luma/webhooks.post.ts
  - server/domains/applications/index.ts
  - server/domains/applications/luma-config.ts
  - server/domains/applications/luma-email.ts
  - server/domains/applications/luma-guest-list-sync.ts
  - tests/integration/server/api/application-routes.test.ts
  - tests/integration/server/api/luma-guest-list-routes.test.ts
type: enhancement
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The platform matches a Luma guest to a registration by the Luma email saved on the account, and it cannot prove that the email belongs to the account. Two accounts with the same Luma email in one event made the match ambiguous, so Luma updates and Luma check-ins stopped for both. Alex decided on 2026-11-22: registration must stay as smooth as possible for people who registered on Luma and sign up on the spot at the event, and he cannot approve registrations by hand on the event day. So automatic confirmation stays, no approval step and no extra step for the participant is added, and the platform only makes sure that one Luma email belongs to one active registration per event. Proof of email ownership (for example a code sent to the Luma email) is not part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In an event that uses Luma, a second account cannot register with a Luma email that another active registration of that event already uses, and it is told why.
- [x] #2 An account cannot change its Luma email to one that another active registration uses in an event where both are registered.
- [x] #3 A withdrawn or rejected registration frees its Luma email, and a withdrawn registration cannot be restored while another active registration uses its Luma email.
- [x] #4 Registration with an approved Luma guest email is still confirmed at once, without an approval by the organizer.
- [x] #5 The registration form suggests the account email as the Luma email when the account has no Luma email yet.
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
1. Docs first: in one event a Luma email belongs to one active registration (submitted or approved); withdrawn and rejected registrations free it.
2. One module owns the rule (server/domains/applications/luma-email.ts): the guest match (active registrations only) and the check that an email is still free.
3. Guards: registration, restore of a withdrawn registration, and a Luma email change on the account.
4. Registration form: suggest the account email as the Luma email when the account has none.
5. Tests: integration for every guard and for unchanged automatic confirmation; browser scenario for the suggested email.
6. Validate and commit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done in the main session on 2026-11-22. One module owns the rule: server/domains/applications/luma-email.ts (the guest match, now over active registrations only, and the two checks). An event is linked to Luma when it uses the guest list or has configured attendance sync (isEventLinkedToLuma in luma-config.ts). Guards: registration, restore of a withdrawn registration, the account's Luma email change (PATCH /api/account), and the existing verify-luma-email action, which had its own copy of the check and now uses the shared one. The existing error code luma_email_already_used is reused. The registration form suggests the account email as the Luma email while the account has none; only visible profile fields are saved, so events without the Luma field are not affected. Not changed: the platform still cannot prove that a Luma email belongs to an account, so the first account that registers with an approved guest's email is confirmed; the real guest is then refused with a clear message and an event admin frees the email by withdrawing the wrong registration. Two registrations sent at the same moment with the same Luma email can both pass the check; the guest match then finds neither until one is withdrawn. The platform-admin Luma email backfill writes Luma emails without this check. Validation on the final tree: lint, typecheck, unit (738), integration (723, nine new cases), browser suite (126 plus 1), readability check, git diff --check; the suggested Luma email was checked in the local preview.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In an event that is linked to Luma, a Luma email now belongs to one active registration (submitted or approved). A second account is refused at registration with a message that tells it what to do, a withdrawn or rejected registration frees its email, a withdrawn registration cannot come back while another registration holds its email, and an account cannot switch to an email that another active registration of a shared event holds. Registration with an approved Luma guest email is still confirmed at once, with no approval by the organizer and no extra step for the participant. The registration form suggests the account email as the Luma email.

What changed: a new module for the rule, four guards that call it, the guest match restricted to active registrations, the suggested email in the registration form, docs, and integration tests.

Verification: lint, typecheck, unit, integration and the full browser suite pass; the suggested email was checked in the local preview.

Risks and follow-ups: email ownership is still not proven (a code sent to the Luma email would close that, at the cost of one more step for participants whose emails differ); the legacy Luma backfill for platform admins bypasses the rule.
<!-- SECTION:FINAL_SUMMARY:END -->
