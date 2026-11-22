<p align="center">
  <img src="public/platform-mark.png" width="104" alt="Codex Events platform mark" />
</p>

<h1 align="center">Codex Events</h1>

<p align="center">
  <strong>A self-hosted event workspace for teams that want clear paths from registration to results.</strong>
</p>

<p align="center">
  Run hackathons, meetups, and build events from one self-hosted workspace — the same applications, approvals, and attendance for every event, plus teams, submissions, judging, and prizes when you run a hackathon. On infrastructure you choose.
</p>

<p align="center">
  <a href="https://codex-events.com">Demo</a>
  |
  <a href="docs/domain-model.md">Product Model</a>
  |
  <a href="docs/lifecycle-and-state-machines.md">Lifecycle</a>
  |
  <a href="docs/permissions-matrix.md">Permissions</a>
  |
  <a href="docs/tech-stack.md">Stack</a>
  |
  <a href="OPERATOR.md">Operator Guide</a>
  |
  <a href="DEVELOPMENT.md">Development</a>
</p>

<p align="center">
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-Cloudflare-0F172A?style=for-the-badge&logo=cloudflare&logoColor=white" />
  <img alt="Nuxt" src="https://img.shields.io/badge/Nuxt-application-00DC82?style=for-the-badge&logo=nuxt&logoColor=white" />
  <img alt="Auth0" src="https://img.shields.io/badge/Auth0-identity-EB5424?style=for-the-badge&logo=auth0&logoColor=white" />
  <img alt="Cloudflare D1" src="https://img.shields.io/badge/Cloudflare-D1%20%7C%20R2%20%7C%20Queues-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" />
</p>

<p align="center">
  <sub>Platform overview</sub><br />
  <img src="docs/assets/readme/generated-platform-overview.png" width="100%" alt="Codex Events platform overview" />
</p>

---

## A Shared Workspace For Events

Codex Events replaces the scattered forms, spreadsheets, judge sheets, tool exports, and email threads behind an event with one shared workspace for recurring or parallel events. Participants keep a reusable platform account; each event brings its own schedule, application flow, rules, roles, and outcomes.

## Event Types

You run three kinds of event from the same platform. Every event shares the same accounts, applications, approvals, and attendance. Meetups and builds stop there; hackathons add the competition layer on top.

<table>
  <tr>
    <td width="33%" valign="top">
      <strong>Hackathon</strong><br />
      Full competition event.<br /><br />
      Apply &rarr; form a team &rarr; submit a project &rarr; blind and live-pitch judging &rarr; shortlist &rarr; winners, prizes, and a public project showcase.
    </td>
    <td width="33%" valign="top">
      <strong>Meetup</strong><br />
      Registration-only community event.<br /><br />
      Apply &rarr; get approved &rarr; attend.
    </td>
    <td width="33%" valign="top">
      <strong>Build</strong><br />
      Registration-only build event.<br /><br />
      Apply &rarr; get approved &rarr; attend.
    </td>
  </tr>
</table>

## Features

### Every event type includes

| Capability | How it helps |
| --- | --- |
| **Reusable accounts** | Participants register once and keep a profile, linked sign-in identities, and history across every event they join. |
| **Application-first registration** | Per-event registration windows, configurable application fields, required profile fields, and optional event-specific terms. |
| **Private Meetup calls for talks** | Optionally invite registered Meetup applicants to submit one private Talk proposal for staff review and a final admin decision. Proposal content stays in the account workspace and is not added to the public agenda. |
| **Approvals and decision emails** | Review applications with staged approve/reject decisions or automatic approval, and notify participants of the outcome by email. |
| **Attendance and Luma sync** | Mark events in person, gate the venue address and Discord link to approved participants, let event staff check in participants at the entrance, and optionally verify Luma guests, confirm registrations from the Luma guest list, and sync check-ins. |
| **Guided arrival** | Optionally show confirmed participants their next step on the event page: check in at the entrance, answer a short questionnaire written by the organizer, then open the event's activities. Staff and admins read the answers in the participant list. |
| **Event credits** | Offer redeemable credits — such as API or tooling credits — to approved participants from uploaded inventory. |
| **Galleries and feedback** | Share a private event gallery, publish selected photos, and collect anonymous post-event feedback. |
| **Explicit roles and audit** | Platform admins, event admins, event organizers, and staff are separate actors with scoped permissions and an audit trail. |
| **MCP access** | Let signed-in users connect compatible AI clients through Auth0 OAuth or optional 30-day manual tokens, with the same platform permissions as the web app. |

### Hackathons also add

| Capability | How it helps |
| --- | --- |
| **Team formation** | Solo or team participation, open-team join requests, team admins, and per-event team-size limits. |
| **Structured submissions** | Submission windows, tracks, summaries, repository and demo links, drafts, locking, withdrawal, and disqualification. |
| **Blind and pitch judging** | Configurable blind review (0–2 reviewers per project), a live pitch stage, pitch review, weighted scoring, and skipped-review redistribution. |
| **Shortlist and finalists** | Save the blind-review shortlist, set the finalist boundary, and run the live pitch lineup. |
| **Winners and prizes** | Announce winners, freeze prize eligibility, send winner notices, and track prize redemption against accepted winner terms. |
| **Public showcases** | A completed-event showcase of winning projects, plus opt-in public publishing for non-winning projects. |

---

## How It Runs

Codex Events runs in infrastructure you choose. Auth0 handles authentication. The platform handles authorization: platform roles, event roles, team roles, application state, judging assignments, prize eligibility, and event history live in platform data.

<p align="center">
  <img src="docs/assets/readme/operating-stack.svg" width="100%" alt="Codex Events operating stack" />
</p>

The platform deployment uses:

| Layer | Role |
| --- | --- |
| **Cloudflare Workers** | Application hosting and server-side execution. |
| **Cloudflare D1** | Primary relational database. |
| **Cloudflare R2** | Profile icons, event imagery, and gallery storage. |
| **Cloudflare Images bindings** | Protected gallery preview transformations. |
| **Cloudflare Queues** | Asynchronous email and Luma sync jobs. |
| **Cloudflare Email Service** | Outbound transactional email delivery. |
| **Cloudflare Cron Triggers** | Scheduled platform work. |
| **Auth0** | User authentication and linked identity resolution. |
| **Luma** | Optional event guest verification, approval/rejection sync or guest-list confirmation, and attendance webhooks. |

The repository includes automation for recurring setup and maintenance:

- Auth0 setup for required app URLs, branding, custom domains, Actions, and account-linking callbacks.
- First platform-admin setup.
- Event-scoped Luma webhook setup from event settings.
- Cloudflare queue, secret, migration, and deployment workflows.
- A GitHub Release driven production deployment workflow.

Remote test and production deployments are generated from environment-specific deployment variables, Cloudflare IDs, and runtime settings. Local Cloudflare bindings are documented in `wrangler.jsonc`.

Compatible MCP clients connect to the deployment's `/mcp` endpoint. Auth0
OAuth is the recommended connection method; named 30-day bearer tokens remain
available for clients that require a manual credential. OAuth clients use
administrator-approved HTTPS Client ID Metadata Documents (CIMD), with the
metadata URL as the client identifier. Only administrator-approved metadata
documents can create MCP client registrations. Tool discovery
follows the user's current role, and every call rechecks the same authorization
and lifecycle rules as the web app. See the [MCP API and security model](docs/mcp.md)
for the authentication, operation, and audit contract.

## Where It Fits

Codex Events is a good fit when your team wants to:

- run several events in parallel or as a recurring series — hackathons, meetups, and build events — from one platform;
- review and approve participants before they reach the event workspace;
- run registration-only community events with shared approvals, attendance, and credits;
- run hackathons with solo and team participation, blind and live-pitch judging, and prizes, without stitching separate tools together;
- keep platform-admin, event-admin, staff, judge, participant, and winner permissions explicit;
- host on Cloudflare with your own Auth0 tenant and deployment pipeline;
- keep participant data, competition state, and prize follow-up in one consistent record.

It may be more than you need if you only want a single static event page or an RSVP form.

## What You Bring

Plan for:

- a Cloudflare account with Workers, D1, R2, Images, Queues, Cron Triggers, DNS, Email Sending on a Workers Paid plan, and appropriate API tokens;
- an Auth0 tenant and Regular Web Application for the platform;
- an onboarded Cloudflare Email Service sending domain and verified sender address;
- production and, if desired, test domains;
- optional event-scoped Luma API access when specific events use Luma guest sync or attendance webhooks;
- deployment-owned legal controller details, support and privacy contact addresses, and current Privacy Policy and Platform Terms content;
- people who can manage platform admins, event admins, judges, staff, and release access.

Before launch, configure platform legal settings and publish current platform documents from the platform-admin workspace or legal setup tooling. Public legal pages and account registration require those settings to be present.

Production setup, advanced deployment overrides, the optional test environment, and tuning settings are documented in [`OPERATOR.md`](OPERATOR.md). Environment-specific examples are available in [`.env.example`](.env.example), and local Cloudflare bindings are shown in [`wrangler.jsonc`](wrangler.jsonc).

---

## Product Documentation

The canonical product and engineering docs live in [`docs/`](docs/README.md). Start here when evaluating exact behavior:

| Document | Purpose |
| --- | --- |
| [`docs/domain-model.md`](docs/domain-model.md) | Entities, relationships, permissions, and business invariants. |
| [`docs/lifecycle-and-state-machines.md`](docs/lifecycle-and-state-machines.md) | Event, application, team, submission, judging, winner, and redemption lifecycles. |
| [`docs/permissions-matrix.md`](docs/permissions-matrix.md) | Actor permissions, visibility rules, and state-based action constraints. |
| [`docs/schema-outline.md`](docs/schema-outline.md) | Canonical fields, enums, constraints, and key relationships. |
| [`docs/api-surface.md`](docs/api-surface.md) | Backend API domains, operations, contract conventions, and validation expectations. |
| [`docs/mcp.md`](docs/mcp.md) | MCP OAuth and manual credentials, eligible operations, authorization, security, and auditing. |
| [`docs/tech-stack.md`](docs/tech-stack.md) | Application stack and infrastructure choices. |
| [`docs/testing-strategy.md`](docs/testing-strategy.md) | Validation layers and Auth0-backed end-to-end strategy. |

For teams running the platform, use [`OPERATOR.md`](OPERATOR.md). For repository contributors, local development, test commands, and release mechanics, use [`DEVELOPMENT.md`](DEVELOPMENT.md).
