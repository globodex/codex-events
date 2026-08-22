---
id: TASK-438
title: Simplify participant registration architecture
status: Done
assignee:
  - '@Codex'
created_date: '2026-08-22 18:20'
updated_date: '2026-08-22 19:01'
labels: []
dependencies: []
references:
  - 'app/pages/events/[slug]/register.vue'
  - app/components/applications/participant-registration
  - app/domains/applications/participant-registration-definition.ts
  - docs/domain-model.md
modified_files:
  - 'app/pages/events/[slug]/register.vue'
  - app/domains/applications/participant-registration-definition.ts
  - app/domains/applications/participant-application-form.ts
  - app/domains/applications/participant-registration-experience.ts
  - app/components/applications/participant-registration
  - app/components/talk-proposals/molecules/TalkProposalQuestionInput.vue
  - app/components/talk-proposals/organisms/TalkProposalRegistrationSection.vue
  - app/composables/useParticipantRegistrationForm.ts
  - tests/unit/app/components/participant-registration-atomic-contract.test.ts
  - tests/unit/app/components/participant-registration-controller.test.ts
  - tests/unit/app/domains/applications/participant-application-form.test.ts
  - >-
    tests/unit/app/domains/applications/participant-registration-experience.test.ts
  - >-
    tests/unit/app/domains/applications/participant-registration-definition.test.ts
priority: high
type: enhancement
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce participant registration complexity by replacing repeated visibility, validation, progress, focus, CFP-extension, and payload rules with one defensive domain definition and a domain-grouped component surface. Preserve the approved registration UX and contracts while restoring canonical teammate-hint behavior for every event with visible team participation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One resolved participant-registration definition owns track-versus-AI, visible profile groups, participation, commitments, typed field/section identifiers, validation inputs, progress evaluation, and payload projection.
- [x] #2 Participant-registration UI and its single-consumer controller are grouped together by domain, while substantive section components remain explicit and the one-use ChoiceGroup, ProgressItem, template tier, and generic additional-section escape hatch are removed.
- [x] #3 Meetup, Build, and Hackathon registrations show configured teammate hint rows whenever visible participation mode is team and the configured team size permits hints.
- [x] #4 CFP registration is an explicit typed section with one validation/progress/focus/submission path, not caller-authored completion, error, or DOM-target metadata.
- [x] #5 Field and section navigation contracts use typed identifiers or central derivation so supported renames cannot silently break focus or rail navigation.
- [x] #6 Architecture source-string tests are replaced with behavior tests covering visibility, progress, validation, navigation, focus, payloads, and combined CFP submission.
- [x] #7 The existing approved registration visuals, API shapes, lifecycle, redirects, copy, and desktop/mobile behavior remain unchanged outside the canonical teammate-hint correction.
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
1. Replace participant-application-form.ts and participant-registration-experience.ts with one participant-registration-definition.ts. The resolved definition will own the typed draft, Zod schema, track-versus-AI choice, profile groups, application/participation/commitment/CFP sections, typed section and field IDs, progress, first-invalid lookup, and visible-only account/application payload projection.
2. Flatten the single feature under app/components/applications/participant-registration/. Keep ParticipantRegistrationForm plus substantial Profile, Application, Participation, Commitments, Talk Proposal, and Progress components and the reusable Field wrapper. Colocate useParticipantRegistrationController.ts. Remove ChoiceGroup, ProgressItem, the templates tier, the external CFP registration organism, and the generic additional-section/slot contract.
3. Keep register.vue as the request boundary. It will own route/account/event fetching, the one typed registration draft, profile patch and application POST calls, server errors, submission transition, and redirects. It will resolve one definition and pass that same value through rendering, validation/progress/focus, and payload projection.
4. Restore teammate rows for Meetup, Build, and Hackathon whenever participation is visible, team is selected, and maxTeamMembers allows hints. Central helpers will generate all section DOM IDs and dynamic profile, teammate, and CFP question field IDs.
5. Replace source-string architecture tests with Vue-mounted controller behavior tests and focused definition tests for minimal Meetup, Build tracks, Build AI Knowledge, Hackathon, Meetup/Build teammate hints, hidden/optional/malformed values, commitments/terms, progress, rail navigation, focus, visible payloads, and explicit CFP questions/combined submission. Preserve the existing authenticated CFP BDD path.
6. Run targeted checks, lint, typecheck, unit, integration, and BDD. Then use IAB at 1600x1000 and 390x844 in light/dark across all five variants, compare against TASK-437 captures, save evidence outside the repository, audit the scoped diff and production line/file counts, finalize TASK-438, commit only scoped files, and push main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Research classified this as L2 because it changes a public registration architecture while preserving contracts. Canonical domain, API, and schema docs already define teammate hints for visible team participation and the exact visible-only application/CFP contract; implementation confirmed those docs remain current and no canonical edit is required. Baseline was local main at 777b3509e5ce24841aa4e4f0ba51e82abdd78291, equal to origin/main, with 15 scoped production files / 2,882 lines.

The implemented surface is 12 scoped production files / 2,596 lines: 3 fewer files and 286 fewer lines. One resolved typed participant-registration definition now owns the draft, Zod schema, track-versus-AI choice, visible profile groups, participation and teammate hints, commitments, explicit CFP section, typed section/field IDs, progress evaluation, first-invalid lookup, and visible-only account/application payload projection. The route remains the request lifecycle boundary for fetching, account patching, application/CFP submission, server errors, transitions, redirects, and cancellation.

Retained abstractions each have a concrete owner: ParticipantRegistrationForm is the responsive shell and submission transition; Profile, Application, Participation, Commitments, and Talk Proposal remain substantive domain sections; ProgressRail owns desktop navigation/status; Field centralizes reused label/error/helper chrome; the colocated controller owns submit-attempt state plus reduced-motion-aware rail scrolling and first-invalid focus; TalkProposalQuestionInput remains a shared question renderer with its registration-specific field-prefix coupling removed. The one-use ChoiceGroup, ProgressItem, template tier, generic additional-section/target contract, external CFP registration organism, and split form/experience authorities were deleted.

Focused behavior coverage exercises minimal Meetup, Build tracks, Build AI Knowledge, Hackathon, teammate hints for Meetup/Build/Hackathon, hidden/optional/malformed values, commitments/terms, reactive progress, rail navigation, reduced-motion and first-invalid focus, visible-only account/application payloads, explicit CFP questions, and combined CFP projection. Full browser evidence covers all five variants at 1600x1000 and 390x844 in light and dark themes, with no blank render, framework overlay, console errors, or horizontal overflow; desktop rails, mobile progress/fixed submit, conditional fields, teammate hints on configured non-Hackathon Build events, submit and rail focus, and the successful CFP account-workspace redirect were verified. Screenshots are stored at /Users/alex/.codex/visualizations/2026/08/22/01a0291e-d246-71e1-8410-f1660d2bc0e7/task-438-qa. No material visual deviation from TASK-437 was found beyond the required canonical teammate-hint restoration.

Supported residuals are limited to test-environment evidence: local fixtures needed an isolated D1 update to exercise a configured non-Hackathon team size because the normal event-authoring API currently coerces it to one; exact CFP payload projection is asserted in unit tests while the browser proves the combined redirect because IAB did not retain POST data after navigation; the local Nuxt dev server emitted pre-existing HMR/VueUse warnings while the browser console, overlays, integration, and BDD checks stayed clean. No setup, auth, permissions, API, schema, lifecycle, or deployment change was introduced.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the defensive participant-registration architecture around one resolved typed definition. Validation, progress, rendering, focus, teammate-hint visibility, visible-only payload projection, and the explicit CFP path now consume that same definition. The feature is grouped under app/components/applications/participant-registration with the controller colocated; substantive domain sections and the reusable field wrapper remain, while the one-use ChoiceGroup, ProgressItem, template tier, external CFP registration organism, generic extension contract, and split form/experience authorities are removed.

The scoped production surface changed from 15 files / 2,882 lines to 12 files / 2,596 lines (-3 files, -286 lines). Canonical docs remain accurate. Focused tests pass 15/15; lint and typecheck pass; unit passes 172 files / 1,141 tests; integration passes 44 files / 495 tests; BDD passes all 94 scenarios. Browser QA covers five registration variants at desktop/mobile and light/dark in /Users/alex/.codex/visualizations/2026/08/22/01a0291e-d246-71e1-8410-f1660d2bc0e7/task-438-qa, including non-Hackathon teammate hints, rail and submit focus, conditional sections, zero overflow, console/overlay health, and successful combined CFP redirect. No material visual deviation was found outside the required teammate-hint restoration.

Residual evidence limits are documented in Implementation Notes; they do not change supported production behavior.
<!-- SECTION:FINAL_SUMMARY:END -->
