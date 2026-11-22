---
id: TASK-482
title: Lint the source files in folders named public
status: Done
assignee:
  - '@claude'
created_date: '2026-11-22T22:35:00Z'
updated_date: '2026-11-22T23:05:00Z'
labels: []
dependencies: []
references:
  - eslint.config.mjs
modified_files:
  - eslint.config.mjs
  - app/components/public/events/EventCertificateCard.vue
  - app/components/public/events/EventPrizeList.vue
type: chore
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`bun run lint` skips every source file under a folder named `public`: `app/components/public/**` and `server/api/public/**`, 33 `.vue` and `.ts` files on 2026-11-22. ESLint prints "File ignored because of a matching ignore pattern" only when such a file is passed by name, so the full lint run stays green and nobody sees the gap. The pattern comes from the Nuxt ESLint preset (`@nuxt/eslint-config` 1.17.0, function `ignores()`), which ignores `**/public` for the static files in the root `public/` folder. This project also uses `public` as a folder name for the public event components and the public API routes. Found on 2026-11-22 during TASK-480: with ignores turned off, ESLint reports 9 errors and 2 warnings in `EventCertificateCard.vue`, `EventPrizeList.vue` and `EventTalkProposalCallout.vue`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `bun run lint` checks the `.vue` and `.ts` files under `app/components/public` and `server/api/public`, and `bunx eslint app/components/public/events/EventAgendaPanel.vue` prints no "File ignored" warning.
- [x] #2 The static root `public/` folder stays ignored, and the lint run gains only the source files under folders named `public`.
- [x] #3 A short comment in `eslint.config.mjs` says why the ignore rule is there.
- [x] #4 The lint problems that were hidden in these folders are fixed without a change to behavior or visible text.
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
1. In `eslint.config.mjs`, add `!**/public` and `public/` to the ignore list of the project, with a comment. The first pattern cancels the `**/public` of the preset, the second one ignores only the root static folder. A new source folder named `public` is then linted without another config change.
2. Compare the list of linted files before and after. The difference must be exactly the files under `app/components/public` and `server/api/public`.
3. Run `bunx eslint --fix` on the three reported components and fix by hand what remains. Compare the compiled components before and after to show that the output is the same.
4. Run `bun run lint`, `bun run typecheck` and `bun run test:unit`, then the codehygiene check on the changed `.mjs` file.
5. Commit and push to `origin/main`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cause: `@nuxt/eslint-config` 1.17.0 adds the global ignore `**/public` in its `ignores()` function (`node_modules/@nuxt/eslint-config/dist/shared/eslint-config.*.mjs`). The pattern matches a folder named `public` at any depth.

Change: `eslint.config.mjs` adds `'!**/public'` and `'public/'` to the ignore list of the project. The first pattern cancels the pattern of the preset, the second one ignores only the root static folder. A new source folder named `public` is linted without another config change. The other option was to list the two folders by name; it would leave the same trap open for the next folder named `public`.

Linted files (JSON report of `eslint .` at 6a410751): 1082 before, 1115 after. The 33 new files are exactly the files on disk under `app/components/public` and `server/api/public`, and no file left the run. Probes with `ESLint.isPathIgnored`: files under the root `public/`, `.output/public`, `.features-gen/public`, `node_modules/*/public` and `storybook-static` stay ignored.

Hidden problems: 9 errors and 2 warnings. `bunx eslint --fix` on the three files fixed all of them; nothing had to be fixed by hand.
- `EventCertificateCard.vue`: 4 x `vue/quote-props` on one `:style` object. Two keys are CSS custom properties and need quotes, so the rule wants all six keys quoted.
- `EventPrizeList.vue`: 1 x `vue/block-tag-newline`, an empty line before `</script>`.
- `EventTalkProposalCallout.vue`: 2 x `vue/max-attributes-per-line` (warnings) on the `AppCard` tag and 4 x `vue/singleline-html-element-content-newline` on the `<h2>` and the `<p>`.

Where the callout fix landed: while this task ran, the session of TASK-483 rewrote `EventTalkProposalCallout.vue` in the shared folder on top of the formatting fix and committed the whole file in a55a7851. So the fix for that component is on `main` through that commit, and the commit of this task holds `eslint.config.mjs`, `EventCertificateCard.vue` and `EventPrizeList.vue`.

Proof that behavior and visible text are the same: each component was compiled with `@vue/compiler-sfc` before and after the fix (script, client render, server render). `EventCertificateCard.vue` and `EventPrizeList.vue` give the same code once object keys are printed the same way. The formatting fix of `EventTalkProposalCallout.vue` changed one thing: the heading text node is `" Call for talks "` instead of `"Call for talks"`, as in every other heading that follows this lint rule. In headless Chromium both headings have the same `innerText` (`Call for talks`), the same text width (134.25 px) and the same height.

Validation (2026-11-23) ran in a clean copy of `main` at a55a7851 plus the three changed files (a temporary git worktree), because other sessions changed the shared folder during the task: `bun run lint` passed (1118 files, 0 errors, 0 warnings, 35 of them under the two `public` source folders); `bun run typecheck` passed; `bun run test:unit` passed (141 files, 716 tests); `bunx eslint app/components/public/events/EventAgendaPanel.vue` prints nothing; `bunx eslint public/site.webmanifest` still prints the "File ignored" warning; `git diff --check` is clean; codehygiene on `eslint.config.mjs` has no findings. No test was added, because the change is lint configuration and formatting. `bun run test:integration` and `bun run test:bdd` were not run, because no server code and no flow changed.

Unit tests under load: two earlier runs of `bun run test:unit` ended with 9 and 4 `TestTimeoutError` failures in heavy tests (for example `operations.test.ts` and `http-database-boundary.test.ts`). At that time another session ran its own tests and the load average was up to 176 on 10 cores. The tests do not import the changed files, and the suite passed once the machine was calm.

Test gap: no test guards the two ignore patterns. If the preset changes its pattern in a later version, the folders can be skipped again without an error.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`bun run lint` now checks the source files in folders named `public`. The Nuxt ESLint preset ignores `**/public`; `eslint.config.mjs` cancels that pattern with `!**/public` and ignores only the root static folder with `public/`. A comment in the file says why. At the start of the task the lint run grew from 1082 to 1115 files: the 33 new files were exactly those under `app/components/public` and `server/api/public`, and the root `public/` folder stays ignored. A new source folder named `public` is linted without another config change.

The 9 errors and 2 warnings that were hidden in `EventCertificateCard.vue`, `EventPrizeList.vue` and `EventTalkProposalCallout.vue` were formatting problems, and `eslint --fix` fixed all of them. The compiled components are the same, apart from one space before and after the `Call for talks` heading text, which browsers do not show. The fix for `EventTalkProposalCallout.vue` reached `main` in commit a55a7851 of TASK-483, which changed that component at the same time; the commit of this task holds the config and the other two components.

Validation in a clean copy of `main`: `bun run lint`, `bun run typecheck` and `bun run test:unit` (141 files, 716 tests) pass.

Risk: no test guards the two ignore patterns. After an upgrade of `@nuxt/eslint`, run `bunx eslint app/components/public/events/EventAgendaPanel.vue`. A "File ignored" warning means that the preset changed its pattern. No follow-up is open.
<!-- SECTION:FINAL_SUMMARY:END -->
