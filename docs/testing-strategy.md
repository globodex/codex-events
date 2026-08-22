# Testing Strategy

This document defines the canonical testing strategy for the Codex event
platform.

## Testing Layers

The platform uses three testing layers:

- `Vitest` unit tests for isolated application and domain behavior
- `Vitest` integration tests for boundaries that need multiple server modules
  or infrastructure-shaped fixtures
- `Playwright` with `playwright-bdd` for browser and API end-to-end scenarios
  against the real local Nuxt application and Cloudflare D1 runtime

BDD scenarios are authored as Gherkin feature files under
`tests/bdd/features`. Their step definitions and bootstrap support live under
`tests/bdd/steps`, `tests/bdd/bootstrap.ts`, and `tests/bdd/support`.
Generated Playwright files under `.features-gen/` are not edited by hand.

## Managed public-media validation

Managed event, platform-default, and public-gallery media tests verify the
exact current per-resource revision, immutable object pointer, stale URLs after
visibility, replacement, and removal mutations, the configured Cloudflare
Images binding, and the bounded transform selected by each named gallery
variant. Public gallery route tests require an explicit `preview` or `original`
variant. Event public-content revision tests cover submission visibility,
completion, and hide/unhide. Profile-icon and certificate tests verify private
streamed responses. Public gallery `original` tests verify the bounded
full-display transform and never expect raw R2 bytes.

Managed-media cleanup tests verify that replacement, removal, and account
deletion record the fixed cleanup kind in the D1 outbox atomically with the
pointer mutation, that dispatch is empty before 30 seconds and sends at or after
the boundary, that malformed outbox rows are quarantined without retrying or
starving later valid due rows, and that HTTP paths do not await delivery.
Producer failures remain pending with attempt metadata. Consumer tests verify
safe kind-to-bucket mapping, per-message acknowledgement, retry behavior, and
DLQ-backed exhaustion. Migration tests cover immutable and migration-era stable
keys.

Local integration tests verify response headers, streaming bodies, object-write
ordering, revision checks, and transform configuration. Source tests also verify
that the generated deployment config points Wrangler at the split Cloudflare
entrypoint, enables cache only on the named `PublicCache` export, leaves the
default gateway uncached, and forwards only sanitized requests for explicit
public routes. They also verify that
protected actor/product API success and error responses, including
unauthenticated `/api/session` and unknown generated-framework paths, emit
browser and Cloudflare no-store directives; the separate static-framework
`/api/_nuxt_icon/*.json` family preserves its generated cache headers, while
explicitly public/versioned routes retain the documented public product
contract. They do not pretend to simulate a Cloudflare edge cache hit. A real edge hit can
bypass the Worker, so deployed `CF-Cache-Status` and equivalent production
revocation verification remain a release-gate check. The read-only, opt-in
remote smoke test in `OPERATOR.md` checks authenticated then unauthenticated
`/api/session`, Cookie isolation, `CF-Cache-Status`, `Age`, public cache
controls, the split entrypoint configuration, and the zone Cache Rules/origin
no-store boundary; it does not deploy
or purge remote objects. Newly issued managed responses have the documented
`public, max-age=30, stale-if-error=0` browser and edge freshness window.

## Validation Surfaces

### Fast CI Gate

Every push and pull request runs:

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:bdd:account-workspace` on a local Chromium server bound to a
  dedicated port at or above `3204`. This focused account-workspace topology
  gate is required before the test deployment job and uses only the local
  persona fixtures and local D1 state; it does not use Auth0, deployed data, or
  a remote environment.

Public signed integration behavior, including inbound Luma attendance sync, is
covered by the unit and integration layers.

### Full BDD Gate

The complete browser and API suite runs with:

```bash
bun run test:bdd
```

GitHub Actions exposes this gate through manual `workflow_dispatch` runs and a
nightly schedule at `03:00 UTC`. It needs no GitHub environment, Auth0 tenant,
persona credentials, or authentication secrets.

The repository also exposes all test layers together:

```bash
bun run test:all
```

## Local Test Personas

BDD and the local load runner use four stable personas defined in source:

| Persona | Email | D1 authorization |
| --- | --- | --- |
| `platform_admin` | `platform-admin@bdd.codex-events.test` | Platform admin |
| `event_admin` | `event-admin@bdd.codex-events.test` | Event admin for fixture events |
| `judge` | `judge@bdd.codex-events.test` | Judge for fixture events |
| `regular_user` | `regular-user@bdd.codex-events.test` | No administrative role |

Each identity subject has the form:

```text
local-chatgpt|<normalized email>
```

The identity cookie does not contain a role or platform-user ID. Fixture rows in
D1 map the subject to a user and provide all platform and event authorization.
Tests must not encode platform roles in cookies, headers, tokens, or persona
definitions.

The BDD harness writes Playwright `storageState` files directly with the
existing local-development cookie:

```text
codex-events-local-user=<persona email>
```

The application resolves that cookie through the normal local session
middleware and then uses the same actor and authorization paths as ordinary
requests. Browser and API scenarios reuse the generated storage state.

BDD never opens Auth0 Universal Login, invokes the Codex CLI, or calls an
external identity service.

## Production Authentication Boundary

Auth0 remains the production authentication and identity provider. Application
authorization remains in the platform database.

The local persona mechanism is enabled only because the BDD and load-test Nuxt
processes run in development with the required Auth0 runtime values cleared.
Production startup does not enable local authentication.

Auth0-specific behavior such as runtime configuration, callback handling,
logout, account linking, management automation, and email verification is
covered by focused unit and integration tests. The local persona suite does not
claim to test Auth0-hosted pages or tenant behavior.

## Fixture Bootstrap

BDD bootstrap is deterministic local work:

1. Resolve the dedicated BDD D1 persistence root.
2. Clear the selected state.
3. Apply migrations.
4. Seed users, roles, events, applications, teams, submissions, judging, and
   outcome fixtures.
5. Recreate storage-state files for all four personas.

Local app development defaults to `.wrangler/state`. BDD defaults to
`.wrangler/state-bdd` and accepts `LOCAL_BDD_D1_STATE_ROOT` as its persistence
override. The guard rejects the normal local-development root for destructive
BDD reset work.

The BDD origin defaults to `http://localhost:3100`. `BDD_BASE_URL` is the only
supported origin override.

Fixture reset must:

- preserve stable persona keys and subjects
- recreate authorization and scenario rows before execution
- keep destructive scenarios isolated from the rest of the suite
- prevent one run from depending on state left by another

## Browser and API End-to-End Tests

Browser scenarios apply a persona's saved cookies to a Playwright context and
exercise the visible application.

API scenarios create a Playwright request context from the same storage state.
They do not mint alternate test tokens or bypass actor resolution.

Role-specific coverage includes:

| Product area | Primary coverage |
| --- | --- |
| Public entry and discovery | Signed-out homepage and public event flows |
| Participant account and application | Registration, applications, teams, and submissions |
| Judge workspace | Assigned blind-review workflow |
| Admin workspace | Event configuration, operations, judging oversight, and outcomes |
| Prize-recipient workspace | Prize redemption |
| Destructive account behavior | Account deletion and registration recovery |

## Browser Performance and Topology Validation

Representative Playwright journeys run in a real browser against the local Nuxt application and local D1. They cover public discovery plus signed-in participant, judge, admin, and prize-recipient workspaces.

For each navigation and tab interaction, browser instrumentation records:

- phase timings for shell navigation, account bootstrap, the critical page read, first usable state, lazy-tab completion, and media delivery;
- the declared wall-clock budget and the observed duration for each phase and journey;
- request topology, including exactly one shared bootstrap per authenticated workspace entry, exactly one critical page-shaped JSON read after bootstrap, zero feature-local session reads, and zero query-only actor refreshes;
- protected API `Server-Timing` phases, including aggregate `actor`, `actor-session` for Auth0 session resolution, `actor-d1` for the one strong identity/current-consent read, `database-session` for request-session and facade construction, `authorization`, page-loader `d1`, `serialization`, and `total`; the strong session descriptor must remain `first-primary` or `bookmark`;
- protected API execution-level D1 `Server-Timing` evidence from the capability-narrowed session adapter: `d1-exec-total` for bounded total execution/statement counts, completed total, succeeded, failed, and active work, `d1-db-total` for known D1 SQL execution time, unknown metadata count, total attempts, and serving-location summary, and at most eight `d1-exec-N` entries with request-local ordinal, `prepare` or `batch` API, kind, status, statement count, adapter attribution, known database duration, attempts, region, colo, and primary-serving flag. Batch entries may include bounded ordered per-statement SQL metadata but never claim per-statement adapter transport time. The overflow count is required when more entries exist. Tests and deployed browser profiling must verify that SQL text, bound values, result data, cookies, auth subjects, inferred table names, and raw binding/session capabilities never reach the header; missing or mixed D1 metadata is explicit. Because deployed Workers freeze `performance.now()` and `Date.now()` during CPU-only intervals and execution totals may overlap, `Server-Timing` is attribution evidence only; browser TTFB and Workers Trace/Tail CPU/wall measurements remain authoritative;

Local fake-D1 and stub bindings can verify the application’s metadata normalization and bounded timing contract, but they cannot validate the actual Cloudflare `withSession` or `batch` response metadata shape. That boundary is validated in the test environment by the signed-in real-browser journey, deployed D1 `Server-Timing`, and Workers Trace/Tail evidence; local validation does not require a live integration test or secrets.
- protected actor/product API response headers, including `CF-Cache-Status` and `Age`, so any `CF-Cache-Status: HIT` or present `Age` header on a protected API response fails the journey; explicit public/versioned event and media paths plus the static-framework `/api/_nuxt_icon/*.json` family are excluded, while unknown generated-framework paths remain protected and included;
- direct links to non-entry account-event tabs use that one selected page read with `includeEventShell=true`; the selected page loader and shell run concurrently in the same request, with the shell's independent tracks, image-options, gallery, published-prize, published-staff, credit-inventory, and meetup talk-proposal reads started in one D1 wave (participant application and membership access is a parallel branch when the shared context does not already contain it);
- cancellation of abandoned tab requests, local lazy-code loading, and the absence of runtime `unpkg` dependencies; and
- media payload constraints, including versioned cacheable URLs, allowed named variants, response content type and byte size, and the absence of public `no-store` original media in page backgrounds.

Account-event reads also assert the concrete required keys for the selected
page contract, expected API error codes for intentionally forbidden deep links,
and the absence of private fields from published roster members. Any captured
browser `console` error or page error fails the topology scenario; request
failures are asserted by the individual topology scenario so intentional
cancellation remains testable.

Failures report the actual request counts, cancellation observations, media payload facts, phase timings, wall-clock budget, and observed duration. The journey uses the same storage state, actor resolution, authorization, and local D1 fixtures as the rest of the BDD suite.

The canonical read-only account-workspace topology feature is tagged
`@task-432-5-7`. It warms each local Chromium surface before measurement, then
records request start/response/finish times through first usable UI state. Its
local budget is deliberately generous for Nuxt development mode and is not a
deployed-performance claim; run it with `BDD_BASE_URL` and a dedicated local
BDD D1 state root. The matrix includes global overview, judging, and prize
redemption only where the stable local persona fixtures authorize the surface;
the staff dashboard remains covered by server integration tests until a stable
local staff persona fixture exists.

Deployed latency evidence must come from a real browser on an uncached protected
response. Record the cold navigation wall time, response TTFB, `Server-Timing`
phase values, status, `Cache-Control`, `Cloudflare-CDN-Cache-Control`,
`CF-Cache-Status`, `Age`, and visible first usable state. Treat zero-valued
phases on a route without an explicit phase wrapper as unattributed work rather
than proof of zero execution time. A new actor optimization is not considered
deployed evidence until the test Worker has been redeployed and the same
browser journey reports the actor subphases and unchanged one-bootstrap/
one-critical-read topology.

## Local Load Runner

`tools/load-tests/local-1000-participant-event.ts` uses the same four persona
definitions and storage-state writer. Its D1 seed gives the event-admin persona
the permissions needed for API and browser probes.

The runner starts Nuxt in local-auth mode with `.env` ignored and Auth0 runtime
values cleared. It must not provision Auth0 users or depend on Codex login
state.

## Core Product Rules

- Platform roles such as platform admin, event organizer, event admin, staff,
  and judge are never modeled as identity-provider roles.
- Event-type behavior is tested through `/events` and `/api/events`.
- Hackathon-only workflows are tested only against `eventType = hackathon`.
- Meetup and Build workflows are registration-focused and reject team,
  project-submission, judging, prize, and winner operations while allowing
  event-credit operations. Meetup coverage also verifies that private talk
  proposals are available only when explicitly enabled and never appear as
  public speaker or agenda content.
- Meetup Call for talks coverage includes Meetup-only configuration and
  independent-window validation; ordered custom-question schemas, required
  answer enforcement, immutable definitions after the first proposal, and
  concurrent question-revision checks; one proposal per event/user; HTTP(S)
  link validation; submitted/approved participant eligibility; draft, submit,
  withdraw, revise, resubmit, accept, and reject transitions; owner mutation
  pauses after application rejection or withdrawal; retained owner/reviewer
  visibility; staff read-only and admin-only decisions; close/completion
  guards; unresolved completion; concurrent decision compare-and-swap; durable
  enqueue recovery; expiring delivery claims; at-least-once duplicate delivery
  and crash-retry states; conditional create-versus-disable races;
  public upcoming/open callout visibility; and account deletion.
- Simplified Meetup claiming coverage includes bounded and appendable reward
  and attendee imports, normalized-email and duplicate handling, PII
  minimization, offer visibility, configuration locking, authenticated email
  matching, idempotent coupon allocation, receipt delivery, attendance-source
  precedence, certificate eligibility, rate limiting, and the external coupon
  redirect.

Structured operation coverage uses a fresh generated-schema module and an
instrumented `z.fromJSONSchema` constructor. It verifies that module import
constructs zero schemas, the first selected getter constructs exactly one,
repeated access constructs none, a second selected ID adds exactly one, and no
unselected factory runs. Source and generator checks verify the deterministic
factory artifact. Unit and HTTP integration tests verify one final-envelope
output-validation owner, generic internal-error semantics with sanitized
server logs, shared REST/MCP operation metadata, and canonical page
serializers for any page-shaped contract.

## MCP Validation

MCP coverage uses the same local D1 actors and product fixtures as REST. Tests
create manual credentials through session-authenticated APIs and mint test-only
OAuth JWTs from an isolated signing key. Plaintext manual credentials, OAuth
access tokens, refresh tokens, and authorization codes never appear in fixture
source, snapshots, logs, or audit metadata.

- Unit tests cover credential generation/hash verification, fixed expiry,
  active-token cap, revocation, last-use coalescing, registry uniqueness,
  annotations, capability filtering, and error sanitization.
- Integration tests cover token APIs and account deletion, protocol
  initialize/list/call, protected-resource discovery, OAuth issuer/signature/
  expiry/audience/subject/client validation including scope-less strict-third-party
  tokens, invalid/expired/revoked manual
  credentials and deleted-owner failures, OAuth subject mapping, current role and consent
  changes, host/origin checks, rate limiting, mutation audits, and
  representative REST/MCP parity across both authentication methods.
- Auth0 configuration tests cover CIMD-only registration, trusted Client ID
  Metadata Document URL validation and idempotent import, domain-level
  connection access, the default third-party user grant for the `mcp`
  permission, and absence of post-login custom-scope injection.
- Completeness tests fail for missing or duplicate eligible REST/tool mappings
  and for advertised excluded operations, including binary, token-management,
  account-deletion, public-mutation, webhook, and system routes.
- BDD covers the OAuth-first settings presentation, focused
  create/copy/done/revoke manual-token behavior, and representative
  participant, event-admin, and platform-admin calls.
- Test-environment smoke uses MCP Inspector as the protocol baseline and covers
  protected-resource and authorization-server discovery, CIMD, Authorization
  Code with PKCE, token issuance for the exact MCP audience, `tools/list`, and
  a representative `tools/call`. Separate ChatGPT and Codex checks use their
  own client identities and redirect contracts. A short-lived manual credential
  confirms the secondary authentication path. Smoke evidence records only tool
  names and objective outcomes.

The Cloudflare build is part of the MCP validation gate.

## Unsupported Patterns

The following are not part of the supported testing strategy:

- Live Auth0 or Codex login automation in the deterministic local BDD suite
- test-only authentication endpoints
- bypass headers that impersonate users
- hard-coded JWTs or alternate application tokens
- identity cookies that contain application roles
- authorization assertions that depend on Auth0 roles
- remote identity or database dependencies in local BDD bootstrap
