---
id: TASK-441
title: Upgrade all dependencies and resolve GitHub security alerts
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-05T11:31:00Z'
updated_date: '2026-11-05T12:10:00Z'
labels: []
dependencies: []
priority: high
type: chore
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Alex requested the latest stable package releases, fixes for breaking changes, and no remaining open GitHub security warnings. The baseline has 10 Dependabot alerts and one CodeQL finding in the MCP output-schema generator.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All direct dependencies and the pinned Bun and CI actions use the latest stable releases, with any unavoidable exception explained.
- [x] #2 Breaking changes are fixed and required lint, typecheck, unit, integration, browser, and production build checks pass.
- [ ] #3 Dependency audit and GitHub security checks have no unresolved findings after the fixes are pushed.
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
1. Inspect dependency releases and security findings.
2. Upgrade dependencies, Bun, and CI actions; fix breaking changes and the schema generator finding.
3. Regenerate notices and run all required checks plus the Cloudflare production build.
4. Commit and push only task files; verify CI and GitHub alerts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated 38 direct packages and CI/Bun pins. TypeScript remains at 6.0.3: latest vue-tsc and typescript-eslint require the removed TypeScript 6 JavaScript API. Latest Satori uses its standalone layout.wasm; removed yoga-wasm-web. Security overrides cover pinned transitive advisories; minimatch 11 requires a checked-in import-x patch, tested through both ESM and CommonJS. Bun audit now has only GHSA-gcqx-w48m-w2h4 (deepmerge through Rollup); no patched version exists and upstream reports the CVE rejected, while GitHub advisory metadata still reports it. No alert is dismissed or audit result suppressed.

Latest Vue language-core 3.3.14 rewrites // inside URL property literals into block comments, causing false template scope errors. Added a one-line anchored-comment patch and a generated-TypeScript parsing regression test. Production Cloudflare build passes, including statically imported Satori layout.wasm. Real local certificate requests render valid 1200x630 PNGs; migrated border-box sizing and constrained footer/QR flex layout, then visually checked participant and first-place certificates. Latest unit count is 1174; integration count is 508. Initial BDD attempt was invalidated by unit tests clearing shared local persona storage, so BDD is now isolated from unit runs.

Frozen bun ci --ignore-scripts passes. Final lint and typecheck pass. All direct packages are current except the documented TypeScript 6.0.3 toolchain constraint. The full BDD public/authenticated batch reached 97/100 passing; three public navigations timed out during a source-change dev-server reload. The final full suite will run after all code edits and production-build checks complete, with no parallel unit runs or file edits.

Final validation passes: bun run lint; bun run typecheck; bun run test:unit (178 files, 1174 tests); bun run test:integration (44 files, 508 tests); bun run test:bdd (100 public/authenticated plus 2 destructive scenarios); bun run build:cloudflare; bun ci --ignore-scripts; git diff --check. Browser request-topology/cancellation gates pass with no captured console or page errors. Final bun audit still reports the single disputed low-severity deepmerge advisory with no fixed upstream release. Criterion 3 remains open pending GitHub re-scan and that upstream advisory; no warnings are hidden.

Pushed implementation commit 007704dc78bffd12f62091b0a252b470eb9a1d14 to origin/main. GitHub has zero open Dependabot, code-scanning, and secret-scanning alerts. Both CodeQL analyses (JavaScript/TypeScript and Actions) completed successfully on that exact commit. GitHub backend-checks also passed lint, typecheck, unit tests, and integration tests. Remaining CI browser/deployment steps are being monitored; the single disputed low-severity deepmerge audit advisory remains visible with no published upstream fix.

First GitHub browser gate failed only on the initial Operations navigation (24/25 passed): it observed a second bootstrap after 3.7 seconds while the first Operations request was still open. A fresh local Vite-cache run passed 25/25 and optimizer diagnostics showed vee-validate, @vee-validate/zod, and zod discovered after startup. Added these exact shared form dependencies to the existing optimizeDeps include list to avoid a late dev pre-bundle reload; request counts and the browser gate remain unchanged. Revalidating from a fresh cache before a follow-up push.

Follow-up validation passes: lint, typecheck, all 1174 unit tests, production Cloudflare build, and all 25 focused browser scenarios with an empty Vite cache. Optimizer debug logs confirm the three form-validation dependencies are present at startup and are no longer discovered during browser measurement. No request-topology assertions or timing budgets were relaxed.
<!-- SECTION:NOTES:END -->
