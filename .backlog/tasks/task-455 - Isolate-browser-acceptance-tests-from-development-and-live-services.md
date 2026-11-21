---
id: TASK-455
title: Isolate browser acceptance tests from development and live services
status: Done
assignee: []
created_date: '2026-11-21T15:41:00Z'
updated_date: '2026-11-21T15:51:00Z'
labels:
  - build-day
milestone: m-3
dependencies: []
references:
  - DEVELOPMENT.md
  - docs/testing-strategy.md
  - TASK-186
type: enhancement
ordinal: 173000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build Day needs repeatable browser acceptance checks that contributors and CI can run without a normal development session or a real account login.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The BDD runner uses a dedicated loopback origin and an isolated local D1 state for its run, without reusing the normal development server or database.
- [x] #2 Fixture identities exercise the intended participant and staff permissions without real login, tenant credentials, or a live identity provider.
- [x] #3 Scenarios start from known fixture data and produce the same results when rerun or when run individually.
- [x] #4 Contributor and CI entry points use the same isolated setup and document how to run the suite locally.
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The launcher uses a free loopback port, fresh local D1, and in-memory persona sessions. Chromium starts after the four personas resolve through the session API. The Codex login route returned 403, and the Auth0 SDK and linking login routes returned 404, all without redirects. Focused, overlapping, and full runs passed. The full stack passed 102 browser scenarios, including isolated account deletion and recovery. Reviewed in PR #4.
<!-- SECTION:FINAL_SUMMARY:END -->
