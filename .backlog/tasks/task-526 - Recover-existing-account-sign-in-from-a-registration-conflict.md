---
id: TASK-526
title: Reconcile Google and email sign-in with one existing platform account
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-27T22:40:00Z'
updated_date: '2026-11-27T23:28:00Z'
labels:
  - auth0
  - registration
dependencies: []
priority: high
type: bug
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auth0 gives Google and email/password distinct subjects for the same address. The platform can reach a dead-end account-consent conflict when the second subject is not linked. Recover without per-attendee cleanup, and preserve the existing platform account, event registration, and permissions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both Google-first and email-first users can link their second sign-in method to the existing account after proving control of both identities.
- [x] #2 Email equality only identifies a candidate; failed, wrong-account, or ambiguous verification never links an identity.
- [x] #3 Both providers subsequently resolve to the same existing account and preserve the original event return path and registration.
- [ ] #4 Staging verifies both signup orders and failed verification before production rollout.
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
Read-only production diagnosis: inspect provider/verification metadata and the existing platform subject using the supplied case, if account-admin access is available, without modifying it. Preferred change: use a post-login, participant-initiated linking flow owned by the platform account record, require fresh proof of both exact Auth0 identities, then persist the second subject without creating or replacing the platform account. Confirm with project owner before changing how the Auth0 flow is orchestrated.

Use the existing registration conflict and isolated Auth0 callback. A participant starts a short-lived transaction tied to the one active platform account and their event destination. Verify the exact newly used and original subjects in fresh provider sign-ins, keep the Management API link inside the Action, and persist the alias only against the original account. Exercise both orders and failure cases with synthetic fixtures, then run repository validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Released code only initiates linking from social login to a verified password Auth0 profile, and only matches raw email in the Auth0 lookup. The shown terminal error is the matching active platform email with no supported link candidate. Do not assume which provider was primary in the reported production case without read-only evidence; CLI authorization is insufficient and the available Auth0 dashboard is signed out. Unpublished sign-in-only retry code was discarded as it does not address reconciliation.

The participant starts recovery from the consent conflict. The application checks two fresh, provider-bound Auth0 subjects and the post-login Action links to the existing platform owner. Document acceptance, roles and event registration belong to that owner throughout. A completed Auth0 link can recover from an interrupted callback or platform write. The local synthetic provider ran the deployed SDK protocol and checked-in Action. Chromium exercised both signup orders and a wrong-account denial from the event registration page.

Hosted staging remains open. Pushing main invokes the test workflow, including Auth0 bootstrap apply and remote D1 migrations. These operations were outside the implementation authorization. No disposable hosted Google/password identity pairs were available. Staging needs an authorized Worker and Action deployment and two identity pairs. From the event registration page, prove both signup orders, deny a mismatched account, then confirm that either method returns to the original registration and role. Repeat the participant smoke with disposable accounts following the release decision.

Final validation passed locally with bun run lint, bun run typecheck, 727 unit tests, 801 integration tests and all 152 BDD scenarios (151 public/authenticated plus one isolated destructive scenario). The registration linking integration suite contains 14 positive, denial and interruption cases. Three additional local Chromium scenarios traversed the registration UI, actual Auth0 SDK, checked-in Action and synthetic provider. An earlier unrelated talk-proposal browser timeout passed on the full rerun. Code hygiene review and git diff --check completed.
<!-- SECTION:NOTES:END -->
