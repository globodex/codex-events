---
id: TASK-510
title: Stop cached scripts from loading the stylesheet of an older release
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T23:13:00Z'
updated_date: '2026-11-25T23:15:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - tools/build/release-script-names.ts
  - nuxt.config.ts
  - docs/tech-stack.md
type: bug
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the v1.26.0 release on 2026-11-25, returning visitors kept the old size of the Details popup. Three scripts kept their names across the release although their content changed: Vite adds the stylesheets that a script preloads after it has named the script from its code. Browsers cache scripts for a year as immutable files, so they kept the old copies, which load the stylesheet of v1.25.0 after the new one and override newer styles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A deployment build gives every script a name that differs from the names of the previous release
- [x] #2 Stylesheets keep names that follow their content
- [x] #3 Two builds with different commits share no script name, and the docs explain why
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
Vite 8 fills the preload list of a script (__vite__mapDeps, CSS included) in generateBundle, after the file names are fixed; build.modulePreload.resolveDependencies never sees CSS, and the chunk import map mode that hashes these lists needs an import map in the HTML that Nuxt does not write. Turning off CSS splitting would load the editor and gallery styles on every page. A build plugin that adds GITHUB_SHA through augmentChunkHash is the smallest fix. No automated test checks the build output; the proof is three local builds.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every deployment build now mixes its commit (GITHUB_SHA) into the name hash of every script (tools/build/release-script-names.ts, added to the Vite plugins in nuxt.config.ts). Each release therefore uses new script names, so a browser cannot reuse a script cached from an earlier release that loads an older stylesheet; stylesheets keep content-based names. Local builds without GITHUB_SHA keep code-based names.

Verification: two production builds with different commit values shared none of their 322 script names, kept all 9 stylesheet names, and a rebuild with the same value reproduced all 322 names. Lint, typecheck and 725 unit tests pass. Returning visitors get new script names with the first page load after this release, which also removes the stale v1.25.0 stylesheet.
<!-- SECTION:FINAL_SUMMARY:END -->
