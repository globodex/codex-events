# API Surface

This document defines the canonical backend API surface for the Codex event platform.

It translates the canonical product model into stable backend domains, operations, shared API conventions, visibility rules, lifecycle guards, and testing expectations.

## Scope

- The backend API is the system-of-record interface for platform and event workflows.
- The API surface is organized by stable backend domains rather than by UI screens.
- Auth0 provides identity.
- Platform authorization is resolved from application data.
- Derived views such as the leaderboard, final score breakdown, and the no-submission team section remain computed from persisted data. Completed public outcome showcases are persisted as a generated cache after completion so repeated public reads do not rebuild the same aggregate.

## Shared Conventions

### Base Path

- The canonical API surface is exposed under `/api`.

### Authentication And Actor Resolution

- Authenticated API requests use the real Auth0-backed application session.
- The backend resolves the current platform actor from the authenticated Auth0 subject stored on the platform `User` record.
- Auth0 is not a source of product authorization.
- Product authorization comes from platform data such as `is_platform_admin`, `EventRoleAssignment`, `UserApplication`, `TeamMember`, and `PrizeRedemption`.
- A request without an authenticated session is rejected as unauthenticated unless the operation is explicitly public.

### Success Responses

- JSON responses return an object.
- Single-resource and action responses use a top-level `data` object.
- List responses use top-level `data` and `meta` objects.
- `meta` contains only pagination or filtering metadata required by the operation.
- Derived operational views are returned as computed data and are not treated as persisted canonical entities.
- Structured REST and MCP operations use deterministic operation-specific Zod output contracts from the shared registry. The selected route constructs and validates only its own operation contract; page-shaped routes validate their page result before constructing the envelope, and the shared executor validates the final operation output once. Output-validation failures identify response output rather than request input.

### Error Responses

- JSON error responses use:

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

- `code` is stable and machine-readable.
- `message` is human-readable.
- `details` is optional and carries field-level or guard-specific information when needed.

### Filtering And Pagination

- Collection endpoints support explicit query parameters rather than hidden server defaults.
- Pagination uses `page` and `page_size`.
- Filter parameters use descriptive names tied to canonical fields or states.
- Ordering parameters are limited to documented sort keys for each collection.

### Exact-Version Document Acceptance

- Platform document acceptance references the exact accepted `PlatformDocument` version.
- Event application submission references the exact accepted `EventTermsDocument` version when the event has current `application_terms`.
- Prize redemption references the exact accepted `EventTermsDocument` version for `winner_terms`.
- Acceptance write operations reject outdated or mismatched document references.

### Lifecycle And Guard Enforcement

- State-changing operations must reject requests that violate documented lifecycle guards.
- The API does not silently coerce invalid transitions.
- System-driven transitions remain system behavior, even when the resulting state is visible through admin APIs.

### Testing Expectations

- Shared backend behavior requires unit and integration coverage.
- Actor-facing workflows require authenticated end-to-end coverage in addition to unit and integration coverage.
- End-to-end coverage uses the documented stable local personas and D1-owned authorization.
- API end-to-end tests do not use fake JWTs, bypass headers, or Auth0-role shortcuts.

## Request and Read Topology

- `GET /api/session` is the sole actor bootstrap contract. Its typed response contains the authenticated identity, platform account, current-consent state, event roles, and derived capabilities needed by route guards and feature components. The client shares one bootstrap result; feature-local session reads and query-only tab actor refreshes are not API patterns.
- Authenticated API requests resolve the request actor once and reuse it through authorization and domain work. Login and account-link routes perform identity reconciliation; ordinary API reads resolve the already-reconciled identity from validated session claims and strong platform data only, without Auth0 `/userinfo`, access-token acquisition, Management API calls, or other external network work. Mutations always enforce canonical platform authorization and current consent, even when the client supplied bootstrap capabilities.
- Data-heavy account event tabs use a page-shaped read endpoint that returns the typed data required for the first render. The client makes one critical JSON request after bootstrap, and the server performs one authorization resolution and one logical D1 request session for that read. Domain-specific composition inside the endpoint is allowed; a generic graph endpoint is not.
- Account-event page reads use one named route for each page: `GET /api/account/events/:slug/entry`, `/prizes`, `/operations`, `/submissions`, `/judging`, `/settings`, `/participants`, `/workspace`, `/teams`, `/rosters`, `/gallery`, `/feedback`, and `/certificates`. Each route returns `apiData<T>` with a concrete child-owned page payload inside the small shared event/visibility envelope; client-selected includes, resource maps, and graph/query APIs are not part of the contract. A direct link to a non-entry tab adds `includeEventShell=true` to that selected route; the response then carries the full event shell and selected page together, while the server starts the page loader and shell concurrently. The `/participants` route always returns its bounded participant page contract, including for event admins; staff applications are filtered before the deterministic page limit, aggregate status counts use the same participant scope, and membership, submission, and withdrawal metadata is loaded only for the returned page. The client does not follow it with a second `/operations` read.
- The direct-link event shell keeps its independent D1 reads in one request wave: tracks, display-image options, gallery existence, published prize, published staff, a joined credit-inventory existence probe, and (for enabled Meetups) the retained talk proposal. Participant application and membership access is a parallel branch only when the shared page context does not already contain it; the shell does not use the former separate credit-offer and credit-code fan-out.
- The shared account-event page foundation owns the typed request boundary, request-scoped actor/event-authorization/database context, route naming, and final operation-registry/catalog reconciliation. Child route definitions supply their named page, concrete payload type, Zod output schema, and operation metadata; generated operation catalogs are regenerated after those concrete route definitions exist.
- D1 session bookmarks are carried only in the `X-D1-Bookmark` request and response header. They remain transport metadata and are not part of any domain payload contract. Every production HTTP request uses strong consistency through the request-scoped accessors; no generic consistency option or public-replica accessor is exposed. The HTTP boundary accepts genuine opaque bookmarks and rejects only the exact documented constraints `first-primary` and `first-unconstrained` before session construction. Mutations, actor, consent, permission, and read-after-write requests use primary or an incoming bookmark. Raw prepared statements and batches use the request session accessors, and HTTP handlers cannot inject database access through H3 context.
- Tab-owned requests carry cancellation signals. Leaving a tab cancels abandoned work, and heavy tab code is locally bundled and lazy. Runtime editor dependencies from `unpkg` are not supported.
- All API responses use the centralized fail-closed cache policy at the Nitro response boundary. `/api/session`, `/api/account/**`, `/api/admin/**`, `/api/events/**`, platform, prize-redemption, unknown generated-framework paths, and every other non-allowlisted actor or product API family emit `Cache-Control: private, no-store` and `Cloudflare-CDN-Cache-Control: private, no-store` on success and error responses. Only explicit public/versioned event and media paths may retain the public 30-second directives, and only when the response already carries both exact public headers. The separate static-framework `/api/_nuxt_icon/*.json` allowlist preserves generated cache headers for bundled static icon definitions; it is not a public product API contract.
- Workers cache is disabled in the tracked and generated Wrangler deployment configs. Cloudflare zone Cache Rules must bypass `/api/**` or respect these origin directives; a protected response must never be placed in a shared cache under a key that ignores Cookie. The operator smoke test is opt-in and read-only because local integration cannot reproduce an edge HIT that bypasses Nitro.
- Newly issued public event HTML, JSON, and versioned event, platform-default, or gallery media responses have explicit `Cache-Control: public, max-age=30, stale-if-error=0` browser freshness and `Cloudflare-CDN-Cache-Control: public, max-age=30, stale-if-error=0` Cloudflare edge freshness. They do not use `s-maxage`, immutable freshness, or stale-on-error behavior.
- The managed public-media scope is event background and banner images, the platform default event background, and public event-gallery photos. Public gallery `preview` and `original` URLs select bounded named Images transforms and must state the exact variant; `original` is a full-display transform, not the stored original. Private or mutable originals, generated certificate PNGs, and winner or published-project profile icons remain authorization-gated and are not covered by the public managed-media cache contract.
- Public managed-media URLs contain the exact current event or platform resource revision and variant. Routes validate visibility, revision, and the current object pointer before R2 or Images access; invalid or stale versions return not found. Pointer changes atomically record a fixed-kind cleanup intent in the D1 outbox; scheduled dispatch waits at least 30 seconds before publishing it, HTTP mutations do not wait for delivery, and cleanup failures leave private bytes only. Public cache keys include the request path, query, and content-negotiation dimensions.
- A cache hit can bypass the Worker, so D1 checks apply only on a miss or revalidation. Cache API deletion is not a global purge and the runtime has no global purge credential. Newly issued managed responses therefore have a strict 30-second browser and edge freshness window.

## Domain Map

The canonical backend domains are:

- `session`
- `legal`
- `platform-legal-settings`
- `platform-settings`
- `luma-webhooks`
- `platform-documents`
- `account`
- `platform-admins`
- `events`
- `event-roles`
- `event-terms`
- `feedback`
- `applications`
- `teams`
- `team-join-requests`
- `submissions`
- `judging`
- `shortlist`
- `final-deliberation`
- `winners`
- `prize-redemption`
- `audit`

## Legal

Purpose:
- Support public legal-notice contact from the platform imprint page.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Submit imprint contact request | `POST /api/public/imprint-contact` | public or authenticated user | Accepts a public support or legal-contact message with name, email, and message text. Sends the message to the platform support inbox through the configured transactional email provider. This route is for legal or support contact only and is not a substitute for authenticated account workflows. |

Testing:
- Unit: contact-form validation and delivery-result handling.
- Integration: public request handling and provider-configuration failure behavior.

## Platform Legal Settings

Purpose:
- Expose deployment-owned imprint content and the support inbox used by the public imprint contact form.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get current platform legal settings | `GET /api/platform-legal-settings/current` | public or authenticated user | Returns the current deployment-owned support email and imprint content, or `null` when setup is incomplete. Missing settings never fall back to repository-owned operator details. |
| Update current platform legal settings | `PATCH /api/platform-legal-settings/current` | platform admin | Upserts the singleton legal settings record. Updating these settings does not create a new platform-document version and does not force renewed user consent. A platform admin can use this route during first-run setup before current platform documents exist or have been accepted. |

Testing:
- Unit: settings validation and contact-recipient resolution.
- Integration: public read behavior, platform-admin-only writes, audit logging, and missing-settings contact behavior.

## Platform Settings

Purpose:
- Expose deployment-wide presentation defaults used by event read and image delivery workflows.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get current platform settings | `GET /api/platform-settings/current` | public or authenticated user | Returns the current default event background image URL, or `null` when platform settings are not configured. |
| Upload default event background image | `POST /api/platform-settings/event-default-background-image` | platform admin | Accepts one managed JPEG or PNG multipart upload, stores the object in the existing event images bucket, updates `defaultEventBackgroundImageUrl`, enforces the authenticated upload rate limiter, and writes an audit row. |
| Remove default event background image | `DELETE /api/platform-settings/event-default-background-image` | platform admin | Clears `defaultEventBackgroundImageUrl`, writes an audit row, and records the previous immutable object in the managed-media outbox in the same D1 mutation. |
| Get public default event background image | `GET /api/public/platform/event-default-background-image` | public or authenticated user | Returns a bounded transformed variant of the configured platform default event background image only when `variant=background` and `v` equals the current `default_event_background_image_revision`. Invalid or stale versions, missing configuration, and missing managed objects return `404`; the stored original is never returned. |

Testing:
- Unit: settings serialization, upsert behavior, object-key helpers, and frontend platform settings composables.
- Integration: public read behavior, platform-admin-only upload/removal, image validation, upload rate limiting, audit logging, public byte delivery, and missing-default behavior.

## Luma Webhooks

Purpose:
- Accept signed Luma guest updates used for event attendance and cancellation sync.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Receive Luma guest updates | `POST /api/public/events/:eventId/luma/webhooks` | public integration | Verifies the signed Luma webhook request against the event's stored webhook signing secret. Processes `guest.updated` check-in and cancellation updates. The payload Luma event API ID must match the event's Luma event API ID. For simplified claiming, a signed check-in adds eligible attendee email without requiring a platform account or application; cancellation updates are acknowledged without mutation. For ordinary events, the participant is resolved by `lumaEmail`. Approved applications are marked attended exactly once when Luma records a check-in. Submitted or approved applications are withdrawn through the same admin-managed withdrawal behavior when Luma marks the guest as not going. Valid signed deliveries for the wrong Luma event, unknown participants, terminal application states, blocked withdrawals, duplicate check-ins, and unrelated guest updates return HTTP `200` with no mutation. Invalid signatures are rejected. |

Testing:
- Unit: signature verification, replay-window enforcement, and payload extraction.
- Integration: valid signed attendance sync, valid signed cancellation sync, duplicate delivery idempotency, invalid signatures, unknown events, unmatched participants, and sticky attendance behavior.

## Session

Purpose:
- Expose the authenticated actor context needed by the application.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get current session actor | `GET /api/session` | authenticated user | Returns the typed shared account bootstrap: platform identity, effective platform-admin and event-organizer status, current-consent state, event roles, and derived capabilities needed for authorization-aware clients and routing. This is the sole client source for actor, session, and capability data. |

Testing:
- Unit: actor resolution and permission derivation rules.
- Integration: session-required behavior and response shape.
- End-to-end: authenticated persona session reads.

## Platform Documents

Purpose:
- Expose platform-wide registration documents and exact-version acceptance records.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List current platform documents | `GET /api/platform-documents/current` | public or authenticated user | Returns the current `privacy_policy` and `platform_terms` versions used for platform registration and account flows. |
| List platform document versions for a type | `GET /api/platform-documents/:documentType/versions` | authenticated user | Returns available published versions for the document type. |
| Publish platform document version | `POST /api/platform-documents/:documentType/versions` | platform admin | Creates the next append-only version for `privacy_policy` or `platform_terms`. Existing versions remain unchanged for exact-version acceptance history. A platform admin can use this route during first-run setup before current platform documents exist or have been accepted. |
| Record platform document acceptance | `POST /api/platform-document-acceptances` | authenticated user with a platform account | Requires the exact `PlatformDocument` version being accepted. Rejects unknown or unpublished versions. Used when an existing platform account must accept the current platform documents before normal workspace access resumes. |

Testing:
- Unit: exact-version acceptance rules and missing-required-document behavior.
- Integration: document lookup, platform-admin publishing, authorization, and acceptance persistence.
- End-to-end: persona acceptance flows that use the real authenticated session.

## Account

Purpose:
- Support platform-account lifecycle operations that are not event-specific.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Create platform account after terms acceptance | `POST /api/account/registration` | authenticated Auth0 user without a platform account | Creates the platform `User` record, allows canonical `firstName` and `familyName` to remain blank until later profile completion, and records acceptance of the current required platform documents. The frontend-owned completion route is `/account/register`. If no current platform documents exist yet, the configured first platform admin can create the initial setup account without document acceptance only when no active platform admin exists. That account can publish legal settings and platform documents from platform settings, but regular account and event workflows still require current platform-document acceptance. If an unlinked same-email identity reaches this route, the route rejects the request before platform-document acceptance is recorded. |
| Update own platform account profile | `PATCH /api/account` | authenticated user with a platform account and current platform-document acceptance | Updates canonical `firstName` and `familyName` plus optional profile fields such as `company`, `bio`, X, LinkedIn, and GitHub profile links, an optional ChatGPT email, an optional OpenAI org ID, and an optional Luma email. |
| Get profile icon | `GET /api/account/profile-icon` | authenticated user with a platform account and current platform-document acceptance | Returns the uploaded profile icon object for the caller. When `user` and `event` query parameters are provided, this route can also return the uploaded profile icon for another user who is visible to the caller through event-scoped participant visibility or the published judge or staff rosters for that event. |
| Upload or replace own profile icon | `POST /api/account/profile-icon` | authenticated user with a platform account and current platform-document acceptance | Accepts multipart upload for a single profile icon image and replaces any prior icon object, recording the prior object in the managed-media outbox in the same D1 mutation. |
| Remove own profile icon | `DELETE /api/account/profile-icon` | authenticated user with a platform account and current platform-document acceptance | Deletes the caller's uploaded profile icon, clears profile-icon metadata on the platform user record, and records the prior object in the managed-media outbox in the same D1 mutation. |
| Delete own account | `DELETE /api/account` | authenticated user | Performs GDPR-compliant account deletion handling and writes the required audit trail. |

Testing:
- Unit: registration acceptance-version rules, profile normalization, profile-icon upload guards, and deletion guard semantics.
- Integration: registration persistence, current-consent gating, profile updates, profile-icon object flows, document-acceptance linkage, deletion effects, and audit creation.
- End-to-end: authenticated account-registration completion, profile management including profile icon updates, and account deletion flows.

Operational notes:
- Same-email Auth0 account linking is initiated by the Auth0 post-login Action before the app session is issued.
- `/auth/link/login`, `/auth/link/callback`, and `/auth/link/complete` are Auth0 Action continuation routes. They verify the Action redirect token, require a fresh sign-in to the existing database account, persist both validated Auth0 subjects in `user_auth_identities` during link completion, and return the signed result to Auth0 only after persistence succeeds. The persistence is idempotent for a retried completion with the same validated subjects, so a retry can return the same continuation after an interrupted handoff to the Auth0 Post-Login Action; Auth0 remains responsible for completing the provider-side link. Future sessions resolve linked identities from those durable rows; ordinary API reads never reconcile Action claims.

## Platform Admins

Purpose:
- Support platform-admin roster reads and platform-admin promotion from the authenticated account workspace.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List current platform admins | `GET /api/platform-admins` | platform admin | Returns active platform users with `isPlatformAdmin = true`. |
| List platform-admin candidates | `GET /api/platform-admins/candidates` | platform admin | Returns active users for roster search with pagination and fuzzy search over display name, email, and user ID. |
| Grant platform admin access | `PUT /api/platform-admins/:userId` | platform admin | Grants platform-admin access to the target active user. Promotion also normalizes explicit `event_admin` assignment coverage across every existing event and writes an audit record. |
| Remove platform admin access | `DELETE /api/platform-admins/:userId` | platform admin | Removes platform-admin access from the target active user and writes an audit record when access is revoked. Existing event role assignments remain unchanged. |

Testing:
- Unit: platform-admin grant and removal invariants and candidate ordering or filtering rules.
- Integration: role enforcement, active-user filtering, promotion and removal persistence, assignment normalization, preserved event role assignments on removal, and audit creation.
- End-to-end: authenticated platform-admin management flows.

## Event Organizers

Purpose:
- Support event-organizer roster reads and event-organizer grants from the authenticated account workspace.
- Event-organizer access is an event-creation permission only. Event organizers manage only events they create or events where they are explicitly assigned `event_admin`.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List current event organizers | `GET /api/event-organizers` | platform admin | Returns active platform users with `isEventOrganizer = true`. |
| List event-organizer candidates | `GET /api/event-organizers/candidates` | platform admin | Returns active users for roster search with pagination and fuzzy search over display name, email, and user ID. |
| Grant event organizer access | `PUT /api/event-organizers/:userId` | platform admin | Grants event-organizer access to the target active user and writes an audit record. |
| Remove event organizer access | `DELETE /api/event-organizers/:userId` | platform admin | Removes event-organizer access from the target active user and writes an audit record when access is revoked. |

Testing:
- Unit: event-organizer grant and removal invariants and candidate ordering or filtering rules.
- Integration: role enforcement, active-user filtering, grant and removal persistence, and audit creation.

## Events

Purpose:
- Expose public event discovery reads, caller-visible event reads, and admin lifecycle/configuration operations.
- Support three event types: `hackathon`, `meetup`, and `build`.
- Hackathon events expose competition workflows. Meetup and Build events are registration-focused and reject competition-only routes and actions. Meetups can optionally expose a private Call for talks.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List public events | `GET /api/public/events` | public or authenticated user | Returns the canonical public-visible event set regardless of caller privileges, with pagination and discovery filters. Hidden events are excluded. |
| Get public event detail | `GET /api/public/events/:slug` | public or authenticated user | Resolves by exact event slug and returns canonical public-safe event fields, including `eventType`, structured `agendaItems`, Meetup Call for talks configuration, configured Hackathon or Build `tracks` with name, short description, and display order, plus current terms references. `tracks=full` additionally includes participant-facing full track descriptions and resource links for public sharing. Public payloads never expose proposal content or decisions, staff instructions, track IDs, resource IDs, or restricted workspace-only metadata such as the street `address`, `discordServerUrl`, and `slidesUrl`. Hidden events respond not found. |
| List public evaluation criteria | `GET /api/public/events/:slug/evaluation-criteria` | public or authenticated user | Returns the public evaluation criteria for the exact public Hackathon slug. Rejected for Meetup and Build events. |
| List public prizes | `GET /api/public/events/:slug/prizes` | public or authenticated user | Returns the public prize definitions for the exact public Hackathon slug. Rejected for Meetup and Build events. |
| List public winners | `GET /api/public/events/:slug/winners` | public or authenticated user after completion | Returns the completed winners showcase for the exact public Hackathon slug, including prize, project, and published team-member details for each winning project. Rejected for Meetup and Build events. |
| Get public winner team-member profile icon | `GET /api/public/events/:slug/winners/:userId/profile-icon` | public or authenticated user after completion | Returns the uploaded profile icon bytes for a published winner team member in the completed winners showcase. Rejected for Meetup and Build events. |
| List public published projects | `GET /api/public/events/:slug/published-projects` | public or authenticated user after completion | Returns the separate completed published-projects section for the exact public Hackathon slug, including only opted-in non-winning locked projects plus published team-member details. Rejected for Meetup and Build events. |
| Get public published-project team-member profile icon | `GET /api/public/events/:slug/published-projects/:userId/profile-icon` | public or authenticated user after completion | Returns the uploaded profile icon bytes for a published team member in the completed published-projects section. Rejected for Meetup and Build events. |
| Get public background image | `GET /api/public/events/:slug/images/background` | public or authenticated user | Returns the bounded `background` transform only when `variant=background` and `v` equals the current `background_image_revision`. Invalid or stale versions, hidden or non-public events, missing configuration, and missing managed objects return `404`; the stored original is never returned. |
| Get public banner image | `GET /api/public/events/:slug/images/banner` | public or authenticated user | Returns the bounded `banner` transform only when `variant=banner` and `v` equals the current `banner_image_revision`. Invalid or stale versions, hidden or non-public events, missing configuration, and missing managed objects return `404`; the stored original is never returned. |
| Get public participation certificate | `GET /api/public/events/:slug/participants/:userId/certificate` | public or authenticated user | Returns the participation certificate for the exact public event slug and participant user id. Available only while the participant's application is approved with effective attendance (admin override first, otherwise the Luma check-in), the participant has not disabled certificate generation, certificate access has not been revoked by an admin, and the account is active; otherwise responds not found. Includes the participant name, event identity and type, certificate date, location, the Hackathon submission track when one applies or the single configured Build track when unambiguous, the certificate ID, and the event display background image. For completed Hackathons it also includes the team name, project name, final placement, and won prize names from the competition outcome model; these stay empty before completion. |
| Get public participation certificate image | `GET /api/public/events/:slug/participants/:userId/certificate.png` | public or authenticated user | Renders the shareable 1200x630 certificate image used for social link previews with an event-type-specific design. Supports `download=1` to respond as an attachment. Follows the same availability rules as the certificate read. |
| Download participation certificate PDF | `GET /api/public/events/:slug/participants/:userId/certificate.pdf` | public or authenticated user | Renders the print-oriented certificate PDF as an attachment, including the public verification link and a QR code that resolves to the live certificate page. Follows the same availability rules as the certificate read. |
| Preview a participation certificate | `GET /api/public/events/:slug/participants/preview/certificate` (and `.png` / `.pdf`) | public or authenticated user | Renders a synthetic certificate for design review on the reserved `preview` participant id, driven by `name`, `type`, `rank`, `track`, `project`, `team`, and `prizes` query parameters with sample defaults. Requires only a publicly visible event slug and reads no application data. Preview image responses are never cached, and the preview page presents itself as a sample and is excluded from search indexing. |
| List caller-visible events | `GET /api/events` | public or authenticated user | Returns events visible to the caller. Authenticated admins can see draft events they are allowed to manage here, and staff-visible internal events are included when the caller has staff access to them. Hidden events are excluded unless the caller is an event admin for that event or a platform admin. |
| List own event participation | `GET /api/events/participation` | authenticated user with a platform account | Returns the caller's current and past participation records across applications, team memberships, and submissions. Hidden events are excluded. For events in `pitch`, `pitch_review`, `final_deliberation`, `winners_announced`, or `completed`, the response also includes a self-scoped team outcome summary, including shortlist status and, after completion, awarded prizes plus final rank `X/Y`. |
| Get caller-visible event detail | `GET /api/events/:eventId` | public or authenticated user | Returns canonical event fields, including `eventType`, structured `agendaItems`, configured Hackathon or Build `tracks` with short descriptions, full descriptions, resources, and current terms references for an event visible to the caller. Staff instructions are returned only to platform admins, event admins, whole-event staff, and staff assigned to the matching track. The street `address`, optional `discordServerUrl`, and optional `slidesUrl` are returned only to approved participants and to judges, staff, event admins, and platform admins. Staff-visible internal events are included when the caller has staff access to that event. Hidden events respond not found unless the caller is an event admin for that event or a platform admin. |
| Get caller-visible event detail by slug | `GET /api/events/slug/:slug` | authenticated platform user | Returns the caller-visible event detail used by registration entry flows. For an enabled Meetup Call for talks, it includes the private ordered question definitions and current question-set revision so an unregistered authenticated user can complete the combined registration and proposal form. |
| Create event | `POST /api/events` | event organizer or platform admin | Creates a `draft` event with `eventType`, canonical common configuration, structured `agendaItems`, optional event links such as `lumaEventUrl`, restricted `discordServerUrl`, and restricted `slidesUrl`, optional event Luma API ID and API key, location fields (`city`, `country`, and `address`; blank values are accepted, e.g. for online events), participant limit, `inPersonEvent`, application field visibility and requirement flags, and optional auto-approval. Meetup creation also accepts `talkProposalsEnabled`, `talkProposalOpensAt`, and `talkProposalClosesAt`; enabled calls require both timestamps with open before close, while disabled Meetups and non-Meetups require false and null timestamps. First name and family name are always visible and required. Supported optional application fields are X, LinkedIn, GitHub, ChatGPT email, OpenAI org ID, `why this event`, proof-of-execution links, participation mode, and AI Knowledge. Luma email is visible and required when Luma Sync is enabled. Hackathon and Build creation accept ordered `tracks` with short descriptions, optional full descriptions, optional staff instructions, and optional resource links. Hackathon creation also accepts submission schedule, team size, judging configuration, and submission-requirement toggles. Creation assigns the creator as `event_admin` for the new event and normalizes active platform-admin assignment coverage for the new event. When an event Luma API ID and API key are present, the app registers the event webhook and stores the returned webhook ID and signing secret. Luma registration failures do not roll back event creation; the event stores failed webhook status for admin follow-up. Creation accepts an optional `creationFlow` (`classic` default, or `builder` for the gamified event builder); the flow is stored on the event and routes which editor opens for it. Structured `agendaItems` accept optional `builderBlockType`, `builderFocusCost`, and `builderEnergyDelta` annotations per item (the dials score custom builder blocks). Every creation computes and persists the event's balance score and breakdown server-side; admin payloads expose `creationFlow`, `balanceScore`, and `balanceBreakdown`, while public payloads exclude all builder metadata including agenda annotations. |
| Read event-builder catalog | `GET /api/events/builder/catalog` | event organizer or platform admin | Returns the canonical builder block definitions and paytable, event-type profiles, templates, and application-field keys. The corresponding MCP tool is absent for other actors. |
| Analyze unsaved builder agenda | `POST /api/events/builder/analyze` | event organizer or platform admin | Validates an event type and agenda, then returns the canonical balance score, meter breakdown, and recommendations without persisting an event or draft. The optional MCP Apps resource is presentation-only. |
| Update event configuration | `PATCH /api/events/:eventId` | event admin or platform admin | Updates canonical common configuration fields, including schedule, structured `agendaItems`, images, optional event links such as `lumaEventUrl`, restricted `discordServerUrl`, and restricted `slidesUrl`, optional event Luma API ID and API key, location fields (`city`, `country`, and `address`; blank values are accepted, e.g. for online events), participant limit, `inPersonEvent`, application field visibility and requirement flags, and optional auto-approval. Meetup updates can change the private Call for talks schedule and ordered `talkProposalQuestions` before completion. After any proposal exists the feature cannot be disabled and its question definitions cannot change, but its closing timestamp can still change before completion. A changed question definition increments `talkProposalQuestionsRevision`; the conditional write fails if a first proposal wins concurrently. Luma email remains visible and required while Luma Sync is enabled. A field cannot be required while hidden, and field configuration remains editable after applications exist. Hackathon and Build updates can update ordered `tracks` with short descriptions, optional full descriptions, optional staff instructions, and optional resource links. Hackathon updates can also update submission schedule, team size, judging configuration, and submission-requirement toggles. Competition workflow fields are unavailable for Meetup and Build events. Track removals are rejected when existing submissions still reference the removed track. Updating the event Luma API ID or API key retries event webhook registration and stores the latest webhook status. Updates recompute and persist the event's balance score and breakdown from the merged configuration on every call; `creationFlow` cannot be changed after creation and is silently ignored when sent. Agenda `builderBlockType`, `builderFocusCost`, and `builderEnergyDelta` annotations round-trip through updates. |
| Retry event Luma configuration | `POST /api/events/:eventId/luma/actions/retry-configuration` | event admin or platform admin | Re-runs event webhook registration using the event's stored Luma event API ID and API key. Success stores the webhook ID, signing secret, configured status, and event webhook URL for admin copy. Failure stores failed status and a concise error message while leaving the event configuration intact. |
| Hide event | `POST /api/events/:eventId/actions/hide` | event admin or platform admin | Requires a non-empty reason. Sets hidden metadata without changing lifecycle state, removes the event from public and participant-facing reads, and writes an audit record. |
| Make event visible | `POST /api/events/:eventId/actions/unhide` | event admin or platform admin | Clears hidden metadata, restores normal visibility according to the event lifecycle state, and writes an audit record. |
| Open registration manually | `POST /api/events/:eventId/actions/open-registration` | event admin or platform admin | Allowed only from `draft` while the configured registration window is open. |
| Backfill Luma emails for legacy applicants | `POST /api/admin/events/:eventId/actions/backfill-luma-emails` | platform admin | Resolves stored legacy Luma usernames against the event's configured Luma integration and writes canonical `lumaEmail` values for users in that event who still need them. |
| Upload event background image | `POST /api/events/:eventId/images/background` | event admin or platform admin | Accepts multipart upload for the background image, activates a new immutable object, and updates `backgroundImageUrl` to the platform-managed public image endpoint. A replaced object is recorded in the managed-media outbox in the same D1 mutation. |
| Remove event background image | `DELETE /api/events/:eventId/images/background` | event admin or platform admin | Clears `backgroundImageUrl` and records the previous immutable object in the managed-media outbox in the same D1 mutation. |
| Upload event banner image | `POST /api/events/:eventId/images/banner` | event admin or platform admin | Accepts multipart upload for the banner image, activates a new immutable object, and updates `bannerImageUrl` to the platform-managed public image endpoint. A replaced object is recorded in the managed-media outbox in the same D1 mutation. |
| Remove event banner image | `DELETE /api/events/:eventId/images/banner` | event admin or platform admin | Clears `bannerImageUrl` and records the previous immutable object in the managed-media outbox in the same D1 mutation. |
| Open submission manually | `POST /api/events/:eventId/actions/open-submission` | event admin or platform admin | Hackathon only. Allowed only when registration is closed and the configured submission window is open. |
| Stop submissions | `POST /api/events/:eventId/actions/start-judging-preparation` | event admin or platform admin | Hackathon only. Allowed only after the submission window closes and at least one submitted project exists. Moves the event into `judging_preparation` without locking submitted work yet. |
| Start blind review | `POST /api/events/:eventId/actions/start-blind-review` | event admin or platform admin | Allowed only after judging preparation is complete, `blindReviewCount > 0`, at least one submitted project exists, and the automatic judge pool has enough distinct judges. Locks submitted work, freezes prize eligibility, and creates blind-review assignments. |
| Start shortlist | `POST /api/events/:eventId/actions/start-shortlist` | event admin or platform admin | Allowed only from `blind_review` when `pitchReviewEnabled = true` and every active submission has the configured number of completed blind-review outcomes or has been removed from competition. Starting shortlist clears any previously saved shortlist state. Until admins save the shortlist, Operations shows the top ranked blind-review submissions as the default finalist boundary up to `shortlistFinalistCount`. |
| Start pitch | `POST /api/events/:eventId/actions/start-pitch` | event admin or platform admin | Allowed from `judging_preparation` for pitch-only events or from `shortlist` after admins select the ordered finalist set. In pitch-only events, this action locks submitted work, freezes prize eligibility, and seeds the pitch lineup from those newly locked submissions. It then freezes the ordered pitch lineup, resets live pitch progress, and opens the live pitch stage without creating judge assignments. When entered from `shortlist`, this action also enqueues shortlist emails for each active member of each finalist team. |
| Advance pitch presentation | `POST /api/events/:eventId/actions/advance-pitch-presentation` | event admin or platform admin | Allowed only during `pitch` while the saved lineup still has presentations remaining. Enables the first finalist presentation, advances to the next finalist, or marks the live lineup complete after the last presentation. |
| Start pitch review | `POST /api/events/:eventId/actions/start-pitch-review` | event admin or platform admin | Allowed only from `pitch` after admins complete the full saved live pitch lineup. Creates one pitch assignment per finalist submission per judge in the frozen pitch panel. |
| Start final deliberation | `POST /api/events/:eventId/actions/start-final-deliberation` | event admin or platform admin | Allowed from `blind_review` when pitch review is disabled after blind scoring is complete, or from `pitch_review` after at least one pitch review vote has been submitted and admins close pitch review using the submitted votes only. |
| Announce winners | `POST /api/events/:eventId/actions/announce-winners` | event admin or platform admin | Allowed only from `final_deliberation`. Persists the final ranking operationally, creates prize redemptions, and enqueues winner emails for frozen prize-eligible members of winning teams. This action does not make the public or account winners showcase visible yet. |
| Complete event | `POST /api/events/:eventId/actions/complete` | event admin or platform admin | For Hackathon events, allowed only after winners are announced and reveals the completed outcome showcase. For Meetup and Build events, allowed from `registration_open` and closes the registration-focused event without outcome generation. Unresolved Meetup talk proposals do not block completion, and decisions are unavailable afterward. |
| List caller-visible evaluation criteria | `GET /api/events/:eventId/evaluation-criteria` | public or authenticated user | Returns configured criteria and display order for a visible Hackathon. Rejected for Meetup and Build events. |
| Create evaluation criterion | `POST /api/events/:eventId/evaluation-criteria` | event admin or platform admin | Adds a criterion for a Hackathon. Rejected for Meetup and Build events. |
| Update evaluation criterion | `PATCH /api/events/:eventId/evaluation-criteria/:criterionId` | event admin or platform admin | Updates criterion fields and ordering. |
| Delete evaluation criterion | `DELETE /api/events/:eventId/evaluation-criteria/:criterionId` | event admin or platform admin | Deletes a criterion when no saved judge scores reference it. |
| List caller-visible prizes | `GET /api/events/:eventId/prizes` | public or authenticated user | Returns configured prize definitions for a visible Hackathon. Rejected for Meetup and Build events. |
| Create prize | `POST /api/events/:eventId/prizes` | event admin or platform admin | Adds a prize definition for a Hackathon. Rejected once the event reaches `winners_announced` or `completed`. |
| Update prize | `PATCH /api/events/:eventId/prizes/:prizeId` | event admin or platform admin | Updates prize configuration. Rejected once the event reaches `winners_announced` or `completed`. |

Notes:
- `participantsLimit` is an indicative planning target surfaced in admin approval workflows and does not reject staged or applied approval decisions by itself. When auto approval is enabled, it is also the capacity boundary for automatic approval.
- Event read payloads expose managed background and banner URLs with the exact current numeric revision and consumer variant. `displayBackgroundImageUrl` is the effective versioned display background image and uses the event-specific background image first, then the platform default event background image when configured.
- The public event background image route serves only the event-specific uploaded background image. It does not serve the platform default event background image.
- `autoApproveApplications` approves only new applications after required submission checks pass while approved participation is below `participantsLimit` when one is configured. Turning it on does not retroactively approve already submitted applications.
- Hackathon `blindReviewCount` accepts `0`, `1`, or `2`.
- Hackathon `pitchReviewEnabled` can be true with or without blind review.
- When blind review and pitch review are both enabled, `blindScoreWeightPercent` and `pitchScoreWeightPercent` default to `70` and `30` and must sum to `100`.
- Track configuration is managed as part of Hackathon and Build create and update operations rather than through a separate admin domain in this version.
- Removing a track clears participant-facing staff track display for affected staff assignments and selected-track references for affected applications.
- Public event discovery and detail responses expose only public-safe fields. They do not expose internal record identifiers, creator identifiers, or audit timestamps.
- Public current-terms references expose document type, version, title, and published time only.
- Event admin serialization includes `hiddenAt`, `hiddenByUserId`, and `hiddenReason`.
- Hidden events are not returned by public event serialization.
- Event lifecycle API actions remain successful even when shortlist or winner email queue enqueue fails.
- Lifecycle-forwarding actions reject while an event is hidden. Admin configuration, audit reads, and visibility restoration remain available while hidden.
- Queued shortlist, winner, and certificate email processing skips delivery when the event is hidden before the queue message is processed.

Testing:
- Unit: lifecycle transitions and guard rules.
- Integration: role enforcement and configuration persistence.
- End-to-end: admin lifecycle actions, staff-visible internal reads, and public or authenticated reads.

## Event Roles

Purpose:
- Manage event-scoped admin, staff, and judge assignments.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List role assignments | `GET /api/events/:eventId/roles` | event admin or platform admin | Returns explicit assignments for the event. |
| List published judges | `GET /api/events/:eventId/judges` | authenticated workspace user | Hackathon only. Returns the published judge roster for the account-scoped event workspace. SQL scopes the read to explicit judges and admin assignments with judging enabled, and the response uses only avatar-support data plus public profile-card fields. |
| List published staff | `GET /api/events/:eventId/staff` | authenticated workspace user | Returns the published staff roster for the account-scoped event workspace. SQL scopes the read and staff-track lookup to explicit staff and admin assignments with staff visibility enabled, exposes only avatar-support data plus public profile-card fields, and includes each staff member's whole-event or track-specific display context. |
| Create or replace role assignment | `PUT /api/events/:eventId/roles/:userId` | event admin or platform admin | Supports `event_admin`, `staff`, and, for Hackathon events only, `judge` roles plus the `is_in_judge_pool`, `is_staff`, and nullable `staffTrackId` fields. `staffTrackId` is valid only when staff visibility is enabled and must reference a track from the same Hackathon or Build event. |
| Remove explicit role assignment | `DELETE /api/events/:eventId/roles/:userId` | event admin or platform admin | Removes the explicit assignment. Platform-admin inheritance remains implicit. |
| Update role-assignment capability flags | `PATCH /api/events/:eventId/roles/:userId` | event admin or platform admin | Updates admin-only `is_in_judge_pool`, `is_staff`, and nullable `staffTrackId` fields without replacing the explicit role. `is_in_judge_pool` and `judge` are Hackathon-only. `staffTrackId` is display-only, is valid only when staff visibility is enabled, and must reference a track from the same Hackathon or Build event. `judge` must remain in the automatic judge pool, `staff` must remain marked as staff, and non-admin staff and judges remain distinct. |

Testing:
- Unit: role invariants plus judge-pool and staff-flag rules.
- Integration: assignment uniqueness, permission enforcement, and published-roster visibility rules.
- End-to-end: admin role-management flows.

## Event Gallery

Purpose:
- Support a protected event gallery in the account-scoped workspace and a selected public subset on the public event detail page.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List event gallery photos | `GET /api/events/:eventId/photos` | approved participant, judge, staff, event admin, or platform admin | Returns protected gallery photo metadata plus account-scoped image URLs for the requested event. |
| Upload event gallery photos | `POST /api/events/:eventId/photos` | judge, staff, event admin, or platform admin | Accepts multipart upload for one or more JPEG or PNG images, stores the originals in R2, derives image dimensions through the Worker `IMAGES` binding, records gallery rows with image creation metadata when available, and enforces the authenticated upload rate limiter. New rows start unhighlighted and hidden from the public event page. |
| Update event gallery photo highlight | `PATCH /api/events/:eventId/photos/:photoId/highlight` | judge, staff, event admin, or platform admin | Updates whether the selected gallery photo appears in the highlighted account-scoped gallery view. This does not change public gallery visibility. |
| Update event gallery photo public visibility | `PATCH /api/events/:eventId/photos/:photoId/public-visibility` | judge, staff, event admin, or platform admin | Updates whether the selected gallery photo appears in the public Gallery tab for the event. |
| Delete event photo | `DELETE /api/events/:eventId/photos/:photoId` | judge, staff, event admin, or platform admin | Removes the gallery row and records its immutable object in the managed-media outbox in the same D1 mutation. |
| Get protected event photo bytes | `GET /api/events/:eventId/photos/:photoId/image?variant=preview|original` | approved participant, judge, staff, event admin, or platform admin | Returns a protected transformed preview or bounded 2400px full-display variant; stored originals are never returned directly. |
| List public event gallery photos | `GET /api/public/events/:slug/photos` | public or authenticated user | Returns only the gallery photos marked public for the exact public event slug, with public image URLs and no uploader identity data. |
| Get public event gallery photo bytes | `GET /api/public/events/:slug/photos/:photoId/image?variant=preview|original` | public or authenticated user | Requires an explicit exact `variant` query value and returns the bounded transformed `preview` or full-display `original` variant only when `v` equals the current gallery photo `image_revision` and the gallery photo remains public on a public event. Invalid or stale versions return `404`; the stored gallery original is never returned. |

Testing:
- Unit: photo-upload validation, protected image binding guards, and workspace-tab visibility helpers.
- Integration: approved-participant read access plus role-based upload, highlight update, public-visibility update, delete access, and public-gallery reads.
- End-to-end: account and public event Gallery tab read and management flows.

## Feedback

Purpose:
- Support anonymous post-event feedback submission from the public event area and restricted feedback-result review in the account workspace.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Submit public event feedback | `POST /api/public/events/:slug/feedback` | public or authenticated user | Allowed only after the event reaches `completed`. Accepts one explicit answer for each platform-defined feedback question for the event type: either a `1..5` rating or `null` for `Not applicable`, plus one optional free-text comment. Records anonymous event-scoped feedback and enforces a Cloudflare-backed per-IP rate limit for repeated submissions. |
| Get event feedback results | `GET /api/events/:eventId/feedback` | judge, staff, event admin, or platform admin | Returns event-scoped feedback results for the account workspace, including total response count, event-type-specific question labels and prompts, per-question rating distributions, rated-response counts, `Not applicable` counts, averages computed from rated responses only, and optional written comments. |

Testing:
- Unit: feedback payload validation, completed-state visibility rules, skip semantics, and result summarization.
- Integration: anonymous submission persistence, rate limiting, and restricted result visibility.
- End-to-end: public feedback form submission and account feedback-tab visibility.

## Event Terms

Purpose:
- Expose optional event-specific terms and manage versioned terms documents.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get current event terms | `GET /api/events/:eventId/terms/current` | authenticated user | Returns the current `application_terms` and `winner_terms` references when present. |
| List terms versions for a type | `GET /api/events/:eventId/terms/:documentType/versions` | event admin or platform admin | Returns version history for the terms type. |
| Create terms version | `POST /api/events/:eventId/terms/:documentType/versions` | event admin or platform admin | Creates a new versioned terms document. |
| Set current terms reference | `POST /api/events/:eventId/terms/:documentType/actions/set-current` | event admin or platform admin | Updates the event's current terms reference for the given document type. |

Testing:
- Unit: versioning and current-reference rules.
- Integration: terms creation and reference updates.
- End-to-end: admin configuration flows that expose current terms to users later in the workflow.

## Applications

Purpose:
- Support event application submission, participant visibility, and admin review.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Submit application | `POST /api/events/:eventId/applications` | authenticated user | Allowed only in `registration_open`, only if no prior application exists, and only if the user profile satisfies the event's currently visible required profile fields. Requires exact-version acceptance only when the event has current application terms. Carries only the visible application fields: participation mode and optional teammate hints when participation mode is visible, `whyThisEvent` when visible, `proofOfExecutionUrl` when visible, `aiKnowledgeLevel` when AI Knowledge is visible, and `selectedTrackId` when a Build event has configured tracks. Build events with configured tracks require `selectedTrackId` to reference a track from the same event and do not require AI Knowledge for that application; Build events without tracks keep the configured AI Knowledge behavior. `proofOfExecutionUrl` accepts one or more comma-separated `http` or `https` links. `aiKnowledgeLevel` accepts `beginner`, `intermediate`, `advanced`, or an empty string unless visible AI Knowledge is required. For in-person events, also requires `inPersonAttendanceCommitment = true`. If configured, visible required fields must be non-empty. Hidden submitted fields are ignored. When the event shows and requires a Luma email and has configured Luma sync, submission also verifies that the participant's saved `lumaEmail` is registered as a guest on that Luma event before the application is created. An optional complete `talkProposal` payload is accepted only for an open Meetup Call for talks and creates the application and submitted proposal atomically after validating the current question-set revision and required answers. When `autoApproveApplications = true`, the created application is approved immediately and approval email/Luma sync side effects are enqueued only while approved participation is below the configured `participantsLimit`; after that limit is reached, new applications remain submitted for admin review. |
| Get own application | `GET /api/events/:eventId/applications/me` | authenticated user | Returns the caller's application for the event, if present. |
| Select own event track | `POST /api/events/:eventId/applications/me/actions/select-track` | submitted or approved applicant | Stores the caller's selected Hackathon or Build track on the caller's application. Accepts `{ trackId }`, requires the application to belong to the caller and be `submitted` or `approved`, requires the event to not be `completed`, requires the track to belong to the same event, updates `selectedTrackId`, writes an audit record, and returns the serialized application. |
| Verify own Luma email | `POST /api/events/:eventId/applications/me/actions/verify-luma-email` | approved user | Available only for the caller's approved application when the event shows and requires a Luma email and has configured Luma sync. Accepts a `lumaEmail`, rejects it when that email is already connected to another participant in the same event, checks whether that email is registered as a guest on the configured Luma event, and saves it to the caller's platform profile only when Luma confirms the guest exists. A confirmed email immediately retries the caller's Luma approval sync through the same provider-update path used by queued Luma sync work and returns the updated application sync state. If Luma has no matching guest, the saved profile email and application sync state remain unchanged. |
| Withdraw own application | `POST /api/events/:eventId/applications/me/actions/withdraw` | authenticated user | Allowed only when the caller's application is `submitted` or `approved` and the caller has no active team membership in the event. Transitions the application to `withdrawn`, records `withdrawnAt`, writes an audit record, and enqueues Luma guest rejection when the event shows and requires a Luma email and has configured Luma sync. This operation does not delete the application record. |
| List event applications | `GET /api/events/:eventId/applications` | staff, event admin, or platform admin | Returns paginated application records for participant-visibility and review workflows, including `selectedTrackId` for track chips and approved-participant track filters plus `isEventStaff` for current staff-designation filtering in participant roster and certificate-management surfaces. Supports `page`, `page_size` up to `100`, and optional `status`; response metadata includes total count and status counts. Staff access is read-only. |
| Withdraw application | `POST /api/events/:eventId/applications/:applicationId/actions/withdraw` | event admin or platform admin | Allowed only when the target application is `submitted` or `approved`. Transitions the application to `withdrawn`, records `withdrawnAt`, writes an audit record, and enqueues Luma guest rejection when the event shows and requires a Luma email and has configured Luma sync. If the participant still has an active team, the operation removes that membership when the team can remain valid. If the participant is the last active member or last active admin, the operation dissolves the team, closes pending join requests, and is blocked when doing so would affect an active draft, submitted, or locked submission. |
| Restore withdrawn application | `POST /api/events/:eventId/applications/:applicationId/actions/undo-withdrawal` | event admin or platform admin | Allowed only when the target application is `withdrawn` and the event is `registration_open`. Clears withdrawal, staged decision, review, and check-in fields, then follows the same post-registration outcome as a new application. If automatic approval is enabled and approved participation is below `participantsLimit` when one is configured, the application is approved immediately and the standard approval email and Luma approval sync side effects are enqueued. Otherwise, the application returns to submitted review. Restoration does not restore team membership, dissolved teams, or closed join requests. |
| Override participant attendance | `POST /api/events/:eventId/applications/:applicationId/actions/override-check-in` | event admin or platform admin | Allowed only for approved applications. Marks the participant joined or not joined, recording the acting admin and time. Sending the active decision again clears the override back to the Luma default. Effective attendance (the override when present, otherwise the Luma check-in) gates participation certificates. The action is audit logged. |
| Set own certificate generation | `POST /api/events/:eventId/applications/me/actions/set-certificate-visibility` | approved user | Disables or enables the caller's own participation certificate generation. Allowed only for the caller's approved application; disabled certificates respond not found on every public certificate read and account surfaces do not show the certificate link to the participant. The action is audit logged. |
| Set participant certificate revocation | `POST /api/events/:eventId/applications/:applicationId/actions/set-certificate-revocation` | event admin or platform admin | Revokes or restores certificate access for an approved participant. Revocation is allowed only while the participant currently has certificate access: effective attendance is true, participant certificate generation is not disabled, and certificate access is not already revoked. Restoring clears admin revocation and makes the certificate available again only when the participant is otherwise certificate-eligible. The action is audit logged. |
| Send certificate emails | `POST /api/events/:eventId/applications/actions/send-certificate-emails` | event admin or platform admin | Enqueues certificate thank-you emails for approved participants who currently have certificate access, have an active account email, are not current event staff, and do not already have a certificate email queued or sent. The action reserves matching applications before enqueueing so repeated runs send only to newly eligible participants. Queue processing re-checks certificate availability before delivery and records successful sends on the application. The action is audit logged. |
| Stage application approval | `POST /api/events/:eventId/applications/:applicationId/actions/approve` | event admin or platform admin | Persists `pre_approval_status = approved` for a `submitted` application without changing canonical status. |
| Stage application rejection | `POST /api/events/:eventId/applications/:applicationId/actions/reject` | event admin or platform admin | Persists `pre_approval_status = rejected` for a `submitted` application without changing canonical status. |
| Apply staged application decisions | `POST /api/events/:eventId/applications/actions/apply-staged-decisions` | event admin or platform admin | Applies all staged decisions for `submitted` applications, transitions canonical status, records reviewer metadata, enqueues participant-facing decision emails, and enqueues Luma guest-status sync when the event shows and requires a Luma email and has configured Luma sync. |

Testing:
- Unit: application guard and state-transition rules.
- Integration: exact-version acceptance persistence and review actions.
- End-to-end: applicant, staff visibility, and admin review flows.

Operational notes:
- Application review API actions remain successful even when queue enqueue fails.
- Queue-consumer delivery outcomes are retried under queue retry policy and provider-aware retry guards.
- Queue enqueue outcomes are recorded in audit metadata for operational visibility.
- Luma-enabled events persist per-application Luma sync state so admins can identify manual Luma follow-up after asynchronous sync failures.
- Application reads can also expose `checkedInAt` when inbound Luma attendance sync has confirmed the approved participant checked in.
- Application reads expose `selectedTrackId` when the participant has selected a track for the event.
- Withdrawn applications remain in the account-scoped event workspace as retained records rather than disappearing from history.
- Public registration entry is available only while the event is in `registration_open`.
- The public registration route `/events/:slug/register` is a narrow application-entry flow rather than a participant workspace. Anonymous visitors are sent to Auth0 login, authenticated users without a platform account are sent to account completion, existing applicants are sent to `/account/events/:slug`, and users without an application are sent back to the public event detail page when registration is no longer open.
- Public registration copy should stay focused on completing and submitting an application. Application status, approval outcome, team formation follow-up, and other ongoing participant workflow belong in the account-scoped event workspace.

## Talk Proposals

Purpose:
- Support one private Talk proposal per registered Meetup participant and read-only staff review with final admin decisions.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get own proposal | `GET /api/events/:eventId/talk-proposals/me` | authenticated applicant | Returns only the caller's retained proposal or null. A later rejected or withdrawn application does not hide it. |
| Create own proposal draft | `POST /api/events/:eventId/talk-proposals/me` | submitted or approved Meetup participant | Requires an enabled open Call for talks and no existing proposal. Accepts title, abstract, optional HTTP(S) `demoOrSlidesUrl`, the current `questionSetRevision`, and private ordered `answers`. The revision is checked again by the conditional insert. |
| Update own proposal draft | `PATCH /api/events/:eventId/talk-proposals/me` | proposal owner | Requires `draft`, an open Call for talks, a currently submitted or approved application, the retained question-set revision, and answers whose types and choices match the event definition. Submitted and decided content is read-only. |
| Submit or resubmit own proposal | `POST /api/events/:eventId/talk-proposals/me/actions/submit` | proposal owner | Requires `draft`, an open Call for talks, current eligibility, valid proposal content, every required custom answer, and confirmed acknowledgments. Records submission time. |
| Withdraw own proposal | `POST /api/events/:eventId/talk-proposals/me/actions/withdraw` | proposal owner | Requires `submitted`, an open Call for talks, and current eligibility. Decisions cannot be withdrawn. |
| Revise own proposal | `POST /api/events/:eventId/talk-proposals/me/actions/revise` | proposal owner | Requires `withdrawn`, an open Call for talks, and current eligibility. Returns the proposal to editable `draft`. |
| List event talk proposals | `GET /api/events/:eventId/talk-proposals` | staff, event admin, or platform admin | Returns paginated private proposals with `page`, `page_size` up to `100`, and optional status filter. Retains rows when owner application status later changes. |
| Get talk proposal detail | `GET /api/events/:eventId/talk-proposals/:proposalId` | staff, event admin, or platform admin | Returns the exact private proposal and owner/application review context. Staff access is read-only. |
| Accept talk proposal | `POST /api/events/:eventId/talk-proposals/:proposalId/actions/accept` | event admin or platform admin | Conditionally changes a still-`submitted` proposal when the event is not completed. Allowed after the Call for talks closes. Accepts an optional speaker-facing `message`, records reviewer metadata and durable pending email state together, and attempts enqueue without rolling back the decision if enqueue fails. |
| Reject talk proposal | `POST /api/events/:eventId/talk-proposals/:proposalId/actions/reject` | event admin or platform admin | Conditionally changes a still-`submitted` proposal when the event is not completed. Allowed after the Call for talks closes. Accepts an optional speaker-facing `message`, records reviewer metadata and durable pending email state together, and attempts enqueue without rolling back the decision if enqueue fails. |

Operational notes:
- Acceptance and rejection are final and do not create, update, or synchronize public speaker records or agenda items.
- Decision messages include the outcome, optional admin message, and account-workspace link.
- A scheduled reconciler claims pending or retryable delivery rows and republishes the same deterministic delivery ID without repeating or changing the decision.
- Queue delivery is at least once. Durable expiring claims prevent concurrent sends and completed duplicates; deterministic email metadata supports provider-side duplicate suppression. A crash after provider acceptance but before the sent-state write can still result in a later retry.
- Enqueue and delivery attempts and outcomes are stored and audited without logging proposal title, abstract, demo-or-slides URL, or decision-message text.
- Account deletion removes the caller's private proposal and delivery state.

## Teams

Purpose:
- Support team creation, discovery, internal visibility, and team management.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List teams | `GET /api/events/:eventId/teams` | approved user, team member, team admin, staff, event admin, or platform admin | Team summaries include the optional team bio. Participant-facing reads exclude dissolved teams with no active members. Staff, event-admin, and platform-admin reads can still include dissolved teams for operational context. Staff access is read-only and is not limited to the participant team-formation window. The participant workspace can use filters to render all teams, joinable teams, solo teams, or multi-person teams. |
| Get team detail | `GET /api/events/:eventId/teams/:teamId` | approved user, team member, team admin, staff, event admin, or platform admin | Returns team fields, including the optional team bio, active members, join openness, and the participant workspace mode according to visibility rules. Participant-facing reads exclude dissolved teams with no active members. Staff, event-admin, and platform-admin reads can still include dissolved teams for operational context. Staff access is read-only. |
| Create team | `POST /api/events/:eventId/teams` | approved user | Allowed only in `registration_open` or `submission_open` for an approved participant without an active team membership in the event. Accepts the initial team name, optional team bio, join openness, and the requested participant workspace mode. Creator becomes an admin member automatically. The participant workspace uses this route both for explicit solo participation and for regular team creation from the no-team workspace. Initial slug is derived from the submitted team name plus a random 4-digit suffix. |
| Update team profile | `PATCH /api/events/:eventId/teams/:teamId` | team admin | Updates the team name and optional team bio. When the name changes, the team slug is regenerated as a new unique slug derived from the updated name. |
| Update join openness | `PATCH /api/events/:eventId/teams/:teamId/join-policy` | team admin | Controls `is_open_to_join_requests`. |
| Leave team | `POST /api/events/:eventId/teams/:teamId/actions/leave` | team member or team admin | Allowed when at least one active admin remains after the leave. During `registration_open` or `submission_open`, the last active member can also leave if the team has no active draft, submitted, or locked submission; that leave dissolves the team and closes outstanding join requests. After submission closes, at least one active team member must remain. |
| Make member admin | `POST /api/events/:eventId/teams/:teamId/members/:userId/actions/make-admin` | team admin | Allowed only for another active non-admin member of the team. |
| Remove member | `POST /api/events/:eventId/teams/:teamId/members/:userId/actions/remove` | team admin | Allowed only if at least one active admin remains after removal. |

Testing:
- Unit: one-team-per-event, active-admin, and active-member rules.
- Integration: team creation, profile updates, join openness, and membership updates.
- End-to-end: approved-user, staff visibility, and team-admin management flows.

## Team Join Requests

Purpose:
- Support requests to join open teams and team-admin review.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Create join request | `POST /api/events/:eventId/team-join-requests` | approved user | Allowed only during team-formation states and only for open teams with available capacity. |
| List team join requests | `GET /api/events/:eventId/teams/:teamId/join-requests` | team admin | Returns pending and decided requests for the team. |
| Cancel own pending join request | `POST /api/events/:eventId/team-join-requests/:requestId/actions/cancel` | requesting user | Allowed only while the request remains `pending`. |
| Approve join request | `POST /api/events/:eventId/team-join-requests/:requestId/actions/approve` | team admin | Requires approved application, capacity, openness, and no active team membership elsewhere in the event. |
| Reject join request | `POST /api/events/:eventId/team-join-requests/:requestId/actions/reject` | team admin | Transitions `pending` to `rejected`. |

Testing:
- Unit: join-request state guards and membership constraints.
- Integration: request creation and review effects on memberships.
- End-to-end: approved-user request flows and team-admin review flows.

## Submissions

Purpose:
- Support team-owned submission creation, editing, submission, withdrawal, and admin disqualification.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get team submission | `GET /api/events/:eventId/teams/:teamId/submission` | team member, team admin, event admin, or platform admin | Returns the current submission if present, including the selected track when one exists. |
| Create submission draft | `POST /api/events/:eventId/teams/:teamId/submission` | team admin | Allowed only in `submission_open`. When the event has configured tracks, the body must select exactly one valid track for that event. `summary`, `repositoryUrl`, and `demoUrl` are required only when the event configuration enables those submission requirements. |
| Update submission | `PATCH /api/events/:eventId/teams/:teamId/submission` | team admin | Allowed in `submission_open` and in `judging_preparation` until the submission is locked. When the event has configured tracks, the body must keep a valid selected track. `summary`, `repositoryUrl`, and `demoUrl` are required only when the event configuration enables those submission requirements. |
| Toggle completed project public visibility | `PATCH /api/events/:eventId/teams/:teamId/submission/public-visibility` | team admin | Allowed only after `completed` for locked non-winning submissions. Updates whether the project appears in the separate completed published-projects section. |
| Submit project | `POST /api/events/:eventId/teams/:teamId/submission/actions/submit` | team admin | Allowed in `submission_open` and in `judging_preparation` until the submission is locked. When the event has configured tracks, the submission must already reference exactly one valid track. Any submission fields configured as required by the event must already be present and valid. |
| Withdraw submission | `POST /api/events/:eventId/teams/:teamId/submission/actions/withdraw` | team admin | Allowed only until submitted work is locked for judging. |
| Withdraw submission on team request | `POST /api/events/:eventId/teams/:teamId/submission/actions/admin-withdraw` | event admin or platform admin | Allowed only until submitted work is locked for judging. The body must include `requestedByUserId`, and that user must be an active team admin of the submission's team. |
| Disqualify submission | `POST /api/events/:eventId/teams/:teamId/submission/actions/disqualify` | event admin or platform admin | Used instead of withdrawal once review-phase removal rules apply. |
| List no-submission teams | `GET /api/events/:eventId/no-submission-teams` | event admin or platform admin | Returns the computed operational section for approved teams with no active submitted submission. |
| Get submission summary | `GET /api/events/:eventId/submissions/summary` | event admin or platform admin | Returns aggregate team/submission counts for Operations without returning team or submission rows. |

Testing:
- Unit: submission-state and withdrawal or disqualification rules.
- Integration: create, update, submit, withdraw, disqualify, and no-submission derived reads.
- End-to-end: team-admin submission flows and admin removal flows.

## Judging

Purpose:
- Support blind judging, pitch judging, assignment operations, and review outcomes.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List active judge assignments | `GET /api/events/:eventId/judging/assignments` | assigned judge, event admin, or platform admin | Judges see only their assignments for the current judging stage. Blind assignments render in blind view. Pitch assignments render in the open pitch view. Admin operational assignment views are paginated and support `page` and `page_size` up to `100`. |
| Get judging summary | `GET /api/events/:eventId/judging/summary` | event admin or platform admin | Returns aggregate judging assignment counts for Operations without returning assignment rows. |
| Get assignment detail | `GET /api/events/:eventId/judging/assignments/:assignmentId` | assigned judge, event admin, or platform admin acting through assignment review | Blind-review responses exclude team identity and include anonymized application information plus the selected submission track. Pitch-review responses expose project name, team name, and full finalist submission detail. |
| Save in-progress blind-review criterion scores | `PATCH /api/events/:eventId/judging/assignments/:assignmentId` | assigned judge, event admin, or platform admin acting through assignment review | Allowed only for `blind_review` assignments in `judge_started`. Persists the provided subset of criterion scores without completing the review. Completed blind reviews must still include every criterion. |
| Start assigned review | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/start` | assigned judge, event admin, or platform admin acting through assignment review | Transitions `assigned` to `judge_started`. |
| Complete assigned review | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/complete` | assigned judge, event admin, or platform admin acting through assignment review | Records blind-review criterion scores for `blind_review` assignments or a `pitchScore` plus optional comment for `pitch_review` assignments. |
| Skip assigned review | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/skip` | assigned judge, event admin, or platform admin acting through assignment review | Blind-review assignments create a new active assignment for another eligible judge with the lowest blind-review load. Pitch-review assignments are marked skipped and excluded from the pitch average. |
| Mark assignment ineligible | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/mark-ineligible` | assigned judge, event admin, or platform admin acting through assignment review | Records ineligibility at the assignment level. |
| Reassign unstarted assignment | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/reassign` | event admin or platform admin | Allowed only for `blind_review` assignments before review has started. |
| Force assignment to skipped | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/force-skip` | event admin or platform admin | Used when the assigned judge cannot complete review. Blind-review force-skip triggers replacement assignment creation. Pitch-review force-skip excludes that vote from the pitch average. |
| Revert ineligibility decision | `POST /api/events/:eventId/judging/assignments/:assignmentId/actions/revert-ineligibility` | event admin or platform admin | Reopens the assignment's eligibility status without changing the assignment's stage-specific visibility rules. |

Testing:
- Unit: blind-view, pitch-view, reassignment, score-normalization, and review-state rules.
- Integration: assignment state transitions, blind-load balancing, pitch-panel assignment creation, and missing-vote behavior.
- End-to-end: judge persona blind-review flows, pitch-review flows, and admin intervention flows.

## Shortlist

Purpose:
- Expose blind-review ordering plus manual shortlist ordering and finalist selection for pitch-enabled events.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get leaderboard | `GET /api/events/:eventId/leaderboard` | judge, event admin, or platform admin | Returns the computed scored ordering for the enabled scoring stages completed so far. During blind review, shortlist, and `pitch`, this is the blind-review leaderboard. During or after pitch review, this is the weighted final scoreboard. |
| Get shortlist view | `GET /api/events/:eventId/shortlist` | judge, event admin, or platform admin | Returns the blind shortlist ordering visible during `shortlist`, including the current finalist boundary and finalist order. The shortlist view remains blind with respect to team identity. |
| Select pitch finalists | `POST /api/events/:eventId/shortlist/actions/select-finalists` | event admin or platform admin | Persists the full ordered shortlist plus the leading finalist subset that advances to the live `pitch` stage. Allowed only during `shortlist`. |

Testing:
- Unit: shortlist guard, blind-ordering, and finalist-selection rules.
- Integration: leaderboard and shortlist response behavior.
- End-to-end: blind-review visibility and admin finalist-selection flows.

## Final Deliberation

Purpose:
- Expose the final weighted score review and ranking-adjustment process before winner announcement.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get final deliberation view | `GET /api/events/:eventId/final-deliberation` | judge, event admin, or platform admin | Returns the final weighted scoreboard, score breakdown by enabled stage, and the current final-deliberation order. When no explicit final order has been saved yet, the ranked entries default to combined-score order. |
| Reorder final ranking | `POST /api/events/:eventId/final-deliberation/actions/reorder` | event admin or platform admin | Adjusts final ranking order without mutating underlying blind or pitch scores. |

Testing:
- Unit: final-deliberation guard, score-breakdown, and ranking-override rules.
- Integration: final-deliberation response behavior and ranking override persistence.
- End-to-end: final ranking review and admin reorder flows.

## Winners

Purpose:
- Expose final winner state after final deliberation.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| Get winners | `GET /api/events/:eventId/winners` | public or authenticated user after completion | Returns the completed winners showcase with prize, project, and published winning-team details. Completed reads use the generated outcome cache. |
| Get published projects | `GET /api/events/:eventId/published-projects` | public or authenticated user after completion | Returns the separate completed published-projects section with opted-in non-winning locked projects and published team-member details. Completed reads use the generated outcome cache, which is refreshed when eligible project visibility changes. |

Testing:
- Unit: winner visibility guards.
- Integration: state-dependent winner reads.
- End-to-end: post-announcement winner visibility.

## Prize Redemption

Purpose:
- Support Hackathon prize-eligibility reads and winner redemption flows.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List prize eligibility and redemptions for an event | `GET /api/events/:eventId/prize-redemptions` | event admin or platform admin | Hackathon only. Returns operational redemption records and eligibility context. Ranking context is omitted by default and included only when `include_rankings=true`. |
| Get own pending prize redemptions | `GET /api/prize-redemptions/me` | prize recipient | Returns the caller's redemption tasks across events. Member-scoped redemptions appear for the eligible user. Team-scoped redemptions appear for active team admins of the winning team. |
| Submit prize redemption | `POST /api/prize-redemptions/:redemptionId/actions/redeem` | prize recipient | Requires legal name and exact-version acceptance of the current winner terms for the event. Team-scoped redemption requires active team-admin access to the winning team. |

Testing:
- Unit: prize-eligibility freeze and winner-terms acceptance rules.
- Integration: redemption writes and restricted operational reads.
- End-to-end: prize-recipient redemption flows and admin visibility.

## Event Credits

Purpose:
- Support event admin-managed credit inventory and approved-participant or staff credit claims.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List participant-visible credits for an event | `GET /api/events/:eventId/credits` | approved participant, event staff, event admin, or platform admin | Returns ordinary credit offers with the caller's own claim state for that event when the caller can claim credits. Simplified-only offers are omitted. |
| List admin credit inventory for an event | `GET /api/events/:eventId/admin/credits` | event admin or platform admin | Returns ordinary offers, inventory counts, and claim records for the event. Simplified-only offers are omitted. |
| Create credit offer | `POST /api/events/:eventId/credits` | event admin or platform admin | Creates one event credit offer with participant-facing name and markdown description fields. |
| Update credit offer | `PATCH /api/events/:eventId/credits/:creditId` | event admin or platform admin | Updates participant-facing credit-offer metadata, including the markdown description. |
| Import credit inventory into an offer | `POST /api/events/:eventId/credits/:creditId/import` | event admin or platform admin | Accepts a single-column CSV upload and appends one redeemable value per non-empty row. |
| Claim one credit from an offer | `POST /api/events/:eventId/credits/:creditId/actions/claim` | approved participant or event staff | Returns the caller's existing assigned value for that offer when already claimed; otherwise atomically assigns one unclaimed uploaded value. |
| Delete an unclaimed credit offer | `DELETE /api/events/:eventId/credits/:creditId` | event admin or platform admin | Deletes the offer and inventory only when no inventory row has been claimed. |
| Get simplified claiming readiness | `GET /api/events/:eventId/simplified-claiming` | event admin or platform admin | Returns the attendee count, simplified giveaway list, per-giveaway availability and detected link/code counts, redirect selection and readiness, locked state, redemption URL, and non-sensitive setup issues. |
| Import simplified claiming rewards | `POST /api/events/:eventId/simplified-claiming/rewards/import` | event admin or platform admin | Accepts a bounded single-column CSV of codes or HTTPS links. With a `creditId`, appends exact new values to that giveaway; otherwise requires `name` and optional plain-text `description` and atomically creates the giveaway with its inventory. Detects formats on both client and server, rejects invalid link-like values, and restricts the redirect giveaway to HTTPS links. Up to 2 MB and 2,000 rows per upload, 2,048 characters per value, and 20 giveaways per event. Remains available after claiming begins. |
| Update simplified giveaway | `PATCH /api/events/:eventId/simplified-claiming/rewards/:creditId` | event admin or platform admin | Accepts `name` (up to 200 characters), plain-text `description` (up to 2,000 characters), and `redirectOnClaim`. Selecting a link-only giveaway clears the previous selection. Redirect selection is fixed after the first claim. |
| Import simplified claiming attendees | `POST /api/events/:eventId/simplified-claiming/attendees/import` | event admin or platform admin | Accepts a bounded Luma CSV, requires `email`, `first_name`, `last_name`, and `approval_status`, and merges only approved minimal attendee eligibility by normalized email. Remains available after claiming begins. |
| Import existing Luma check-ins | `POST /api/events/:eventId/simplified-claiming/attendees/import-check-ins` | event admin or platform admin | Requires simplified Meetup claiming and saved Luma credentials. Fetches approved guests across pages, up to 10,000 guests, and merges only guests with a checked-in ticket by normalized email. Does not create applications, send Luma decisions, or reset claims. Repeated imports are safe; failed fetches do not mutate eligibility. |
| Get own simplified claim state | `GET /api/events/slug/:slug/simplified-claim` | authenticated platform user with current legal consent | Returns the original claim result with the selected redirect URL or null or a non-sensitive ready, unavailable, closed, or sold-out state. `closed` identifies a configured claim whose registration window has ended; private setup failures remain `unavailable`. |
| Claim simplified Meetup giveaways | `POST /api/events/slug/:slug/simplified-claim/actions/redeem` | authenticated platform user with current legal consent | During open registration, verifies the normalized Luma email, consumes attendee eligibility once, approves an absent or submitted application, atomically assigns one available value per giveaway, skips exhausted giveaways, records attendance, and queues one receipt containing all assigned values to the participant's account email. Returns the selected giveaway's assigned HTTPS URL, or null when that giveaway is exhausted. Repeated claims return the original result without assigning more values or queuing another receipt. |

The `/events/:slug/redeem` page is unlinked, `noindex`, `nofollow`, and uses a no-referrer policy. Simplified-only offers are omitted from participant and admin credit listings, and their generic metadata, inventory-import, and manual-claim routes are rejected. Disabling the event setting does not expose or convert their inventory.

Testing:
- Unit: participant eligibility, URL-versus-code presentation helpers, and single-claim guards.
- Integration: admin inventory writes, unique append behavior for both simplified CSV imports before and after claiming begins, readiness and configuration locking, sold-out responses, ordinary atomic claims, and simplified transactional redemption.
- End-to-end: account event Credits flows plus QR scan, authentication/account consent, attendee matching, external redirect, repeat redirect, and admin attendance visibility.

## Audit

Purpose:
- Expose restricted audit reads for sensitive or operationally important actions.

Operations:

| Operation | Method And Path | Actor | Guards And Notes |
| --- | --- | --- | --- |
| List audit records for an event | `GET /api/events/:eventId/audit` | event admin or platform admin | Returns audit records relevant to the event scope. |
| List platform audit records | `GET /api/audit` | platform admin | Returns platform-wide audit records for sensitive actions such as account deletion and admin operations. |

## Model Context Protocol

`POST /mcp` is the single stateless Streamable HTTP endpoint. It accepts only
`Authorization: Bearer <credential>`. The credential can be an Auth0 OAuth
access token for the configured MCP resource, or a named
manual MCP access token issued from account settings. Session cookies do not
authenticate it. The endpoint handles initialization, `tools/list`, and `tools/call`.
Deployment host and present browser Origin values must match configured
allowlists.

`GET /.well-known/oauth-protected-resource` publishes the canonical MCP
resource, Auth0 authorization server, and supported bearer method. An unauthenticated `/mcp` response links to that metadata through
`WWW-Authenticate`. Auth0 publishes its own authorization-server discovery and
owns Authorization Code with PKCE, refresh, and revocation. Auth0 uses
administrator-approved CIMD for standards clients and deployment automation
idempotently imports configured trusted HTTPS Client ID Metadata Document URLs.
Unknown metadata URLs are rejected without creating tenant applications. Each
registered client supplies its own
redirect contract: Inspector and Codex use their documented loopback callbacks,
while ChatGPT hosted connectors use their MCP-specific HTTPS callback. A default third-party user grant
allows the `mcp` API permission for that resource, while `/mcp` validates the
issued token's signature, issuer, expiry, exact audience, subject, and client
identity. It does not require OIDC or custom permission scopes that strict
third-party Auth0 clients may not place in the access-token `scope` claim.

The application-operation registry is shared by REST and MCP. Each eligible
operation has one stable ID, Zod input/output contracts, one REST binding, one
MCP tool, coarse capability metadata, and accurate read-only, destructive, and
idempotent annotations. Every advertised tool also declares OAuth through
`securitySchemes` with an empty scope set because platform permissions are not
OAuth scopes. REST and MCP preserve the same structured success
envelope, side effects, authorization decisions, and sanitized expected errors.

Eligible operations are public discovery and signed-in structured JSON work in
account/profile, events, applications, teams, project submissions, judging,
roles, settings, credits, outcomes, Meetup talk proposals, and platform
administration. Authentication/account linking, MCP-token management, account
deletion, public mutations, webhooks, queue/system consumers, integration
backfills/retries, CSV imports, email-delivery controls, and raw binary transfer
are not MCP tools. [mcp.md](mcp.md) defines the inventory and security boundary.

Session-authenticated token management remains REST-only:

| Operation | Method And Path | Notes |
| --- | --- | --- |
| List own MCP access tokens | `GET /api/account/mcp-tokens` | Paginated; omits hashes and full credentials. |
| Create MCP access token | `POST /api/account/mcp-tokens` | Returns the full credential once; fixed 30-day expiry and five-active-token cap. |
| Revoke MCP access token | `DELETE /api/account/mcp-tokens/:tokenId` | Owner-only and immediate. |

The MCP envelope is limited to 120 requests per manual credential or OAuth
user/client pair per 60 seconds in
addition to operation-specific limits. Each request reconstructs the current
actor and required-document acceptance from D1. Mutation attempts record the
authentication method, a safe manual-token or OAuth-client reference, tool
name, outcome, and timestamp without credentials, authorization codes, refresh
tokens, secrets, or arguments.

Testing:
- Unit: visibility rules for audit access.
- Integration: audit persistence and restricted reads.
- End-to-end: admin-only audit visibility.

## Cross-Domain Rules

- A user can have at most one `UserApplication` per event.
- A user can have at most one `TalkProposal` per Meetup.
- A user can have at most one active team membership per event.
- Non-admin `staff` and `judge` assignments remain distinct.
- A Hackathon must enable at least one judging stage: blind review, pitch review, or both.
- Hackathon `blindReviewCount` can be `0`, `1`, or `2`.
- Hackathon team formation is available only during `registration_open` and `submission_open`.
- Hackathon submission creation is available only during `submission_open`.
- Submission updates, submit, and withdraw remain available during `submission_open` and `judging_preparation` until the submission is locked for judging.
- A draft submission that is never submitted is treated as no submission for judging and dashboard purposes.
- In-person application commitment is required only when the event is configured with `inPersonEvent = true`.
- Withdrawal ends when submitted work is locked for judging.
- Removal from competition during or after judging uses `disqualified`.
- Event credits are separate from prizes and do not depend on winner announcement.
- Approved participants can claim at most one uploaded value from each event credit offer.
- Hackathon prize-eligible team membership freezes when submitted work is locked for judging.
- Event feedback submission is anonymous in product data and becomes available only after the event reaches `completed`.
- Each event type has a platform-defined feedback question set, and each feedback answer accepts either a `1..5` rating or an explicit `Not applicable` response.
- Blind judging excludes team identity even when the reviewing actor is also an admin.
- Pitch judging exposes project and team identity to the pitch panel.
- Blind assignment scores are normalized to the shared `1..5` scale by dividing weighted criterion totals by total criterion weight.
- Pitch scores use the shared `1..5` scale.
- Blind score is the average of completed blind-review assignments for the submission.
- Pitch score is the average of submitted pitch-review votes for the submission.
- When blind review and pitch review are both enabled, final score uses configurable blind and pitch weights that default to `70` and `30`.
- When only one judging stage is enabled, final score comes entirely from that stage.
- `shortlist` exists only for events that use both blind review and pitch review.
- `pitch` is the live finalist presentation stage that happens before post-pitch judge assignments are created and exposes one enabled presentation at a time.
- Pitch-only events send all eligible locked submissions directly to `pitch`.
- Shortlist leaderboard data remains a computed blind-view surface, while the saved shortlist order and any later final-deliberation reorder persist the admin-selected ranking order used by later judging and winner workflows.
- Granting platform-admin access also normalizes explicit `event_admin` assignment coverage across existing events.
- Event organizers can create events but see only events where they hold scoped access.
- Event admins are scoped to their assigned events. An organizer or event admin for one event can submit a participant application to another event where they do not hold event-admin access.

## Test Coverage Matrix

| Domain | Unit | Integration | Authenticated End-to-End |
| --- | --- | --- | --- |
| Session | Required | Required | Required |
| Legal | Required | Required | Not required |
| Platform documents | Required | Required | Required |
| Account | Required | Required | Required |
| Platform admins | Required | Required | Required |
| Events | Required | Required | Required for actor-facing admin and public flows |
| Event roles | Required | Required | Required |
| Event terms | Required | Required | Required where the flow is actor-facing |
| Feedback | Required | Required | Required |
| Applications | Required | Required | Required |
| Teams | Required | Required | Required |
| Team join requests | Required | Required | Required |
| Submissions | Required | Required | Required |
| Judging | Required | Required | Required |
| Shortlist | Required | Required | Required |
| Winners | Required | Required | Required for visibility transitions |
| Prize redemption | Required | Required | Required |
| Audit | Required | Required | Required for restricted admin access |
