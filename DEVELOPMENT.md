# Development

This file is contributor-facing documentation for working on the `codex-events` repository locally.

## Setup

Required local tools:

- Bun, matching the version pinned in `package.json`.
- Node.js 24.11+ or 26+ for the lint and test tools.
- Backlog.md CLI, with the `backlog` command available on `PATH`.
- Codex CLI for the default local sign-in flow.

TypeScript is pinned to 6.0.3 because Vue's typechecker, TypeScript ESLint,
and the schema generator require its JavaScript compiler API.

Install dependencies:

```bash
bun install
```

For ordinary local development, run:

```bash
bun run dev
```

When the required Auth0 variables are absent, the application uses the installed
Codex CLI for local sign-in. Select **Sign in** in Codex Events, complete the
Codex browser flow, and the application creates a local session from the
ChatGPT email returned by Codex app-server. **Sign out** clears only the Codex
Events session and does not sign the machine out of Codex.

This development-only identity uses the normalized email as its identifier. A
ChatGPT email change therefore creates a different local identity. The
application does not read or store Codex access or refresh tokens.

To exercise Auth0 locally, copy `.env.example` to `.env` and provide the Auth0
development values below. When all four required Auth0 session variables are
present, local development uses Auth0 instead of the Codex flow.

Auth0-backed local runtime variables:

```bash
NUXT_AUTH0_DOMAIN=your-tenant.auth0.com
NUXT_AUTH0_CLIENT_ID=your-auth0-client-id
NUXT_AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_MGMT_CLIENT_ID=your-management-client-id
AUTH0_MGMT_CLIENT_SECRET=your-management-client-secret
NUXT_AUTH0_SESSION_SECRET=replace-with-generated-session-secret
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_DATABASE_CONNECTION_NAME=Username-Password-Authentication
NUXT_AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET=replace-with-generated-account-link-secret
NUXT_FIRST_PLATFORM_ADMIN_EMAIL=
NUXT_DATABASE_BINDING=DB
NUXT_PROFILE_ICONS_BINDING=PROFILE_ICONS
NUXT_EVENT_IMAGES_BINDING=EVENT_IMAGES
NUXT_MCP_ALLOWED_HOSTNAMES=localhost
NUXT_MCP_ALLOWED_ORIGIN_HOSTNAMES=localhost
NUXT_MCP_RESOURCE_URL=http://localhost:3000/mcp
NUXT_OUTBOUND_EMAIL_BINDING=EMAIL
NUXT_OUTBOUND_EMAIL_FROM_EMAIL=info@your-platform.example
NUXT_OUTBOUND_EMAIL_FROM_NAME=Codex Events
NUXT_OUTBOUND_EMAIL_REPLY_TO=
NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_BINDING=APPLICATION_REVIEW_EMAIL_QUEUE
NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_NAME=codex-events-dev-application-review-email-delivery
NUXT_APPLICATION_REVIEW_EMAILS_RETRY_DELAY_SECONDS=120
NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_BINDING=TALK_PROPOSAL_DECISION_EMAIL_QUEUE
NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_NAME=codex-events-dev-talk-proposal-decision-email-delivery
NUXT_TALK_PROPOSAL_DECISION_EMAILS_RETRY_DELAY_SECONDS=120
NUXT_EVENT_OUTCOME_EMAILS_QUEUE_BINDING=EVENT_OUTCOME_EMAIL_QUEUE
NUXT_EVENT_OUTCOME_EMAILS_QUEUE_NAME=codex-events-dev-event-outcome-email-delivery
NUXT_EVENT_OUTCOME_EMAILS_RETRY_DELAY_SECONDS=120
NUXT_LUMA_API_BASE_URL=https://public-api.luma.com
NUXT_LUMA_PROFILE_BASE_URL=https://luma.com
NUXT_LUMA_QUEUE_BINDING=APPLICATION_LUMA_SYNC_QUEUE
NUXT_LUMA_QUEUE_NAME=codex-events-dev-application-luma-sync
NUXT_LUMA_RETRY_DELAY_SECONDS=120
NUXT_MEDIA_CLEANUP_QUEUE_BINDING=MEDIA_CLEANUP_QUEUE
NUXT_MEDIA_CLEANUP_QUEUE_NAME=codex-events-dev-media-cleanup
NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS=120
```

Generate local-only Auth0 secret values with Bun:

```bash
bun -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(64).toString('hex'))"
bun -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('hex'))"
```

Local Auth0 dashboard settings:

- Allowed Callback URLs: `http://localhost:3000/auth/callback, http://localhost:3000/auth/link/callback`
- Allowed Logout URLs: `http://localhost:3000`
- If you enable Google social login, create an Auth0 Google connection and configure the Google OAuth Web application's authorized redirect URI as `https://<your-auth0-domain>/login/callback`. Set `AUTH0_GOOGLE_CONNECTION_NAME` to that connection's Auth0 name when running the bootstrap.

Local Auth0 runtime notes:

- `NUXT_AUTH0_DOMAIN` is the Auth0 issuer host, not the app host. For deployed environments, use the Auth0 custom domain or tenant domain for that deployment, not the application hostname.
- `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET` belong to a Machine-to-Machine application authorized for the Auth0 Management API `update:users` scope. The local app uses them together with `AUTH0_MANAGEMENT_DOMAIN` to send another confirmation email during account registration. The Management API only answers on the canonical tenant domain, so keep `AUTH0_MANAGEMENT_DOMAIN` set to `your-tenant.eu.auth0.com` even when `NUXT_AUTH0_DOMAIN` is an Auth0 custom domain.
- When `NUXT_AUTH0_APP_BASE_URL=http://localhost:3000`, the app intentionally uses a non-secure Auth0 session cookie for local development so Safari can persist the login callback session on `localhost`. HTTPS environments continue to use secure cookies.

Auth0 bootstrap automation:

- `bun tools/auth0/auth0-bootstrap.ts apply`
- `bun tools/auth0/auth0-bootstrap.ts check`

These commands enforce required Auth0 tenant configuration:

- custom domain readiness and default assignment
- Auth0 application display name plus Universal Login branding sync (primary color, page background, wordmark, favicon)
- Universal Login page template sync for canonical login-link styling
- login prompt subtitle copy
- signup prompt consent text/partials cleared so platform consent stays app-owned at `/account/register`
- post-login Action deployment and trigger binding for consent claims and Auth0 account linking
- a default third-party user grant for the MCP API permission without post-login scope mutation
- administrator-approved CIMD-only registration for standards-compliant MCP clients
- administrator-managed import of configured trusted HTTPS Client ID Metadata Document URLs
- optional promotion of the configured Google social connection to a domain-level connection for the web application and strict third-party MCP OAuth clients
- required callback/logout/origin URL inclusion on the Auth0 application
- default login URI (`initiate_login_uri`) for password-reset return routing
- tenant default redirection URI fallback (`default_redirection_uri`) for reset-password error states
- required callback inclusion for the account-linking ownership check at `/auth/link/callback`

The checked-in bootstrap does not create a Google connection or handle its provider credentials. Create the connection in Auth0 first; when `AUTH0_GOOGLE_CONNECTION_NAME` is set, the bootstrap verifies that it uses the `google-oauth2` strategy and makes it domain-level without reading or replacing its credential options.
If a tenant lacks the paid Universal Login page-template feature, the bootstrap now warns and skips page-template-dependent login prompt customization instead of failing outright. Custom domains, branding, client URLs, and Actions remain required and still fail on drift or API errors.

The script reads explicit tenant automation variables: `AUTH0_MANAGEMENT_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`, `NUXT_AUTH0_CLIENT_ID`, `AUTH0_APP_BASE_URL`, and `AUTH0_MCP_CLIENT_METADATA_URLS` are required. The metadata setting accepts comma- or whitespace-separated trusted HTTPS Client ID Metadata Document URLs and is reconciled through Auth0's idempotent CIMD import endpoint. `AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET` defaults to the same generated value as `NUXT_AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET` when it is omitted. `AUTH0_CUSTOM_DOMAIN` defaults to `auth.<AUTH0_APP_BASE_URL host>` when `AUTH0_APP_BASE_URL` is HTTPS. `AUTH0_DATABASE_CONNECTION_NAME` defaults to `Username-Password-Authentication`. `AUTH0_GOOGLE_CONNECTION_NAME` is optional and names an existing Auth0 Google connection to expose to both the app and third-party MCP clients.
`AUTH0_LOGIN_URI` is mandatory whenever `AUTH0_APP_BASE_URL` is not HTTPS, and must always be an HTTPS URL.
When `AUTH0_APP_BASE_URL` is HTTPS and explicit branding URLs are omitted, the bootstrap defaults to `${AUTH0_APP_BASE_URL}/auth0/codex-events-wordmark.svg` for the Auth0 wordmark and `${AUTH0_APP_BASE_URL}/favicon.ico` for the favicon.

For app runtime variables, rename legacy `NUXT_PUBLIC_AUTH0_*` keys to the `NUXT_AUTH0_*` keys above. Use `AUTH0_*` for tenant automation and GitHub environment-level Auth0 settings; deployment maps `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET` into Worker runtime secrets for confirmation-email resend.

Local first-platform-admin bootstrap command:

- `bun tools/platform-admin/bootstrap.ts check --email your-admin@example.com`
- `bun tools/platform-admin/bootstrap.ts apply --email your-admin@example.com`

This operator command uses the local Wrangler D1 platform proxy, promotes the target user to platform admin in application data, backfills required event-admin inheritance rows for existing events, and writes an audit-log record when changes are applied.
For deployed environments, set `NUXT_FIRST_PLATFORM_ADMIN_EMAIL` instead. When the matching platform account exists and no active platform admins exist, the app grants platform-admin access through the same audited domain path.

Local platform legal bootstrap command:

- `bun tools/platform-legal/bootstrap.ts check --config ./legal/platform-legal.json`
- `bun tools/platform-legal/bootstrap.ts apply --config ./legal/platform-legal.json`

This operator command uses the local Wrangler D1 platform proxy to upsert deployment-owned legal settings and create the first `privacy_policy` and `platform_terms` document versions when they do not exist. It does not overwrite existing platform document versions; publish new document versions from `/account/platform-legal` when legal text changes after launch.

Example `platform-legal.json`:

```json
{
  "supportEmail": "support@example.com",
  "imprintContent": "## Operator\n\nYour Organization\nStreet Address, City, Country\n\n## Contact\n\n- Support, legal, and privacy contact: support@example.com\n- Languages accepted for legal and DSA communications: English\n\n## Platform purpose\n\nOperate event programs and participant workflows.\n\n## Editorial focus\n\nInformation about events operated on this platform.\n\n## Legal notice\n\nYour jurisdiction-specific imprint disclosures.",
  "documents": {
    "privacy_policy": {
      "title": "Privacy Policy",
      "content": "Your current Privacy Policy content."
    },
    "platform_terms": {
      "title": "Platform Terms",
      "content": "Your current Platform Terms content."
    }
  }
}
```

Shared backend foundation work also expects a D1 binding name at runtime:

- `NUXT_DATABASE_BINDING` should match the D1 binding exposed to the server runtime. The canonical foundation defaults to `DB`.
- local development uses the repository `wrangler.jsonc` plus Wrangler's `getPlatformProxy()` to provide a Cloudflare-native local `DB` binding while the Nuxt server runs under Bun

Profile icon uploads use a Cloudflare R2 binding at runtime:

- `NUXT_PROFILE_ICONS_BINDING` should match the R2 binding used for account profile icons. The canonical default is `PROFILE_ICONS`.
- local development uses the repository `wrangler.jsonc` R2 bucket binding for profile icon object storage.

Event background and banner uploads use a dedicated Cloudflare R2 binding at runtime:

- `NUXT_EVENT_IMAGES_BINDING` should match the R2 binding used for event background and banner image objects. The canonical default is `EVENT_IMAGES`.
- local development uses the repository `wrangler.jsonc` R2 bucket binding for event image object storage.

Protected event photo previews use a Cloudflare Images binding at runtime:

- `wrangler.jsonc` binds the Worker `IMAGES` binding for protected gallery preview transformations.
- local development uses the same `IMAGES` binding through Wrangler's local platform proxy.

Outbound email delivery uses Cloudflare Email Service through the Worker `send_email` binding:

- `NUXT_OUTBOUND_EMAIL_BINDING` should match the `send_email` binding name in `wrangler.jsonc`.
- `NUXT_OUTBOUND_EMAIL_FROM_EMAIL` must be a sender address on an Email Service onboarded domain and must be allowed by the binding's `allowed_sender_addresses`.
- `NUXT_OUTBOUND_EMAIL_FROM_NAME` controls the sender display name.
- `NUXT_OUTBOUND_EMAIL_REPLY_TO` optionally controls the reply destination for participant-facing notifications. When it is empty, replies go to `NUXT_OUTBOUND_EMAIL_FROM_EMAIL`.
- The sending domain must use Cloudflare DNS and be onboarded in Cloudflare Email Service before deployed email delivery works. Email Sending requires a Workers Paid plan.

Application decision emails, Talk proposal decisions, event outcome emails, optional Luma guest-status sync, and delayed managed-media cleanup use Cloudflare Queues at runtime:

- `NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_BINDING` and `NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_NAME` should match the producer and consumer queue configuration for participant decision emails.
- `NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_BINDING` and `NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_NAME` should match the producer and consumer queue configuration for private Talk proposal decision emails.
- `NUXT_EVENT_OUTCOME_EMAILS_QUEUE_BINDING` and `NUXT_EVENT_OUTCOME_EMAILS_QUEUE_NAME` should match the producer and consumer queue configuration for shortlist and winner emails.
- `NUXT_LUMA_QUEUE_BINDING` and `NUXT_LUMA_QUEUE_NAME` should match the producer and consumer queue configuration for Luma sync jobs.
- `NUXT_MEDIA_CLEANUP_QUEUE_BINDING` and `NUXT_MEDIA_CLEANUP_QUEUE_NAME` should match the producer and consumer queue configuration for delayed managed-media cleanup. Producer delay is fixed at 30 seconds; `NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS` controls consumer retries.
- Luma API keys, webhook IDs, and webhook signing secrets are stored per event after an event admin saves the Luma event API ID and API key in event settings.

## Local Development

Start the development server:

```bash
bun run dev
```

To verify the Meetup Call for talks locally, create a Meetup with an enabled
proposal window, open registration, submit an application as a participant,
and use the account event workspace's **Call for talks** tab. The focused
domain/API coverage is in `tests/unit/server/domains/talk-proposals/` and
`tests/integration/server/api/talk-proposal-routes.test.ts`; the browser flow is
in `tests/bdd/features/authenticated/talk-proposals.feature`. Run the standard
unit and integration suites, then `bun run test:bdd` for the local personas and
isolated D1 fixture. Local Queue delivery uses the producer binding from
`wrangler.jsonc`; inspect identifiers and delivery outcomes only, never the
proposal body. Talk decision enqueue failures remain durable in D1 and are
retried by bounded startup recovery plus the five-minute scheduled reconciler.
The focused queue tests exercise producer failure, duplicate and concurrent
delivery, active and expired claims, retryable provider outcomes, and the
at-least-once crash-recovery boundary.

### Local MCP client testing

The local endpoint uses the stateless `agents@0.33.0` handler with
`@modelcontextprotocol/server@2.4.0` and MCP 2026-07-28.

Auth0 OAuth is the recommended remote-client flow. The local deterministic
environment does not run an authorization server, so use the deployed test
environment to verify browser authorization with Codex. The protected-resource
metadata remains locally testable at
`http://localhost:3000/.well-known/oauth-protected-resource` when Auth0 runtime
configuration is present.

For local protocol work, sign in and create a manual token from **Account
settings → MCP connections**. Copy the full credential when it is shown; only
a safe prefix remains visible after selecting **Done**. Use
`http://localhost:3000/mcp` as the Streamable HTTP endpoint and send the
credential as `Authorization: Bearer <token>`. Do not put credentials in a URL,
source file, shell history, screenshot, or test fixture.

Discovery returns at most eight read/upsert macro tools. Each macro's `action`
enum is filtered for the current actor. Call a macro with only `action` to read
the exact field schema, or add `input` to execute it. The server validates that
input against the selected shared operation before running its existing guards
and business logic.

The local Agent Plugins v1 package is rooted at
`agent-plugin/codex-events/`. Its root `plugin.json`, `mcp.json`, and
`skills/` directory are the portable package; it intentionally has no legacy
`.codex-plugin/` directory. The checked-in `mcp.json` points only to
`http://localhost:3000/mcp` and contains no credential. Load that directory as
a local plugin after starting `bun run dev`, and configure any manual token in
the client. Refresh the local plugin connection after changing tool descriptors
or MCP Apps metadata.

Use MCP Inspector against the deployed test endpoint for the protocol and OAuth
baseline. Configure `https://test.codex-events.com/mcp` as Streamable HTTP and
complete its OAuth flow with its administrator-registered CIMD client and use
Authorization Code with PKCE. Verify discovery, token issuance for the exact
resource, the role-filtered tool list, and one read-only call. Open the web UI
with the same hostname used by its registered callback: `http://localhost:6274`
uses `http://localhost:6274/oauth/callback`, while `http://127.0.0.1:6274` is a
different redirect URI and requires a separate registration. Its CLI/TUI
callback defaults to `http://127.0.0.1:6276/oauth/callback`.

```bash
bunx @modelcontextprotocol/inspector --web
```

Repeat Inspector protocol checks with a manual bearer credential when changing
the secondary authentication path. Revoke that token in account settings and
confirm the next request is rejected.

For Codex against the test deployment, add the Streamable HTTP MCP URL without
a manual bearer token. Codex opens Authorization Code with PKCE and returns to
the server-specific local callback it derives from its configured callback
base. Register that exact derived redirect in the client's CIMD document and
have the document URL administrator-registered in Auth0. Verify the exact MCP audience, the
signed subject and client identity, `tools/list`, and one read-only call. Do not
expect strict third-party Auth0 access tokens to contain OIDC scopes or support
`/userinfo`.

For a ChatGPT hosted connector, use the MCP-specific CIMD URL and the HTTPS
`https://chatgpt.com/connector/oauth/{callback_id}` redirect shown in ChatGPT.
Add that metadata URL to test `AUTH0_MCP_CLIENT_METADATA_URLS`, deploy test so
Auth0 imports it, and verify the hosted flow separately. Never reuse the
ChatGPT client identity for a Codex or Inspector loopback test. The repository
stores neither OAuth credentials nor a permanent development token.

When a shared structured operation changes its serialized response, run
`bun run mcp:generate-output-schemas`. The generator derives the exact MCP
output contract from every shared executor; the registry unit test fails when
the checked-in schemas are stale.

When the independently maintained MCP eligibility manifest changes, run
`bun run mcp:generate-operation-catalog`. The generated loader catalog contains
only manifest entries explicitly marked for inclusion; tests compare the
manifest with every concrete API route and reject missing catalog bindings.

The interface layer uses `shadcn-vue` primitives plus Tailwind CSS.
Generated `shadcn-vue` primitives live under `app/components/ui/`.
Project-owned shared interface components live under `app/components/`.

Before adding an interface component, search the existing component tree for
the closest visual or behavioral analog. Use root `App*` wrappers for
application-level controls and surfaces instead of copying generated
`shadcn-vue` primitives into feature work. Reuse or extend domain/shared
components under `app/components/admin`, `app/components/events`,
`app/components/public/events`, `app/components/account`,
`app/components/applications`, `app/components/judging`,
`app/components/shell`, and `app/components/teams` before creating new panels,
rows, cards, forms, or status displays. New component files should note the
closest existing analog in the task or implementation notes and explain why
props, slots, composition, or a focused extension are not sufficient.

The built-in Auth0 Nuxt routes are mounted at:

- `/auth/login`
- `/auth/logout`
- `/auth/callback`
- `/auth/backchannel-logout`

The protected example surface added in this repo is `/dashboard`.

## Remote Deployments

Operator-facing deployment — the GitHub `production` and `test` environments, their variables and secrets, the Cloudflare API token scopes, and first-run setup — lives in [`OPERATOR.md`](OPERATOR.md). This section covers only how the deploy tooling is wired in this repository.

The tracked `wrangler.jsonc` is local/adopter-safe and contains no remote Cloudflare environments. Remote test and production deployments generate ignored Wrangler config files under `.wrangler/generated/` from the environment values documented in `OPERATOR.md`:

```bash
bun tools/deploy/generate-wrangler-config.ts test
bun tools/deploy/generate-wrangler-config.ts production
```

Those generated files drive the deploy scripts:

- `bun run db:migrate:test` / `bun run db:migrate:production`
- `bun run deploy:test` / `bun run deploy:production`

For the selected target, the generator resolves the application URL, Cloudflare route pattern, and resource names from `BASE_DOMAIN`, `ENV_NAME`, and `RESOURCE_PREFIX`, copies the app runtime variables into the generated Wrangler `vars` block, and fails fast when a required deploy value is missing. It never derives a hostname from an environment name, so each environment supplies its own `BASE_DOMAIN`. Remote configuration also requires exactly one `CF_D1_JURISDICTION` or `CF_D1_PRIMARY_LOCATION_HINT`; the ensure step validates existing D1 placement before the generated config is used. The deploy workflow resolves the D1 database and R2 buckets first (creating them when missing), then generates the config with the resolved D1 UUID and bucket names. The resolved names and their overrides are listed in [OPERATOR.md → How resources are named](OPERATOR.md#how-resources-are-named), and the placement/replacement contract is in [docs/d1-placement-and-replacement.md](docs/d1-placement-and-replacement.md).

Two repo-specific details matter when maintaining this tooling:

- **Cloudflare public caching uses a split entrypoint wrapper.** The generated
  deployment config points Wrangler at
  `tools/deploy/cloudflare-worker-entrypoint.mjs`, which keeps the Nitro
  gateway uncached and exposes the named `PublicCache` entrypoint only through
  `ctx.exports`; generated configs explicitly enable the required
  `enable_ctx_exports` compatibility flag. Do not deploy
  `.output/server/index.mjs` directly or enable cache on the default gateway.
  The tracked `wrangler.jsonc` remains local and cache-disabled.

- **Queue consumers are reconciled separately from `wrangler deploy`.** The generated config binds Queue producers only. Remote workflows deploy the Worker first, then reconcile consumers by deleting existing consumers from each environment-owned queue through the Cloudflare Queues API and re-adding the Worker with the desired batch and retry settings. Cloudflare keeps an inactive Worker consumer in the single-consumer slot until it is removed, so consumer attachment is intentionally separate from deploy.
- **Cloudflare credentials use Wrangler's supported names.** Deploy scripts and workflows keep `CF_*` as the project configuration surface, then map them to `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` when Wrangler runs, avoiding Wrangler's deprecated `CF_ACCOUNT_ID`/`CF_API_TOKEN` aliases without storing credentials under two names.

The manual deploy commands and the required token scopes are in [OPERATOR.md → Manual deployment](OPERATOR.md#manual-deployment) and [OPERATOR.md → Cloudflare API token](OPERATOR.md#cloudflare-api-token).

## GitHub Deployments

Pushes to `main` publish the test environment through `.github/workflows/deploy-test.yml` after the fast checks pass. Production publishes from GitHub Releases through `.github/workflows/deploy-production.yml`. Push-based test deployment is optional: if the `test` environment has no `BASE_DOMAIN`, the deploy job exits cleanly before reading the rest of the deployment metadata, so forks and unconfigured environments run CI only.

The `test` and `production` GitHub environment variables and secrets, the Cloudflare API token scopes, the Auth0 Management API scopes, and the first-release Auth0 custom-domain and DNS-verification behavior are all documented in [`OPERATOR.md`](OPERATOR.md) — see [section 4 (GitHub)](OPERATOR.md#4-github), [section 5 (Release and first start)](OPERATOR.md#5-release-and-first-start), and [section 6 (Advanced settings)](OPERATOR.md#6-advanced-settings).

### BDD test environment

The scheduled and manually dispatched BDD workflow is self-contained. It uses
fixed local personas and an isolated D1 database, so it needs no GitHub
environment, Auth0 tenant, persona credentials, or authentication secrets.

## Validation

Run the standard project checks with:

```bash
bun run lint
bun run typecheck
bun run test:all
```

Run individual test layers with:

```bash
bun run test:unit
bun run test:integration
bun run test:bdd
```

GitHub Actions does not run `bun run test:bdd` on every `push` or `pull_request`. The default CI workflow runs the fast gate (`lint`, `typecheck`, `test:unit`, `test:integration`), while the BDD suite runs only through manual `workflow_dispatch` invocations and the nightly scheduled workflow run.

Run the local full-lifecycle 1000-participant D1 validation with:

```bash
bun tools/load-tests/local-1000-participant-event.ts
```

The runner uses fixed local persona sessions on `http://localhost:3100`, stores isolated local D1 state under `.wrangler/state-load-1000`, keeps registration and submission open for 10 real minutes each, and writes ignored JSON/Markdown reports under `.wrangler/load-test-reports/`. It does not need Auth0 or Codex sign-in. Use `--smoke` for a shorter 40-participant rehearsal.

For a 10000-participant performance run, use a separate local D1 state root and enable repeated API probes plus Lighthouse:

```bash
bun tools/load-tests/local-1000-participant-event.ts \
  --participant-count 10000 \
  --state-root .wrangler/state-load-10000 \
  --perf-samples 3 \
  --perf-concurrency 2 \
  --lighthouse
```

The performance report includes per-endpoint timing percentiles, response sizes, failure counts, Chrome navigation metrics for the admin operations and public completed event pages, optional Lighthouse scores for the public completed page, and Nuxt dev-server process snapshots. Use `--perf-samples 0` to skip repeated probes and `--no-browser-metrics` to skip Chrome navigation metrics.

Generate the current Drizzle migration from the canonical schema with:

```bash
bun run db:generate
```

Refresh the generated third-party notices asset after runtime dependency changes with:

```bash
bun run notices:generate
```

## End-to-End Tests

The repository uses `Playwright` with `playwright-bdd`, so end-to-end coverage is authored as Gherkin feature files plus step definitions and generated into Playwright tests before execution. Authenticated coverage uses four fixed local personas and requires no environment setup.

For platform fixture reset and authenticated browser coverage, the repository uses the local D1 binding declared in `wrangler.jsonc`. The bootstrap flow clears persisted local D1 data before recreating schema and fixtures through Cloudflare's local D1 runtime.

The repository now treats D1 targets as four distinct environments:

- local app development D1
- local BDD D1
- remote test D1
- remote production D1

Install the Playwright browser for local runs:

```bash
bun run test:bdd:install
```

Run the generated end-to-end suite:

```bash
bun run test:bdd
```

This is the canonical local BDD command. It seeds four stable local personas, resets the persisted local Cloudflare D1 state, writes their local session cookies, regenerates the Playwright output, and runs all public, authenticated, and authenticated-destructive BDD scenarios.

BDD source files live under `tests/bdd/`: feature files in `tests/bdd/features`, matching step definitions in `tests/bdd/steps`, and authenticated bootstrap support in `tests/bdd/bootstrap.ts` plus `tests/bdd/support`. Generated files are written under `.features-gen/` and should not be edited by hand.

By default, local app development uses `.wrangler/state` and authenticated BDD uses `.wrangler/state-bdd`. You can override them independently with `LOCAL_DEV_D1_STATE_ROOT` and `LOCAL_BDD_D1_STATE_ROOT`. BDD does not honor a generic `LOCAL_D1_STATE_ROOT` override that points anywhere else, and it fails fast if the BDD root matches the normal local app root.

By default, the BDD suite runs the local app on `http://localhost:3100`. Override that origin with `BDD_BASE_URL` when you need a different dedicated test port.

Examples:

```bash
LOCAL_BDD_D1_STATE_ROOT=.wrangler/state-bdd-alt bun run test:bdd
BDD_BASE_URL=http://localhost:3200 bun run test:bdd
LOCAL_DEV_D1_STATE_ROOT=.wrangler/state-dev-alt bun run dev
LOCAL_BDD_D1_STATE_ROOT=.wrangler/state-bdd-alt bun tests/bdd/bootstrap.ts
```

The bootstrap flow clears the selected persisted local Cloudflare state, reapplies migrations, reseeds the fixture dataset, clears `tests/bdd/.auth/`, and writes fresh storage-state artifacts containing the existing local-development email cookie.

The four personas are `platform_admin`, `event_admin`, `judge`, and `regular_user`. Their identity subjects are fixed in source, while platform and event permissions come only from the seeded D1 rows. Reusable session-state artifacts are written under `tests/bdd/.auth/`; these local files are gitignored.

The authenticated BDD suite now covers the backend workflow surface delivered by `TASK-3.5` through `TASK-3.9` and the Milestone 1 UI flows delivered by `TASK-4.*`, including actor/session reads, public discovery, admin configuration, application and team formation, submissions, judging, shortlist and winners, prize redemption, audit access, and destructive account deletion.

Keep `.github/workflows/deploy-test.yml`, this document, and `docs/testing-strategy.md` aligned when the required validation surfaces change.
