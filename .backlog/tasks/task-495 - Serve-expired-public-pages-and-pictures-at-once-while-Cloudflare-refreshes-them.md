---
id: TASK-495
title: >-
  Serve expired public pages and pictures at once while Cloudflare refreshes
  them
status: Done
assignee:
  - '@claude'
created_date: '2026-11-25T16:08:00Z'
updated_date: '2026-11-25T18:21:00Z'
labels: []
milestone: m-3
dependencies: []
modified_files:
  - shared/http/public-cache-topology.ts
  - server/http/cache-policy.ts
  - server/domains/events/photos.ts
  - docs/tech-stack.md
  - docs/api-surface.md
  - docs/testing-strategy.md
  - OPERATOR.md
  - AGENTS.md
  - tests/unit/server/domains/events/public-cache.test.ts
  - tests/unit/server/domains/events/images.test.ts
  - tests/unit/shared/http/public-cache-topology.test.ts
  - tests/integration/server/http/cache-policy.test.ts
  - tests/integration/server/api/actor-platform-routes.test.ts
  - tests/integration/server/api/event-routes.test.ts
  - tests/bdd/steps/public-events.steps.ts
  - tests/bdd/steps/admin-configuration.steps.ts
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First visits to public event pages take about 2.5 seconds. The site is quiet, so the 30-second Cloudflare copies of the event page and its banner have almost always expired: the Worker renders the page again (2.0 s) and Cloudflare Images remakes the banner (0.45 s) while the visitor waits (measured on 2026-11-25 on the astra-commons-vienna page in a fresh browser). Alex wants first loads to be instant before the Vienna Build Day on 28 November 2026.

Workers Cache supports stale-while-revalidate: it sends the expired copy at once and refreshes it in the background (https://developers.cloudflare.com/workers/cache/configuration/). Cloudflare does not document what happens to a stale copy when the refresh answers with an uncacheable 404, so a hidden event may stay visible to people who open its link until the stale window ends. Alex chose a one-day window on 2026-11-25 with that trade-off. Gallery photos stay strict, because a participant can ask to have a photo removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cloudflare-CDN-Cache-Control of public page HTML (home page and event pages), public event JSON, event banner and background pictures and the platform default background is public, max-age=30, stale-while-revalidate=86400, stale-if-error=0, while browsers keep Cache-Control public, max-age=30, stale-if-error=0
- [x] #2 Public gallery photo pictures keep public, max-age=30, stale-if-error=0 in both headers, without a stale window
- [x] #3 The API cache policy keeps a public response public only when it carries the exact header set of its own path; any other response gets private, no-store
- [x] #4 Canonical docs and AGENTS.md describe the one-day stale window, what it means for hidden events and replaced pictures, and the strict gallery photos
- [x] #5 Tests cover both header sets and the path-specific policy check
- [x] #6 On the deployed test site, expired public pages and public event JSON answer at once with cf-cache-status UPDATING
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
1. shared/http/public-cache-topology.ts: publicEventCdnCacheControl adds stale-while-revalidate=86400. Browsers keep publicEventCacheControl (30 seconds, no stale window), so an organizer who reloads after an edit never gets a day-old copy from their own browser. A new publicGalleryPhotoCdnCacheControl keeps gallery photo pictures strict, and publicCdnCacheControlForPath(path) picks the Cloudflare header for a path.
2. server/http/cache-policy.ts: the check that keeps a public response public compares the Cloudflare header with the one for the request path.
3. server/domains/events/photos.ts: public gallery photo pictures use the strict Cloudflare header.
4. Docs: tech-stack.md, api-surface.md, testing-strategy.md, OPERATOR.md and AGENTS.md describe the stale day and its trade-off.
5. Tests: exact header expectations; the integration cache policy test shows that a gallery photo picture with the stale header becomes private while other public paths keep it.
6. Lint, typecheck, unit and integration tests, and the browser scenarios that check public cache headers.
7. Commit, push, and measure an expired page and picture on the test site (UPDATING).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on 2026-11-25. Cloudflare's Workers Cache docs (developers.cloudflare.com/workers/cache/configuration/) say Workers Cache reads Cloudflare-CDN-Cache-Control first, honors stale-while-revalidate asynchronously (the request that finds an expired copy gets it at once with cf-cache-status UPDATING) and disables it for s-maxage, must-revalidate and proxy-revalidate. They do not say what happens to the stale copy when the refresh answers an uncacheable 404, so the docs now state a revocation bound of up to one day for hidden events and replaced or removed event images. Only the Cloudflare header gets the stale window: browsers keep public, max-age=30, stale-if-error=0, so an organizer who reloads after an edit never gets a day-old copy from their own browser. publicCdnCacheControlForPath in shared/http/public-cache-topology.ts picks the Cloudflare header by path (gallery photo pictures strict), and the API cache policy compares against it. Checks so far: lint, typecheck, unit tests (720), integration tests (777).

Test site check on 2026-11-25 after deploy-test run 45668110197 (commit 5a9f511b, which includes this change): the home page, /events/astra-commons-vienna and /api/public/events/astra-commons-vienna answered MISS then HIT; 40 seconds later each answered UPDATING with age 41-42 and a first byte of about 0.10-0.14 s; 3 seconds later each answered HIT with age 3-4, so the background refresh had replaced the copy. The test site has no event pictures, so pictures were not measured there; they use the same header and cache entrypoint. The push of e58b49d9 happened during a GitHub outage and started no workflow; a manual workflow_dispatch ran the checks and the full BDD suite (both passed) but does not deploy, so the next push deployed it.

Production check on 2026-11-25 after release v1.23.0 (deploy-production run 45673597561): the Vienna event page, its public JSON and its banner picture answered UPDATING after 40 seconds (age 40-44, first byte 0.07-0.10 s) and HIT with age 2-3 three seconds later. The first banner request was a MISS at 0.77 s, the next a HIT at 0.10 s.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Public pages, public event JSON, event pictures and the platform default background now carry a one-day stale-while-revalidate window in Cloudflare-CDN-Cache-Control. When the 30-second copy has expired, Workers Cache sends it at once and refreshes it in the background, so a first visitor no longer waits for the Worker to render the page (about 2 s) or for Cloudflare Images to make the picture (about 0.5 s). Browsers keep 30 seconds without a stale window, so organizers never get a day-old copy from their own browser, and gallery photos stay strict so a removed photo is gone within 30 seconds. The cache policy checks the exact Cloudflare header for each path.

Verification: lint, typecheck, unit tests (720), integration tests (777), the 5 browser scenarios that check public cache headers, the full BDD suite in GitHub, and the test site (UPDATING at about 0.1 s first byte after the 30 seconds, then HIT).

Risk, accepted by Alex: Cloudflare does not document what happens to a stale copy when the refresh answers 404, so a hidden event or a replaced or removed event picture can stay reachable at its old address for up to one day. Follow-up check: after the production release, measure one event picture (expect UPDATING after 30 seconds).
<!-- SECTION:FINAL_SUMMARY:END -->
