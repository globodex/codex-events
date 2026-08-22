# Model Context Protocol

Codex Events exposes structured platform operations through a stateless
Streamable HTTP endpoint at `/mcp`. MCP is a protocol, authentication,
input/output, annotation, and error adapter around the same application
operations used by REST. It does not own authorization, lifecycle rules,
persistence, side effects, domain auditing, or serialization.

## Authentication

Auth0 OAuth is the recommended connection method. The server publishes OAuth
protected-resource metadata for the canonical `/mcp` URL and challenges
unauthenticated requests with a link to that metadata. Compatible clients use
Authorization Code with PKCE against the configured Auth0 authorization server
for the canonical MCP resource.

The authorization server uses administrator-approved HTTPS Client ID Metadata
Documents (CIMD) as the MCP client-registration path. A client uses its
metadata document URL as `client_id`; deployment imports trusted metadata URLs
and reconciles them idempotently. Only administrator-approved metadata
documents may create MCP client registrations.

Redirect URIs belong to the registering client. MCP Inspector uses its own
loopback callback, Codex local clients derive a local callback for the server,
and a ChatGPT hosted connector uses the MCP-specific HTTPS callback shown in
ChatGPT. One client's callback or metadata URL must not be substituted for
another client's contract.

The Auth0 MCP resource server allows user-delegated access only through a client
grant, denies machine-only access, permits offline refresh for interactive
clients, and does not apply Auth0 RBAC. Platform roles, event roles, team
membership, judging assignments, and legal-document acceptance remain
authoritative in D1 and are evaluated for every request.

Auth0's default third-party user grant allows the `mcp` API permission for the
canonical resource. The grant authorizes trusted third-party clients to request
that resource; it is not an application role and is not required as a scope
claim because clients do not consistently request or receive custom API or OIDC
scopes in strict third-party access tokens. The platform never broadens access
for an unknown client or another resource.

The endpoint validates the OAuth access token signature through the Auth0 JWKS,
then validates its issuer, expiry, exact audience, subject, and client identity.
The subject must map to an active platform user. Auth0 owns OAuth grants, access and
refresh tokens, client registration, and revocation; Codex Events stores none
of those credentials.

Manual MCP access tokens are a secondary method for clients that require a
copied bearer credential. Users create named tokens from account settings
through session-authenticated REST APIs. A manual credential contains a public
token identifier and high-entropy secret. The full value is shown once. D1
stores only a secure one-way hash and a safe display prefix. A user can have
five active tokens; creation enforces that limit atomically so concurrent
requests cannot exceed it. Each token expires exactly 30 days after creation
and can only be revoked, not renewed. Account deletion deletes the credentials.

The endpoint rejects absent, malformed, unknown, expired, revoked, or
deleted-owner manual credentials and invalid OAuth credentials with sanitized
errors. Cookies never authenticate `/mcp`. Both methods resolve the current
platform user, roles, team and judging relationships, and required-document
acceptance on every request.

## Operation Inventory

The source inventory is the shared operation registry. Eligibility is explicit:

- Include public structured discovery under `/api/events` and `/api/public`
  when the response is JSON and does not transfer raw files.
- Include signed-in structured JSON operations for account/profile, events,
  applications, teams and join requests, project submissions, judging,
  event/platform roles and settings, credits, outcomes and prize redemption,
  Meetup talk proposals, audit reads, and platform administration.
- Exclude `/api/auth`, `/auth`, account registration/linking/email verification,
  `/api/account/mcp-tokens`, `DELETE /api/account`, all profile/event image and
  photo binary upload/download routes, CSV imports, Luma webhooks and retry or
  backfill integration controls, queue consumers, startup recovery, email-send
  controls, and other system-only entrypoints.

The explicit manifest contains every included method/path pair, including all
ten talk-proposal operations and the two read-only event-builder operations.
Each appears once with a stable operation ID and is routed through one compact
macro tool.
Every other concrete Nitro route has an exclusion reason in the same manifest;
completeness therefore does not depend on a route opting into the registry.
There is no generic REST passthrough, arbitrary path or method input, fallback
adapter, or dual-read path.

The event-builder catalog and analysis operations are visible only to event
organizers and platform admins. The catalog returns the canonical block
paytable, event-type profiles, application-field keys, and templates. Analysis
runs the canonical balance engine against an unsaved agenda and never persists
the draft. Event creation remains the `post.events` action in `events_upsert`.

## Macro Tool Contract

The MCP surface has at most eight tools:

- `events_read` and `events_upsert`;
- `participation_read` and `participation_upsert`;
- `judging_read` and `judging_upsert`;
- `administration_read` and `administration_upsert`.

An operation's explicit domain selects its macro family, and its existing
effect selects `read` or `upsert`. Prize configuration, prize discovery, and
prize redemption operations use the participation macros.

A macro is registered only when the current actor has at least one operation in
that group. Its `action` enum contains only operation IDs authorized by the
actor's combined current capabilities. An unauthorized operation is absent
from discovery and cannot be selected through another macro. Role changes are
reflected on the next request.

Each macro accepts an `action` and optional `input`. Omitting `input` returns
the selected action's description, effect, and exact JSON input schema without
running it. Supplying `input` executes the action. The input is validated
against the operation's existing Zod schema before its executor runs, including
the exact `params`, `query`, and `body` fields. Validation errors contain safe
field paths and messages.

The complete operation schemas are not repeated in `tools/list`. Discovery
contains only the macro descriptions and role-filtered action enums. This keeps
the model context small while preserving exact operation contracts on demand.

## Registry Contract

Every operation routed by a macro declares:

- stable ID and user-facing tool description;
- one explicit macro domain: events, participation, judging, or administration;
- one REST method and route template;
- operation-specific Zod input and output schemas for the complete structured
  envelope;
- explicit coarse capabilities that mirror the operation's actual guard and
  are used only for discovery;
- an explicit effect classification from which read-only, destructive,
  and idempotent annotations are derived;
- an OAuth `securitySchemes` declaration with no resource scopes, because D1
  actor permissions rather than OAuth scopes authorize operations;
- one executor containing validation, exact authorization, lifecycle rules,
  persistence, side effects, domain audit, and serialization.

Field-level output schemas are generated from the inferred serialized return
type of each shared executor and checked into the registry. Validation fails
when a response type changes without regenerating its MCP contract; whole
payload `unknown`, `any`, or generic JSON schemas are not valid operation
contracts. Pagination metadata is inferred per operation. Audit metadata is the
only dynamic object contract: it is constrained to bounded JSON values because
the audit APIs intentionally return metadata from multiple domain action types.

The eligibility manifest is maintained independently for every concrete API
route. Each exclusion uses a reviewed category, and the MCP loader catalog is
generated only from entries explicitly marked for inclusion. Completeness tests
compare the manifest, concrete routes, generated catalog, and routed actions.

REST handlers parse HTTP transport values and invoke the executor. MCP tools
parse protocol input and invoke the same executor. Expected failures retain the
API error code, message, and safe details. Unexpected failures become a generic
internal error.

## Security And Operations

- Host and Origin are parsed safely and checked against configured deployment
  allowlists before bearer authentication, database access, rate limiting,
  token-use updates, or catalog loading. Malformed and disallowed values fail
  closed with a sanitized client error.
- `MCP_RATE_LIMITER` enforces 120 envelope requests per manual credential or
  OAuth user/client pair per 60 seconds; operation-specific limits still apply.
- Tool lists are filtered by current coarse capabilities. Each call reruns all
  exact event, team, assignment, consent, and lifecycle guards.
- Tool-catalog tests record the exact macro names, authorized actions, and
  serialized descriptor size for representative participant, staff, judge,
  event-admin, event-organizer, combined-role, and platform-admin actors.
  Catalog growth is an explicit review event because every added descriptor
  consumes model context.
- Manual-token `lastUsedAt` writes are coalesced so ordinary traffic does not
  write on every call.
- Every mutation attempt writes the authentication method, a safe token ID or
  OAuth client reference, macro tool name, action ID, outcome, and timestamp to
  audit storage.
  Tool inputs, request bodies, OAuth credentials, authorization codes, refresh
  tokens, manual credentials, hashes, and secrets are never logged or audited.
- Observability may record HTTP status, sanitized error code, operation ID,
  latency, and rate-limit outcomes only.

The supported server stack pins `agents@0.20.1` and
`@modelcontextprotocol/server@2.0.0`. The `/mcp` endpoint uses
`createMcpHandler` from `agents/mcp/server`, negotiates MCP 2026-07-28, and
creates a fresh stateless server for every request. Auth0 OAuth and optional
30-day manual tokens are supported. Permanent credentials, legacy SSE, and
protocol-session storage are not part of the platform.

For clients that implement MCP Apps, `events_read` advertises an optional
`ui://` resource when the actor can use `post.events.builder.analyze`. The UI
renders the score and recommendations for that action. Its HTML has no external
network or asset dependencies, and the structured result remains complete for
clients that do not render MCP Apps.
