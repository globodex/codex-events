---
id: TASK-457
title: Publish Groma architecture previews for pull requests
status: In Progress
assignee:
  - '@codex'
created_date: '2026-11-21T15:52:00Z'
updated_date: '2026-11-21T15:56:00Z'
labels: []
dependencies: []
references:
  - .github/workflows/groma-pages.yml
  - https://github.com/MrLesk/groma.md-action/releases/tag/v1.3.0
  - .github/workflows/groma-pr-request.yml
modified_files:
  - .github/workflows/groma-pages.yml
  - .github/workflows/groma-pr-request.yml
  - DEVELOPMENT.md
  - AGENTS.md
  - groma/config.json
  - groma/index.md
  - groma/project.md
  - groma/systems/codex-events/system.md
  - groma/systems/codex-events/components/certificates.md
  - groma/systems/codex-events/components/events-index-get.md
  - groma/systems/codex-events/components/presentation.md
  - groma/systems/codex-events/components/prizes.md
  - groma/systems/codex-events/components/public-cache-topology.md
  - groma/systems/codex-events/components/public-cache.md
  - groma/systems/codex-events/components/public-homepage.md
  - groma/systems/codex-events/components/slug-index-get.md
  - groma/systems/codex-events/components/states.md
type: feature
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reviewers need a before-and-after architecture map on pull requests for the Codex Events platform.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A committed Groma map for Codex Events is accessible on GitHub Pages.
- [ ] #2 Same-repository PR activity starts a trusted comparison publisher through regular PR workflow events, and maintainers can request a comparison manually.
- [ ] #3 Use the shared Groma publisher and keep architecture deployment separate from Cloudflare application deployment.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Canonical docs were updated or confirmed unchanged
- [ ] #2 Code behavior matches canonical docs
- [ ] #3 Relevant validation commands pass
- [ ] #4 Tests were added or updated when behavior changed
- [ ] #5 Test gaps are documented when automation is not practical
- [ ] #6 Config and developer workflow docs were updated when setup changed
- [ ] #7 Auth and permissions changes follow the documented platform model
- [ ] #8 Risks and follow ups are recorded in the task summary
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Initialize the Groma architecture with source scanning.
2. Add the released Groma map and PR publisher workflows with the regular PR-event signal.
3. Enable GitHub Pages, publish the map, and verify comparison publication.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initialized a first scan of nine public TypeScript files. Rescans are byte-stable and static export works. GitHub Pages uses the shared publisher and its default-branch deployment policy. YAML and Bash validation passed. The project lint, typecheck, and 1,177 unit tests passed with Bun 1.4.5.
<!-- SECTION:NOTES:END -->
