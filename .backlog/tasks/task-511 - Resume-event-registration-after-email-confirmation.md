---
id: TASK-511
title: Resume event registration after email confirmation
status: Done
assignee:
  - '@codex'
created_date: '2026-11-26T08:22:00Z'
updated_date: '2026-11-26T09:07:00Z'
labels: []
dependencies: []
documentation:
  - docs/api-surface.md
modified_files:
  - app/pages/account/register.vue
  - app/composables/useAccountRegistrationEmail.ts
  - server/api/account/email-verification.get.ts
  - server/api/account/email-verification.post.ts
  - server/api/account/registration.post.ts
  - server/domains/accounts/email-verification.ts
  - server/domains/accounts/index.ts
type: bug
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A participant can confirm their address in Auth0 and still see the confirmation prompt when returning to account registration. The app session still holds the verification status from sign-in, so the participant has to sign out and back in to finish.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Returning to account registration after confirming an email reveals the consent form and preserves the original event destination.
- [x] #2 Account creation requires verified status for the signed-in identity and email, including when the original session still says unverified.
- [x] #3 An unverified address can receive another confirmation email. Retrying a failed status check is possible from the registration page.
- [x] #4 The ordinary session request resolves the actor without calling Auth0.
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
1. Check current Auth0 user status within the account registration and resend routes.
2. Refresh the verification step when the registration page opens or regains focus.
3. Verify the browser handoff, server guards, and ordinary session behavior.

4. Recheck on a visible page or a focused window following the Gemini 4 Neon XHigh review.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Account registration checks Auth0 when the signed-in participant returns after email confirmation. It shows the consent form in the same session and keeps the original event destination. The server verifies the same subject and email before writing the account when the session has a stale claim. Resend checks the current status before requesting another email.

The agy review with Gemini 4 Neon XHigh found that a visibility change without a focus event could miss the automatic check. Registration now responds to either signal and can check while a resend is in progress. XHigh reviewed the follow-up and found no remaining blocking issue in the return flow.

Lint, type checking, 725 unit tests, 787 integration tests, and 149 browser scenarios passed. The browser tests cover both return signals and simulate Auth0. Code Hygiene found no issues in the follow-up files. The live Auth0 email link is outside this test coverage.
<!-- SECTION:FINAL_SUMMARY:END -->
