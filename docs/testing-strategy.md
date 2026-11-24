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
full-display transform and never expect raw R2 bytes. Explicit gallery download tests verify exact uploaded bytes, attachment filenames and content types, no browser/CDN caching, cache-entrypoint bypass, and rejection of unauthorized, hidden, stale, or deleted photos.

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
| `judge` | `judge@bdd.codex-events.test` | Judge for fixture events; event staff for the staff check-in fixture event and the participant photos fixture event; confirmed participant of the check-in flow fixture event, the two credit claim fixture events, and the challenges fixture event |
| `regular_user` | `regular-user@bdd.codex-events.test` | No administrative role |

Each identity subject has the form:

```text
local-chatgpt|<normalized email>
```

The identity cookie does not contain a role or platform-user ID. Fixture rows in
D1 map the subject to a user and provide all platform and event authorization.
Tests must not encode platform roles in cookies, headers, tokens, or persona
definitions.

Playwright creates the local persona cookie in memory for each browser or API context. The app resolves it through the local session middleware, then uses the normal actor and permission checks. The BDD server disables interactive Codex and Auth0 sign-in.

## Production Authentication Boundary

Auth0 remains the production authentication and identity provider. Application
authorization remains in the platform database.

The BDD launcher explicitly enables persona sessions in its development server. The load-test server uses the local development session mode. Production uses Auth0.

Auth0-specific behavior such as runtime configuration, callback handling,
logout, account linking, management automation, and email verification is
covered by focused unit and integration tests. The local persona suite does not
claim to test Auth0-hosted pages or tenant behavior.

## Fixture Bootstrap

The BDD launcher creates a fresh local D1 database and uses a free loopback port for each suite. It applies migrations and seeds the fixture data. Before Chromium starts, the session API must resolve all four test personas to their local platform accounts. Destructive account tests use a separate database.

## Browser and API End-to-End Tests

Browser scenarios apply a persona's cookie to a Playwright context and
exercise the visible application.

Browser tests hold session and page requests open to check the controls and links visible before a response arrives. They also exercise failed reads and successful empty responses as separate cases. Public session tests check the initial HTML, the hydrated page while the request is held, and the final signed-in or guest controls.

API scenarios create a Playwright request context with the same cookie.
They do not mint alternate test tokens or bypass actor resolution.

Role-specific coverage includes:

| Product area | Primary coverage |
| --- | --- |
| Public entry and discovery | Signed-out homepage and public event flows |
| Participant account and application | Registration, applications, teams, submissions, and the next step around check-in |
| Judge workspace | Assigned blind-review workflow |
| Staff workspace | Search and check-in of confirmed participants from the participant list |
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
definitions and cookie builder. Its D1 seed gives the event-admin persona
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
- Simplified Meetup claiming coverage includes signed check-ins before account
  creation, check-in-only Luma behavior, paginated manual check-in import,
  shared email deduplication and claim preservation, a builder Luma extra that keeps its
  credentials across claiming methods, collapsed verified credentials, edit cancellation, bounded and appendable reward and attendee CSV imports, and PII
  minimization, offer visibility, configuration locking, authenticated email
  matching, pre-creation credit staging for both claiming methods, draft-save retry retention and atomic creation rollback, atomic multi-giveaway allocation, link/code detection, exhausted-giveaway skipping, nullable redirects, immutable repeat claims, combined receipt delivery and escaping, redirect selection locking, email preview, attendance-source
  precedence, certificate eligibility, rate limiting, and the external coupon
  redirect.
- Luma guest list coverage includes the event setting with its Luma
  connection and required Luma email guards, paginated import and refresh,
  removal of guests that Luma no longer returns, failed fetches that keep the
  list, signed registration and status webhooks with duplicate deliveries,
  registration outcomes for missing, declined, waiting, and approved guests,
  approval and withdrawal reconciliation with the single-application matching
  rule, the absence of Luma decision sync, and guest data staying out of every
  response. Coverage of one active application per Luma email includes a
  refused second registration, a withdrawn or rejected application that frees
  its Luma email, a Luma update that reaches only the active application, an
  event that is not linked to Luma, a refused restore, an allowed and a
  refused Luma email change on the account, and a refused link of an event
  whose active applications share a Luma email. Two rules exist in TypeScript
  and in SQL: which events are linked to Luma, and the participant photo
  limit. One test for each compares the two copies and fails when they differ.
  Race tests cover relinking, disabling the list,
  overlapping imports, newer webhooks, stale reconciliation, and email conflicts during
  registration, restore, profile updates, and admin backfill.
- Account-page tests compare participant, staff, event-admin, and platform-admin track fields in Overview and its shell. MCP tests request Agenda with and without its shell. Gallery tests exercise hidden-event access and verify that a failed upload rolls back every chunk and deletes its staged objects.
- Participant list coverage includes the newest 100 registrations with the
  total of the whole event, search by participant name, account email, and
  Luma email for a registration outside those 100, a match that ignores letter
  case and accents, `%` and `_` as plain search characters, the search text
  length limit, staff registrations staying out of the list and the search,
  the checked-in count for all approved participants with the admin override,
  a longer list asked for with `participantRows`, refused row counts, a search
  that keeps its limit of 100 matches, and refusal for staff of another event.
  Unit tests cover the row count in the request path and cache key. One
  browser scenario runs on a fixture event with 105 registrations and loads
  the rest of the list with "Load more"; the other browser fixtures hold
  smaller events, where the search stays in the browser and sends no request.
- Check-in flow coverage includes saving the switch for every event type and
  refusal for staff, judges, and participants; the event page content before
  check-in and with the flow off; and the same step after a Luma check-in and
  a staff check-in. Browser scenarios run on dedicated fixture events and cover
  both next steps of a participant and the event builder setting.
- Registration question coverage includes saving the questions for every
  event type, invalid question definitions, refusal for staff, judges, and
  participants, and a required question refused while simplified claiming is
  on; a registration that stores one answer per question with its text, an
  event without questions, missing required answers, an unconfirmed
  acknowledgment, invalid choices, and answers to unknown questions; stored
  answers that keep their text after the questions change; restoring a
  withdrawn registration, which keeps the answers; and who reads the answers in
  the participant list. Unit tests cover the registration form with a required
  question and answers in question order, and the builder step for an
  unfinished question on the Registration level. Browser scenarios run on
  dedicated fixture events and cover a participant who answers a question when
  registering, the answer in the admin participant list, and an organizer who
  adds a question in the event builder.
- Credit claim coverage for the check-in flow includes a refused claim before
  check-in, an accepted claim right after check-in, unchanged claims in an event with the check-in flow off, event staff
  claiming without the check-in flow, a claimed value that stays visible to a
  participant who has not finished the check-in flow, and the last value of
  an offer. Server tests cover unfinished check-in after completion, the
  offers on the Overview tab before and after the check-in flow, and an offer
  without uploaded values. Browser scenarios run on dedicated fixture events
  and cover a claim on the Overview tab, a participant who has not checked in
  and sees no credits, and an offer with no credits left.
- Challenge coverage includes saving a challenge list for every event type,
  a list with too many challenges, a link that is not `https`, a challenge
  without a title, and refusal for staff, judges, and participants; the
  Agenda page content for a confirmed participant before check-in and after
  finishing the check-in flow, where it holds the published challenges only
  and needs no credit claim; an event with only draft challenges; event
  staff, event admins, and judges; a pending registration and a user without a
  registration; the Agenda tab of an event without an agenda; the direct-link
  event shell; and the admin event of the settings page, which carries drafts
  for the event builder. Unit tests cover the open steps of the builder for an unfinished
  challenge, and an event edit that sends the registration questions, the challenges, and the
  check-in flow settings, and an event creation that sends the registration questions. Browser scenarios run on dedicated fixture
  events and cover an organizer publishing a challenge in the event builder,
  and a participant reading a challenge and its details on the Agenda, opened
  from the next step after check-in and before check-in.
- Event builder coverage includes the order of the open steps by level and
  the number of sessions that the settings page carries for the tile of the
  rooms and sessions. Browser scenarios cover the levels of a new event, which
  stay locked until the event type is chosen and become done as the organizer
  fills them; saving with an open step, which sends nothing and opens the
  step; templates and blocks on the Agenda level; an extra that opens alone
  and keeps what was typed while another extra is open; the state on the
  tiles for credits, challenges, photos, Luma, and rooms and sessions; and the
  level buttons and the save bar on a phone width. Unit tests cover the exact
  start and end of an agenda block: the pause a later start leaves, the
  duration a new end gives, and the blocks that keep their times when a block
  loses or regains its end. Browser scenarios cover a judging criterion and a
  prize saved in the builder, hiding an event and making it visible again, an
  exact start and a removed end on the Agenda level, the order of two tracks,
  the Luma API key that can be shown, and the webhook address of a saved Luma
  connection. Browser scenarios also cover the way between the event workspace
  and the builder: a new event that lands on its workspace, "Edit event" that
  opens the builder, a banner upload that keeps an unsaved event name, a
  changed slug that moves the builder and the workspace to the new address,
  and a criteria save that fails halfway and is finished by a second save.
- Staff challenge coverage includes an event admin and a platform admin giving
  a staff member a challenge, an open track and a draft; the track and the
  challenge replacing each other; a refused unknown challenge, a refused
  challenge without staff visibility, a refused request with both, and a
  refused request by staff; the staff names on the Agenda page; the Staff tab
  page for a confirmed participant, for a person who may not read the
  challenges, and before and after a draft is published; and the order of the
  sections on the Staff tab. A browser scenario covers an event admin choosing
  a challenge on the Staff tab and a participant reading it on the Agenda and
  on the Staff tab.
- Public session coverage includes the public event detail and the Agenda page
  of a pending participant and of event staff, which hold the sessions that
  the organizer made public in the order of their start; the rooms, details
  and second versions that stay out of both; a confirmed participant, who
  gets the whole program and no separate public list; and the revision of the
  public event content after a program is saved and after it is removed.
- Participant photo coverage includes an upload before check-in, after
  finishing the check-in flow without a credit claim, with the check-in flow off, with
  participant photos not allowed, and by users without an approved
  application; the limit of 20 photos for one participant, where hidden
  photos count; uploads by staff, judges, event admins, and platform admins,
  which stay photos of the event team also with a finished application, and
  a request with eight photos within the D1 limit of bound values; hiding and
  showing by staff and event admins with an audit record, and refusal for
  participants and for photos of the event team; a hidden photo that is
  absent from the photo list, the gallery page, and every image variant for
  the participant who added it and for other participants, and present for
  the people who manage the gallery; a public photo that leaves the public
  list and the public image when it is hidden and stays off the public page
  when it is shown again; refused highlight and public changes of a hidden
  photo; who learns the uploader of a participant photo; the Gallery tab on
  the event page and on a direct link; and the event setting with the admin
  event of the settings page. A unit test covers an event edit that sends
  the participant photo setting. Browser scenarios run on
  dedicated fixture events and cover a participant adding a photo from the
  next step, event staff hiding it, and an organizer allowing participant
  photos in the event builder.

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
