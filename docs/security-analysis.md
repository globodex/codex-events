# Security Analysis

Date: 2026-03-30
Scope: Repo-level review of the Nuxt/Cloudflare Workers application, including authentication, authorization, public and admin API surfaces, uploads, error handling, configuration, and dependency risk.

## Methodology

- Static review of the canonical docs plus the server and client code under `server/`, `app/`, and `docs/`.
- Targeted inspection of auth, authorization, account linking, team formation, submissions, judging, uploads, and public contact flows.
- Dependency review with `bun audit` and package/version inspection from `bun.lock`.

Not covered in this document:

- Live penetration testing against a deployed environment.
- Cloudflare dashboard configuration outside this repo.
- Auth0 tenant-side settings outside the automation and runtime config present in this repo.

## Executive Summary

The project has solid foundations:

- Auth0 is used for authentication instead of custom session logic.
- Authorization is centralized and generally applied consistently.
- Request validation is done with Zod.
- Database access is done through Drizzle rather than raw SQL.
- Account-linking challenges use HMAC signing and short expirations.

The main issues I found were not classic admin-bypass bugs. They were mostly privacy exposure, boundary-hardening gaps, and dependency hygiene:

| Severity | Finding |
| --- | --- |
| High | Approved participants can read other teams' member PII through the team-detail API. |
| Medium | The runtime currently ships with vulnerable `h3@1.15.6`. |
| Medium | Platform account registration trusts unverified emails. |
| Medium | Internal server errors return raw exception messages to clients. |
| Medium | Public contact and upload surfaces have no rate limiting or abuse controls. |
| Medium | Upload validation trusts client-declared MIME types and the image responses omit `nosniff`. |
| Medium | No repo-level browser security headers are configured. |

I did not find a confirmed authorization bypass in the admin, judging, submission, or prize-redemption flows during this review.

## Findings

### 1. High: Team detail exposes participant PII to any approved participant

Affected paths:

- `server/api/events/[eventId]/teams/[teamId]/index.get.ts`
- `server/domains/teams/index.ts`
- `app/components/teams/ParticipantTeamWorkspacePanel.vue`

What happens:

- `requireTeamVisibilityContext()` allows any approved participant to access team discovery while team formation is open.
- The team-detail endpoint returns full member records for the requested team.
- `serializeTeamMember()` includes email, social URLs, `chatgptEmail`, `openaiOrgId`, and `lumaUsername`.
- The participant team membership UI already renders member email addresses, so this exposure is not only theoretical.

Why this matters:

- Any approved participant can enumerate other teams and collect personally identifying or semi-sensitive profile data across the event.
- `openaiOrgId` and `chatgptEmail` are especially hard to justify in a participant-visible team directory.

Recommendation:

- Restrict team detail to active team members and event admins.
- If non-members must see a team page, return a redacted shape for non-members.
- Remove `chatgptEmail`, `openaiOrgId`, `lumaUsername`, and member email from participant-visible team APIs unless the product explicitly requires them.

### 2. Medium: The runtime currently includes vulnerable `h3`

Evidence:

- `bun audit` reports advisories for `h3 <1.15.9`.
- `bun.lock` currently resolves `h3@1.15.6`.

Advisories flagged by the audit:

- SSE event injection via carriage returns.
- Double-decoding path traversal bypass in `serveStatic`.

Why this matters:

- `h3` is a production runtime dependency through Nuxt/Nitro, not just a dev-only tool.
- This repo does not appear to use SSE directly, so the SSE issue may not be reachable here.
- The path traversal advisory is more relevant because the application is built on Nitro's runtime and static asset serving path.

Recommendation:

- Upgrade to a Nuxt/Nitro stack that pulls in a patched `h3`.
- Re-run `bun audit` after the upgrade and confirm `h3 >= 1.15.9`.

### 3. Platform account registration requires `email_verified`

Affected paths:

- `server/domains/accounts/index.ts`
- `tests/integration/server/api/actor-platform-routes.test.ts`

Current control:

- Registration requires that an Auth0 identity exposes an email address.
- Registration requires Auth0 to confirm the signed-in email address before creating a platform user, linked identity, platform-document acceptance, or account-registration audit entry. A session with a stale or missing verification claim can proceed once an Auth0 lookup verifies the same subject and email.
- Auth0 account linking requires its own verified identity and fresh sign-in to the existing account.

### 4. Medium: Internal exceptions are returned to clients verbatim

Affected path:

- `server/utils/api-error.ts`

What happens:

- `toApiError()` wraps arbitrary `Error` instances into `internal_error` while preserving `error.message`.
- `sendApiError()` sends that message back to the client.

Why this matters:

- Unexpected provider, runtime, or database failures can leak implementation details to callers.
- Some existing code constructs rich provider-side error messages, for example around Auth0 management calls and missing runtime bindings.
- This is not a stack-trace leak, but it is still unnecessary internal disclosure.

Recommendation:

- Return a generic message for non-`ApiError` failures, such as `An unexpected error occurred.`.
- Log the original error server-side with enough context for debugging.
- Keep detailed `message` and `details` only for intentionally user-facing `ApiError` cases.

### 5. Medium: Public contact and upload endpoints have no rate limiting or abuse controls

Affected paths:

- `server/api/public/imprint-contact.post.ts`
- `server/domains/platform/legal-contact.ts`
- `server/api/account/profile-icon.post.ts`
- `server/api/events/[eventId]/images/background.post.ts`
- `server/api/events/[eventId]/images/banner.post.ts`
- `wrangler.jsonc`

What happens:

- The public contact form validates input and sends mail, but the only abuse check is a honeypot field.
- The authenticated upload routes enforce file size and MIME allowlists, but there is no per-user or per-IP throttling.
- No rate-limit policy or Cloudflare-side protection is configured in this repo.

Why this matters:

- The contact form can be abused for spam, support mailbox flooding, or Cloudflare Email Service quota burn.
- Upload routes can be used for storage churn and operational abuse after account compromise or by any abusive authenticated actor.

Recommendation:

- Add Cloudflare rate limiting or WAF rules for the public contact endpoint and auth-adjacent routes.
- Add actor-aware quotas for upload endpoints.
- Consider server-side deduplication or cooldowns for the contact form.

### 6. Medium: Upload validation trusts multipart MIME metadata and image responses omit `nosniff`

Affected paths:

- `server/domains/accounts/profile-icons.ts`
- `server/domains/events/images.ts`
- `server/api/account/profile-icon.get.ts`
- `server/api/public/events/[slug]/images/background.get.ts`
- `server/api/public/events/[slug]/images/banner.get.ts`

What happens:

- Upload acceptance is based on byte length plus the multipart part's declared content type.
- The code does not inspect magic bytes, decode the image, or re-encode it.
- The GET handlers reflect the stored content type back to clients.
- The responses do not set `X-Content-Type-Options: nosniff`.

Why this matters:

- A client can upload arbitrary bytes while claiming `image/png` or `image/jpeg`.
- The browser usually respects image content types, but serving attacker-controlled bytes as trusted image content is avoidable risk.
- This matters more for publicly served event images than for private profile icons.

Recommendation:

- Validate image signatures or decode/re-encode uploads before storing them.
- Set `X-Content-Type-Options: nosniff` on image responses.
- Consider stripping metadata and normalizing uploads to a known safe output format.

### 7. Medium: No repo-level browser security headers are configured

Evidence:

- `nuxt.config.ts` does not define route rules or security headers.
- A repo search shows the only explicit `setHeader()` calls are cache-related.

Missing controls include:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options` or `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Content-Type-Options`

Why this matters:

- Missing headers do not create an exploit by themselves, but they remove important containment layers.
- This is especially relevant because the app renders user-visible HTML pages, integrates with Auth0, and serves uploaded media.

Recommendation:

- Add security-header middleware in Nitro or enforce the headers at Cloudflare.
- Roll out CSP carefully and verify Auth0, icons, and any external assets against it.

## Dependency Notes

`bun audit` reported 18 advisories total. Not all of them are equal:

- Runtime-relevant:
  - `h3@1.15.6`

- Mostly dev/build/transitive from the current dependency tree:
  - `serialize-javascript@6.0.2`
  - `node-forge@1.3.3`
  - `srvx@0.11.12`
  - `flatted@3.4.1`
  - older transitive copies of `brace-expansion`, `picomatch`, `yaml`, and others

The report should not be read as "18 production vulnerabilities". The runtime item that needs immediate attention is `h3`.

## Strengths

The following controls were present and looked sound in this review:

- Auth0-backed session model rather than custom credential handling.
- Clear actor model in `server/auth/actor.ts`.
- Centralized authorization helpers in `server/auth/authorization.ts`.
- Widespread use of Zod validation for body, params, and query inputs.
- Drizzle-based database access instead of raw SQL string building.
- Account-link challenge signing with HMAC and expiry checks.
- Database constraints and triggers enforcing important invariants.
- Reasonable role scoping for admin, judge, team-admin, and prize-recipient flows.

## Operational Observations

These did not rise to the same level as the findings above, but they are worth cleaning up:

- `nuxt.config.ts` enables devtools unconditionally. This should be gated by environment for clarity even if production tooling disables it.
- `nuxt.config.ts` also contains a hard-coded ngrok host in Vite `allowedHosts`, which is a dev-only artifact that should not live in the canonical config.

## Recommended Fix Order

1. Fix the team-detail privacy exposure.
2. Upgrade the runtime stack so `h3` is patched.
3. Require verified email for platform account creation.
4. Stop echoing raw internal exception messages to clients.
5. Add Cloudflare-side rate limiting and abuse controls.
6. Harden uploads and add `nosniff`.
7. Add browser security headers.
