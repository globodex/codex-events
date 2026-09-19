# Operator Guide

Codex Events is a self-hosted event platform. This guide takes you from empty Cloudflare, Auth0, and GitHub accounts to a running production deployment, then through first-run setup.

## 1. Introduction

### How it fits together

Three systems, three jobs:

- **Cloudflare** hosts and runs the platform on Cloudflare Workers, with Cloudflare D1, Cloudflare R2, Cloudflare Queues, and Cloudflare Email Service.
- **Auth0** handles login and identity.
- **GitHub Actions** is the deployer. You store your Cloudflare and Auth0 credentials in a GitHub environment, and a workflow builds everything from them.

So most of your work is: **collect credentials** from Cloudflare (section 2) and Auth0 (section 3), **store them in GitHub** (section 4), then **trigger a deploy** (section 5):

- **Production** deploys when you publish a **GitHub Release** (the `deploy-production` workflow).
- **Test** is optional — a separate environment to preview code changes without affecting production. It deploys on every push to `main` once a `test` GitHub environment exists; see [section 6](#6-advanced-settings).

The deploy workflow creates anything that is missing — Cloudflare resources, Auth0 configuration, DNS records — and reconciles it on every run. You do not configure callback URLs, DNS records, or resource names by hand.

### Prerequisites

You need:

- a GitHub repository that can run GitHub Actions (you can just fork this repo);
- a Cloudflare account. The Workers Free plan can host the app for a small event (around 50 participants), but sending the platform's participant emails (application decisions, outcomes, and winner notices) requires the **Workers Paid plan** ($5/month), so choose the Paid plan for any real event;
- a domain managed by Cloudflare DNS (it can be registered elsewhere);
- Cloudflare access to Workers, D1, R2, Images, Queues, Cron Triggers, DNS, and Email Service;
- an Auth0 account. The free plan is enough for the application flow, but Auth0 may require billing verification before it creates a custom domain.

### Hostnames

Each environment has its own app hostname; the Auth0 login screen defaults to that hostname prefixed with `auth.`. The test rows apply only if you enable the optional [test environment](#6-advanced-settings).

| Purpose                     | Example                        |
|-----------------------------|--------------------------------|
| Production app              | `events.example.com`           |
| Auth0 login                 | `auth.events.example.com`      |
| Test app (optional)         | `test.events.example.com`      |
| Test Auth0 login (optional) | `auth.test.events.example.com` |

## 2. Cloudflare

In the Cloudflare account that will host the platform:

1. Add the domain to Cloudflare DNS and wait until the zone is active.
2. Onboard the sending domain to Cloudflare Email Service (**Email Service → Onboard Domain** in the dashboard); Cloudflare adds the required SPF, DKIM, and DMARC records for you. Once the domain is verified you can send from any address on it — you don't configure individual sender addresses.

You do not set up the D1 database, R2 buckets, or Queues yourself — the deploy workflow creates them when they do not already exist. The Cloudflare API token is created later, in the GitHub step (section 4), where it is pasted straight in.

D1 provisioning requires exactly one explicit placement variable in each GitHub
environment: `CF_D1_JURISDICTION` or `CF_D1_PRIMARY_LOCATION_HINT`. The workflow
inspects an existing database and stops with replacement guidance when its
observed placement does not match. It never deletes or silently replaces an
existing database. See [D1 placement and recoverable replacement](docs/d1-placement-and-replacement.md)
for the contract, the test/production EU settings, and the non-destructive test
replacement procedure.

### D1 read replication

The checked-in Wrangler configuration declares the D1 binding only. After the deployment workflow creates each environment's D1 database, enable read replication separately in the database's Cloudflare dashboard under **Settings → Enable Read Replication**. Repeat this for production and the optional test database when both environments are used.

The Worker uses D1 Sessions and carries the latest session position in the `X-D1-Bookmark` HTTP header. Read replication is therefore an operator-controlled database setting, not a Worker binding or migration setting; do not add a read-replication field to `wrangler.jsonc` or the generated deployment configuration. Cloudflare documents the dashboard and API enablement paths in [Global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

## 3. Auth0

Auth0 has two hostnames that are easy to confuse:

- **Tenant domain** (e.g. `your-tenant.eu.auth0.com`) — the tenant's own hostname, used for management automation.
- **Login domain** (e.g. `auth.events.example.com`) — the branded hostname users see when they log in: your app hostname prefixed with `auth.` by default. The deploy workflow provisions this custom domain, writes the Cloudflare DNS verification record (DNS-only, not proxied), and waits for Auth0 to verify it.

### 3.1 Tenant

Create or choose an Auth0 tenant for production.

> **Each environment needs its own Auth0 tenant.** Production and the optional [test environment](#6-advanced-settings) **cannot share one tenant** on Auth0's free or standard plans: each needs its own custom login domain, but those plans allow only **one custom domain per tenant** (multiple custom domains is Enterprise-only). Putting two apps in one tenant does not get around this — the login domain, Universal Login branding, and post-login Action are all tenant-level, so the environments would clobber each other on every deploy and share one user pool. Create a separate tenant for test.

### 3.2 Application

Create or choose a **Regular Web Application** for Codex Events. (The Auth0-created default application is usually a Regular Web Application and you can use it if you are comfortable dedicating it to this platform.)

Auth0 usually creates a database connection named `Username-Password-Authentication` and enables it by default; just confirm it's enabled for this application.

To offer Google sign-in, create a Google OAuth 2.0 Web application in Google Cloud and add the Auth0 login-domain callback URL as an authorized redirect URI:

```text
https://auth.<BASE_DOMAIN>/login/callback
```

Use the explicit `AUTH0_CUSTOM_DOMAIN` instead of `auth.<BASE_DOMAIN>` when configured. Create the Google social connection in Auth0, store the Google client ID and secret there, and set `AUTH0_GOOGLE_CONNECTION_NAME` to its Auth0 connection name (normally `google-oauth2`). Do the same for an optional GitHub social connection with `AUTH0_GITHUB_CONNECTION_NAME` (normally `github`). The deploy workflow verifies each connection strategy and makes the existing connection domain-level, so it is available to the Codex Events application and strict third-party MCP OAuth clients. The automation never reads or replaces the social provider credentials.

The deploy workflow configures the application's callback URLs, logout URLs, web origins, login URI, Universal Login branding, signup prompt behavior, and post-login Action — you do not set these by hand.

### 3.3 Management access

Create a **Machine-to-Machine** application authorized for the Auth0 Management API. The deploy workflow uses it to apply the configuration above and uploads the credentials to the Cloudflare Worker so authenticated users can request another confirmation email during account registration.

Grant these Management API scopes:

- `read:clients`
- `create:clients`
- `update:clients`
- `read:resource_servers`
- `create:resource_servers`
- `update:resource_servers`
- `read:client_grants`
- `create:client_grants`
- `update:client_grants`
- `read:connections`
- `update:connections`
- `read:tenant_settings`
- `update:tenant_settings`
- `read:branding`
- `update:branding`
- `delete:branding`
- `read:prompts`
- `update:prompts`
- `read:custom_domains`
- `create:custom_domains`
- `update:custom_domains`
- `read:users`
- `update:users`
- `read:actions`
- `create:actions`
- `update:actions`
- `read:triggers`
- `update:triggers`

### 3.4 Account emails

Configure an email provider in each Auth0 tenant before accepting registrations. Auth0 sends account verification and password-reset emails separately from the platform's Cloudflare email queues. Its built-in email provider is for testing and is not suitable for production.

After enabling your sending domain in Cloudflare Email Service, create a dedicated account API token with only **Email Sending: Edit**. In Auth0's email-provider settings, enable **Custom SMTP** with:

| Setting | Value |
| --- | --- |
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` (TLS) |
| Username | `api_token` |
| Password | The dedicated Cloudflare API token |
| Default From | Your platform name and an address on the enabled sending domain, e.g. `Codex Events <info@events.example.com>` |

Store the token in Auth0; do not commit it or reuse the deployment token. The deployment workflow does not configure this provider. Follow the [Cloudflare SMTP setup](https://developers.cloudflare.com/email-service/api/send-emails/smtp/) and [Auth0 SMTP settings](https://auth0.com/docs/customize/email/smtp-email-providers/smtp-server). Confirm a verification email reaches a test account and check Cloudflare delivery events before opening registration.

## 4. GitHub

In GitHub, create an environment named `production`, then add the variables and secrets below. The **Where to find it** column tells you where each value comes from, so you can gather them as you fill the form.

Variable names follow a convention worth knowing:

- `NUXT_*` are the application's runtime configuration, copied into the Worker.
- `AUTH0_*` (without `NUXT_`) are used by the deploy workflow to configure Auth0. `AUTH0_MANAGEMENT_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, and `AUTH0_MGMT_CLIENT_SECRET` are also copied into Worker secrets as the runtime Auth0 Management API host and credentials for confirmation-email resend.
- `CF_*` values cover Cloudflare credentials, resource names, and DNS zone metadata. Deploy tooling and workflows pass Wrangler's supported Cloudflare credential names when Wrangler runs.

### Required variables

| Key                               | Platform   | Where to find it                                                                        |
|-----------------------------------|------------|-----------------------------------------------------------------------------------------|
| `CF_ZONE_NAME`                    | Cloudflare | Your Cloudflare DNS zone — usually the parent domain, e.g. `example.com`                |
| `CF_D1_JURISDICTION` or `CF_D1_PRIMARY_LOCATION_HINT` | Cloudflare | Set exactly one per environment; use `eu` for the repository's test and production environments, or choose a supported self-hosted placement |
| `NUXT_OUTBOUND_EMAIL_FROM_EMAIL`  | Cloudflare | Any address on the domain you onboarded to Cloudflare Email (section 2) — you choose it |
| `AUTH0_MANAGEMENT_DOMAIN`         | Auth0      | The tenant domain from section 3.1, e.g. `your-tenant.eu.auth0.com`                     |
| `BASE_DOMAIN`                     | -          | The hostname the app runs on, e.g. `events.example.com`                                 |
| `NUXT_FIRST_PLATFORM_ADMIN_EMAIL` | -          | Email of the person who will be the first platform admin                                |

Add these only when they apply:

| Key                                   | Platform | Where to find it                                                                       |
|---------------------------------------|----------|----------------------------------------------------------------------------------------|
| `AUTH0_CUSTOM_DOMAIN`                 | Auth0    | Only if your login hostname is not `auth.<BASE_DOMAIN>`, e.g. `auth.example.com`       |
| `AUTH0_GOOGLE_CONNECTION_NAME`        | Auth0    | Existing Google social connection name, normally `google-oauth2`, when Google sign-in is enabled |
| `AUTH0_GITHUB_CONNECTION_NAME`        | Auth0    | Existing GitHub social connection name, normally `github`, when GitHub sign-in is enabled |
| `NUXT_AUTH0_DATABASE_CONNECTION_NAME` | Auth0    | Only if your database connection is not named `Username-Password-Authentication`       |
| `NUXT_OUTBOUND_EMAIL_REPLY_TO`        | -        | Only if replies should go to a different address than `NUXT_OUTBOUND_EMAIL_FROM_EMAIL` |

### Required secrets

| Key                        | Platform   | Where to find it                                                                                                                        |
|----------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `CF_ACCOUNT_ID`            | Cloudflare | Cloudflare dashboard → account ID                                                                                                       |
| `CF_API_TOKEN`             | Cloudflare | Create a token with the permissions in [Cloudflare API token](#cloudflare-api-token) below — copy it immediately, it is shown only once |
| `NUXT_AUTH0_CLIENT_ID`     | Auth0      | Your Regular Web Application (section 3.2)                                                                                              |
| `NUXT_AUTH0_CLIENT_SECRET` | Auth0      | Your Regular Web Application (section 3.2)                                                                                              |
| `AUTH0_MGMT_CLIENT_ID`     | Auth0      | Your Machine-to-Machine application (section 3.3)                                                                                       |
| `AUTH0_MGMT_CLIENT_SECRET` | Auth0      | Your Machine-to-Machine application (section 3.3)                                                                                       |

The deploy workflow derives `NUXT_AUTH0_SESSION_SECRET` and `NUXT_AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET` automatically from `NUXT_AUTH0_CLIENT_SECRET`, so you do not set them here. Set explicit values only when you need controlled secret rotation (see [section 6](#optional-secrets)).

Luma API keys are entered per event by event admins. The app stores the event webhook ID and signing secret after registering the webhook with Luma.

### Cloudflare API token

Create a custom Cloudflare API token for the deploy workflow, then paste it into `CF_API_TOKEN` above. Cloudflare shows the value only once, so copy it as you create it.

Cloudflare edit access does not consistently include read access, so keep both levels where shown.

| Scope   | Resource           | Access     | Why                                                                      |
|---------|--------------------|------------|--------------------------------------------------------------------------|
| Account | Workers Scripts    | Read, Edit | Deploy the Worker and upload its secrets                                 |
| Account | D1                 | Read, Edit | Create the D1 database and run migrations                                |
| Account | Workers R2 Storage | Read, Edit | Create the R2 buckets for profile and event images                       |
| Account | Queues             | Read, Edit | Create the email and Luma queues and attach the Worker as their consumer |
| Account | Cloudflare Images  | Read, Edit | Enable the Cloudflare Images binding for protected gallery previews      |
| Zone    | Zone               | Read       | Look up the zone for the route and DNS record                            |
| Zone    | Workers Routes     | Read, Edit | Route your domain to the Worker                                          |
| Zone    | DNS                | Read, Edit | Write the Auth0 custom-domain verification record                        |

Scope the zone permissions to the DNS zone you used for `CF_ZONE_NAME`.

For resource-name overrides, sender display names, queue tuning, the test environment, or manual deploys, see [section 6](#6-advanced-settings).

## 5. Release and first start

### 5.1 Deploy production

Publish a **GitHub Release** from the commit you want to deploy. That triggers the `deploy-production` workflow, which:

1. provisions the Auth0 custom domain and its Cloudflare DNS verification record, and waits for verification;
2. creates or reuses the D1 database, R2 buckets, and Cloudflare Queues;
3. uploads the Worker secrets;
4. applies the Auth0 application, branding, URL, and Action configuration;
5. runs D1 migrations;
6. deploys the Worker and reconciles its Queue consumers.

#### Managed public-media verification

Managed event, platform-default, and public-gallery responses use a 30-second
browser and Cloudflare edge freshness window. Production verification must
confirm the response carries the documented `Cache-Control` and
`Cloudflare-CDN-Cache-Control` headers and that Cloudflare reports the expected
`CF-Cache-Status` on repeated public requests. A cache hit can bypass the
Worker; Cache API deletion is local to the executing data center and is not a
global purge. The application has no runtime purge credential.

#### Protected API edge smoke test

Run this read-only check manually after a deployment when a remote release gate
is explicitly requested. It is intentionally not part of deploy automation and
does not deploy, mutate D1/R2, or purge Cloudflare objects.

1. Use a clean client and set `EDGE_SMOKE_BASE_URL` to the deployed origin.
Obtain a short-lived authenticated session cookie in the browser, then provide
it interactively to the shell rather than committing or logging it:

   ```bash
   read -rs EDGE_SMOKE_COOKIE
   printf '\n'
   ```

2. Request `/api/session` with that cookie and capture headers and the body.
The response must carry `Cache-Control: private, no-store` and
`Cloudflare-CDN-Cache-Control: private, no-store`; it must not show
`CF-Cache-Status: HIT` or an `Age` header. Confirm the body belongs to the
authenticated test actor.

   ```bash
   curl --fail-with-body -sS -D /tmp/codex-events-auth.headers \
     -H "Cookie: ${EDGE_SMOKE_COOKIE}" \
     "${EDGE_SMOKE_BASE_URL}/api/session" \
     -o /tmp/codex-events-auth.json
   ```

3. Make the same request without a Cookie header from the clean client. It must
return the canonical unauthenticated response (HTTP 401, no `data` actor
payload) and the same two no-store directives. It must not inherit the
authenticated body, `CF-Cache-Status: HIT`, or `Age`.

   ```bash
   curl -sS -D /tmp/codex-events-unauth.headers \
     "${EDGE_SMOKE_BASE_URL}/api/session" \
     -o /tmp/codex-events-unauth.json
   ```

4. Request one operator-supplied, immutable public event or media URL twice.
Confirm both exact public 30-second directives and record `CF-Cache-Status`
for the edge behavior; the second request should provide the deployed edge
HIT evidence for the selected public response. Do not treat a public HIT as
evidence that protected APIs are safe to cache.

5. In the Cloudflare zone, inspect Cache Rules for the deployed hostname.
`/api/**` must bypass shared caching or honor the origin no-store directives;
no rule may override them or use a cache key that ignores Cookie. The Worker
configuration must keep `cache.enabled=false` in the tracked local config and
must show the generated split topology: top-level cache enabled, the default
gateway export disabled, and `exports.PublicCache.cache.enabled=true`, with
`main` pointing at the checked-in Cloudflare entrypoint wrapper and
`enable_ctx_exports` present in `compatibility_flags`. If either the deployment
topology or zone rule check is false, stop the release gate and
remediate the zone/deployment configuration before investigating latency.

The MCP rollout is additive. Migration `0071_mcp_access_tokens.sql` must finish
before the Worker serving `/mcp` is deployed; the checked-in workflow already
preserves that ordering. The Auth0 bootstrap creates the MCP resource server,
`mcp` permission, strict third-party user grant, OAuth discovery settings,
and domain-level login connection. It imports every configured trusted HTTPS
Client ID Metadata Document URL through
Auth0's idempotent CIMD registration endpoint. `/mcp`
requires a signed Auth0 token for the exact resource audience with a subject and
client identity. It does not require OIDC or custom API scopes in the token
scope claim because strict third-party clients may omit them; D1 remains
authoritative for all application authorization.
Auth0 RBAC remains disabled for this API because Codex Events evaluates
platform authorization from D1 after OAuth authentication. The generated
Wrangler configuration also installs the `MCP_RATE_LIMITER` binding at 120 requests per credential or OAuth
user/client pair per 60 seconds. Do not enable or route `/mcp` to a Worker
version that lacks those resources.
The Worker uses the stateless `agents@0.20.1` handler with
`@modelcontextprotocol/server@2.0.0` and MCP 2026-07-28.

The Meetup Call for talks rollout is additive. Migration
`0072_talk_proposals.sql` and the Talk proposal decision-email Queue must exist
before the Worker is deployed. The workflow creates the queue, applies D1
migrations, deploys the Worker producer, and then reconciles the consumer with
a 120-second retry delay and up to 10 retries. The generated Worker runs the
pending-delivery reconciler and stale application/Luma recovery from its
scheduled entrypoint every five minutes; ordinary HTTP requests do not trigger
recovery.

Monitor this queue and its durable delivery state by proposal ID, event ID,
deterministic delivery ID, decision, attempt timestamp, lease expiry, and
delivery outcome. Do not log or export proposal titles, abstracts, links,
recipient details, or decision messages. A final decision and pending delivery
remain stored when enqueue fails; scheduled reconciliation publishes the same
delivery without repeating the decision.

Cloudflare Queues delivers at least once. The consumer uses an expiring database
claim so concurrent or already completed duplicate messages do not send again,
and retryable provider failures remain eligible for reconciliation even after a
Queue message exhausts its configured retries. A Worker failure after the email
provider accepts a message but before `sent` is recorded can still cause a later
retry. Every attempt supplies the same `X-Codex-Email-Key` so providers that
support duplicate suppression can recognize it; use the deterministic delivery
ID when investigating possible duplicates.

Managed media replacement, removal, and account deletion record immutable R2
object cleanup in the same D1 mutation through the managed-media outbox. Its
sortable UTC `available_at` timestamp keeps the object private for at least 30
seconds before the scheduled Worker publishes a fixed-kind Queue message;
HTTP mutations do not wait for the Queue or fail after a successful D1 write.
The dispatcher validates supported kinds and object-key shapes, atomically
quarantines malformed outbox rows so they are not retried, and keeps producer
failures pending with attempt metadata. The consumer maps supported kinds to the
event-images or profile-icons binding, acknowledges invalid and successful
messages, retries transient R2 delete failures per message, and routes messages
that exhaust ten retries to the managed-media dead-letter queue. Migration-era
stable object keys remain valid cleanup targets. Monitor pending and quarantined
outbox rows, dispatch failures, Queue retries, and DLQ messages by cleanup kind
and object key; quarantine logs contain only safe row identifiers, kind, and
reason fields—never object contents or payloads.

If Auth0 rejects custom-domain creation because the tenant needs billing verification, add billing information in Auth0 and rerun the release workflow — it cannot finish custom-domain setup until Auth0 allows it for that tenant.

### 5.2 Create the first platform admin

Open `https://<BASE_DOMAIN>/account/platform-settings?tab=legal` and sign in with the email you set as `NUXT_FIRST_PLATFORM_ADMIN_EMAIL`.

A fresh deployment has no Privacy Policy or Platform Terms yet, so registration opens in a legal-setup state. Create the setup account there. Because no platform admin exists yet, the application grants this account platform-admin access automatically.

This account can reach the Legal settings tab right away. Everything else stays blocked until the Privacy Policy and Platform Terms are published and accepted.

### 5.3 Add platform legal content

On the Legal settings tab (you need to save each content separately):

1. Save the support email and imprint content.
2. Publish the Privacy Policy.
3. Publish the Platform Terms.
4. Accept the current Privacy Policy and Platform Terms when prompted.

The imprint should include the platform operator details, postal address, legal and privacy contacts, accepted contact languages, platform purpose, editorial focus, and any jurisdiction-specific disclosures.

### 5.4 Finish setup in the app

As the first platform admin, use the platform admin workspace to:

1. Add more platform admins.
2. Add event organizers.
3. Create the first event.
4. Configure event terms, schedule, registration, judging, prizes, and staff.

### 5.5 Verify

- `https://<BASE_DOMAIN>` loads.
- `/privacy-policy` shows your Privacy Policy.
- `/terms-and-conditions` shows your Platform Terms.
- `/imprint` shows your operator information.
- `/auth/login` opens Auth0 on `https://auth.<BASE_DOMAIN>` (or your `AUTH0_CUSTOM_DOMAIN`).
- The first platform admin can open `/account/platform-settings?tab=platform-admins`.
- The first platform admin can create an event.
- MCP Inspector discovers OAuth from `https://<BASE_DOMAIN>/mcp`, uses its
  administrator-registered CIMD client, completes browser sign-in through Auth0 with PKCE, and can list
  and call role-appropriate tools.
- ChatGPT hosted connectors and Codex local clients each complete the same
  OAuth resource flow using their own documented client identity and redirect
  URI; a hosted HTTPS callback is never substituted for a local loopback callback.
- A signed-in user can also create a manual MCP token in account settings,
  initialize a Streamable HTTP client, revoke the token, and observe that the
  next request is rejected.

## 6. Advanced settings

Everything in this section is optional for a default production deployment.

### How resources are named

Each deploy reads the values from its GitHub environment and derives:

- application URL: `https://<BASE_DOMAIN>`
- Cloudflare route pattern: `<BASE_DOMAIN>`
- resource names as `<RESOURCE_PREFIX>-<ENV_NAME>`

`ENV_NAME` defaults to `prod` for production and `test` for the test target. `RESOURCE_PREFIX` defaults to `codex-events`. Keep `CF_ZONE_NAME` explicit because the DNS zone cannot be inferred safely from a hostname.

| Target     | `ENV_NAME` | `RESOURCE_PREFIX` | Worker and D1 default  |
|------------|------------|-------------------|------------------------|
| Production | `prod`     | `codex-events`    | `codex-events-prod`    |
| Test       | `test`     | `codex-events`    | `codex-events-test`    |

Default production resource names:

| GitHub variable                     | Cloudflare resource              | Default production value                              |
|-------------------------------------|----------------------------------|-------------------------------------------------------|
| `CF_WORKER_NAME`                    | Worker                           | `codex-events-prod`                                   |
| `CF_D1_DATABASE_NAME`               | D1 database                      | `codex-events-prod`                                   |
| `CF_PROFILE_ICONS_BUCKET`           | Profile-icons R2 bucket          | `codex-events-prod-profile-icons`                     |
| `CF_EVENT_IMAGES_BUCKET`            | Event-images R2 bucket           | `codex-events-prod-event-images`                      |
| `CF_APPLICATION_REVIEW_EMAIL_QUEUE` | Application decision email queue | `codex-events-prod-application-review-email-delivery` |
| `CF_TALK_PROPOSAL_DECISION_EMAIL_QUEUE` | Talk proposal decision email queue | `codex-events-prod-talk-proposal-decision-email-delivery` |
| `CF_EVENT_OUTCOME_EMAIL_QUEUE`      | Event outcome email queue        | `codex-events-prod-event-outcome-email-delivery`      |
| `CF_LUMA_SYNC_QUEUE`                | Luma sync queue                  | `codex-events-prod-application-luma-sync`             |
| `CF_MEDIA_CLEANUP_QUEUE`            | Managed media cleanup queue      | `codex-events-prod-media-cleanup`                    |
| `CF_MEDIA_CLEANUP_DLQ_QUEUE`        | Managed media cleanup dead-letter queue | `codex-events-prod-media-cleanup-dlq`           |

### Optional variables

Set any of these in the GitHub environment to override a default.

Deployment defaults and resource names:

| Variable                            | Value                                                                                |
|-------------------------------------|--------------------------------------------------------------------------------------|
| `ENV_NAME`                          | Environment name used in generated resource names. Defaults to `prod` for production |
| `RESOURCE_PREFIX`                   | Resource-name prefix. Defaults to `codex-events`                                     |
| `CF_WORKER_NAME`                    | Worker name                                                                          |
| `CF_D1_DATABASE_NAME`               | D1 database name; created if it does not exist                                       |
| `CF_D1_JURISDICTION`                | D1 creation jurisdiction; mutually exclusive with `CF_D1_PRIMARY_LOCATION_HINT`    |
| `CF_D1_PRIMARY_LOCATION_HINT`       | D1 primary location hint; mutually exclusive with `CF_D1_JURISDICTION`              |
| `CF_PROFILE_ICONS_BUCKET`           | Profile-icons R2 bucket name; created if it does not exist                           |
| `CF_EVENT_IMAGES_BUCKET`            | Event-images R2 bucket name; created if it does not exist                            |
| `CF_APPLICATION_REVIEW_EMAIL_QUEUE` | Application decision email queue name                                                |
| `CF_TALK_PROPOSAL_DECISION_EMAIL_QUEUE` | Talk proposal decision email queue name                                           |
| `CF_EVENT_OUTCOME_EMAIL_QUEUE`      | Event outcome email queue name                                                       |
| `CF_LUMA_SYNC_QUEUE`                | Luma sync queue name                                                                 |
| `CF_MEDIA_CLEANUP_QUEUE`            | Managed media cleanup queue name                                                     |
| `CF_MEDIA_CLEANUP_DLQ_QUEUE`        | Managed media cleanup dead-letter queue name                                        |
| `NUXT_MCP_ALLOWED_HOSTNAMES`        | Comma-separated hostnames accepted by `/mcp`; defaults to `BASE_DOMAIN`              |
| `NUXT_MCP_ALLOWED_ORIGIN_HOSTNAMES` | Comma-separated Origin hostnames accepted by `/mcp`; defaults to `BASE_DOMAIN`       |
| `NUXT_MCP_RESOURCE_URL`             | Canonical OAuth resource URL; defaults to `https://<BASE_DOMAIN>/mcp`                 |

Auth0 and display:

| Variable                              | Value                                                                          |
|---------------------------------------|--------------------------------------------------------------------------------|
| `AUTH0_CUSTOM_DOMAIN`                 | Login hostname override. Defaults to `auth.<BASE_DOMAIN>`                      |
| `AUTH0_APP_DISPLAY_NAME`              | Name shown in Auth0-hosted login copy. Defaults to `Codex Events`              |
| `AUTH0_GOOGLE_CONNECTION_NAME`        | Existing Auth0 Google social connection to expose in Universal Login and MCP OAuth |
| `NUXT_AUTH0_DATABASE_CONNECTION_NAME` | Auth0 database connection name. Defaults to `Username-Password-Authentication` |
| `AUTH0_MCP_RESOURCE_IDENTIFIER`     | Auth0 MCP API identifier. Defaults to `https://<BASE_DOMAIN>/mcp`               |
| `AUTH0_MCP_SCOPE`                   | Auth0 MCP API permission. Defaults to `mcp`                                     |
| `AUTH0_MCP_CLIENT_METADATA_URLS`    | Comma- or whitespace-separated trusted HTTPS Client ID Metadata Document URLs imported into Auth0 |

Outbound email and queues:

| Variable                                             | Value                                                                                 |
|------------------------------------------------------|---------------------------------------------------------------------------------------|
| `NUXT_OUTBOUND_EMAIL_BINDING`                        | Worker Email Service binding name. Defaults to `EMAIL`                                |
| `NUXT_OUTBOUND_EMAIL_FROM_NAME`                      | Sender display name. Defaults to `Codex Events`                                       |
| `NUXT_APPLICATION_REVIEW_EMAILS_QUEUE_BINDING`       | Binding for application decision emails. Defaults to `APPLICATION_REVIEW_EMAIL_QUEUE` |
| `NUXT_APPLICATION_REVIEW_EMAILS_RETRY_DELAY_SECONDS` | Retry delay for application decision email jobs. Defaults to `120`                    |
| `NUXT_TALK_PROPOSAL_DECISION_EMAILS_QUEUE_BINDING` | Binding for Talk proposal decision emails. Defaults to `TALK_PROPOSAL_DECISION_EMAIL_QUEUE` |
| `NUXT_TALK_PROPOSAL_DECISION_EMAILS_RETRY_DELAY_SECONDS` | Retry delay for Talk proposal decision email jobs. Defaults to `120`             |
| `NUXT_EVENT_OUTCOME_EMAILS_QUEUE_BINDING`            | Binding for event outcome emails. Defaults to `EVENT_OUTCOME_EMAIL_QUEUE`             |
| `NUXT_EVENT_OUTCOME_EMAILS_RETRY_DELAY_SECONDS`      | Retry delay for event outcome email jobs. Defaults to `120`                           |
| `NUXT_LUMA_QUEUE_BINDING`                            | Binding for Luma sync jobs. Defaults to `APPLICATION_LUMA_SYNC_QUEUE`                 |
| `NUXT_LUMA_RETRY_DELAY_SECONDS`                      | Retry delay for Luma sync jobs. Defaults to `120`                                     |
| `NUXT_MEDIA_CLEANUP_QUEUE_BINDING`                   | Binding for managed-media cleanup. Defaults to `MEDIA_CLEANUP_QUEUE`                 |
| `NUXT_MEDIA_CLEANUP_RETRY_DELAY_SECONDS`             | Queue-consumer retry delay for managed-media cleanup. Defaults to `120`              |

### Optional secrets

| Secret                                     | Value                                                                                                                                                              |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `NUXT_AUTH0_SESSION_SECRET`                | Override for the generated Auth0 session secret. Defaults to a stable value derived from `NUXT_AUTH0_CLIENT_SECRET`                                                |
| `NUXT_AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET` | Override for the generated account-link challenge secret shared by the Worker and Auth0 Action. Defaults to a stable value derived from `NUXT_AUTH0_CLIENT_SECRET` |

### Test environment

Create a GitHub environment named `test` only if pushes to `main` should deploy a test instance. The `deploy-test` job runs on every push to `main` but exits cleanly when the `test` environment has no `BASE_DOMAIN`, so creating the environment is what switches test deploys on. Without it, pushes to `main` only run CI.

Use environment-specific values for the same variable and secret groups as production, with `BASE_DOMAIN` set to the test app hostname. The test job defaults `ENV_NAME` to `test`. Like production, it configures `auth.<BASE_DOMAIN>` by default, writes the DNS-only verification record, and waits for Auth0 verification; set `AUTH0_CUSTOM_DOMAIN` only when the test login hostname should differ.

Test requires its own Auth0 tenant — production and test cannot share one on the free or standard plans (see [section 3.1](#31-tenant)). Point the test environment's `AUTH0_MANAGEMENT_DOMAIN`, `NUXT_AUTH0_CLIENT_ID`, and `NUXT_AUTH0_CLIENT_SECRET` at that tenant and its application.

To enable Google in test without changing production, create the Google connection in the test Auth0 tenant, configure Google Cloud with `https://auth.<test BASE_DOMAIN>/login/callback`, and set only the test environment's `AUTH0_GOOGLE_CONNECTION_NAME` variable.

Required test variables:

| Variable                          | Value                               |
|-----------------------------------|-------------------------------------|
| `BASE_DOMAIN`                     | Test app hostname                   |
| `CF_ZONE_NAME`                    | Cloudflare DNS zone name            |
| `AUTH0_MANAGEMENT_DOMAIN`         | Test Auth0 tenant hostname          |
| `NUXT_FIRST_PLATFORM_ADMIN_EMAIL` | First platform admin email for test |
| `NUXT_OUTBOUND_EMAIL_FROM_EMAIL`  | Verified test sender address        |

Required test secrets:

| Secret                     | Value                                      |
|----------------------------|--------------------------------------------|
| `CF_ACCOUNT_ID`            | Cloudflare account ID                      |
| `CF_API_TOKEN`             | Cloudflare API token                       |
| `NUXT_AUTH0_CLIENT_ID`     | Test Auth0 application client ID           |
| `NUXT_AUTH0_CLIENT_SECRET` | Test Auth0 application client secret       |
| `AUTH0_MGMT_CLIENT_ID`     | Auth0 Management application client ID     |
| `AUTH0_MGMT_CLIENT_SECRET` | Auth0 Management application client secret |

As with production, the test job derives the session and account-link secrets from `NUXT_AUTH0_CLIENT_SECRET` when overrides are omitted.

### Manual deployment

For a manual remote deploy, export the target environment values and run:

```bash
bun run db:migrate:test
bun run deploy:test
```

or:

```bash
bun run db:migrate:production
bun run deploy:production
```

Run the migration command before the deploy command. After deployment, use MCP
Inspector to verify protected-resource discovery, CIMD, Authorization Code with
PKCE, the exact MCP audience, signed subject and client identity, `tools/list`,
and one representative call. Test configured CIMD clients
separately with their own metadata URL and declared redirect URI. ChatGPT hosted
connectors use their MCP-specific HTTPS callback; Codex and Inspector use their
documented local callbacks. Do not expect OIDC or custom API permissions in a
strict third-party token's `scope` claim. Use a non-admin test account. Also
create a fresh short-lived manual token for verification and revoke it
immediately afterward. Never reuse an operator verification token as an
application secret.

### MCP monitoring

Monitor `/mcp` request counts, latency, HTTP status, sanitized application
error codes, and `MCP_RATE_LIMITER` outcomes. Alert on sustained authentication
failures, rate-limit saturation, unexpected internal-error rates, and unusual
mutation-attempt volume. Mutation audit records may contain authentication
method, safe token ID or OAuth client reference, tool name, outcome, and
timestamp only. Worker logs, analytics, traces, support artifacts, and alerts
must not contain access or refresh tokens, authorization codes, manual bearer
credentials, credential hashes, tool arguments, request bodies, or structured
operation output.

If MCP-specific errors rise after rollout, leave the database migration in
place, revoke affected grants or manual credentials when necessary, and roll
the Worker back to the last known-good version. The manual-token table is
isolated from session login and does not need to be removed to disable the
endpoint.

## References

- Auth0 custom domains: https://auth0.com/docs/customize/custom-domains
- Cloudflare DNS proxy status: https://developers.cloudflare.com/dns/proxy-status/
- Cloudflare R2 public buckets: https://developers.cloudflare.com/r2/data-access/public-buckets/
- GitHub deployment environments: https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
