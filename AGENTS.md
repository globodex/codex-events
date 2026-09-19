# AGENTS.md

This repository contains the Codex Events platform. The current root-governed
documentation model keeps canonical product and engineering guidance under
`docs/`, operator deployment guidance in `OPERATOR.md`, contributor setup in
`DEVELOPMENT.md`, and project management in Backlog.md MCP.

## Project Context

- The platform is used by the Codex Community team to manage multiple events
  in parallel.
- The product is still being designed. Existing prototype or starter-template
  code is not authoritative for product behavior.
- The `docs/` directory is the source of truth for product rules, domain
  definitions, workflows, architecture, and constraints.

## Stack Summary

Authoritative details live in [docs/tech-stack.md](docs/tech-stack.md). At a
glance:

- **Application:** Nuxt web application with shadcn-vue component primitives
  and Tailwind CSS styling.
- **Contracts and data access:** Zod for validation and Drizzle ORM for
  database schema management and queries.
- **Validation:** Vitest for unit and integration tests, Playwright for
  end-to-end tests.
- **Runtime:** Cloudflare Workers for application hosting and server-side
  execution.
- **Data and storage:** Cloudflare D1 as the primary relational database,
  Cloudflare R2 for file storage, and Cloudflare Images bindings for protected
  preview transformations.
- **Async and scheduled work:** Cloudflare Queues, Cloudflare Cron Triggers,
  and Cloudflare Email Service.
- **Identity:** Auth0 handles authentication and identity; the platform data
  model owns authorization.

When stack decisions change, update `docs/tech-stack.md` first and treat it as
authoritative.

## Canonical Documentation

Read these before making product or architecture decisions:

- [docs/README.md](docs/README.md): documentation index and writing rules.
- [docs/domain-model.md](docs/domain-model.md): domain language, entities, and
  invariants.
- [docs/lifecycle-and-state-machines.md](docs/lifecycle-and-state-machines.md):
  event, application, team, submission, judging, winner, and redemption
  lifecycles.
- [docs/permissions-matrix.md](docs/permissions-matrix.md): actor
  permissions, visibility rules, and state-based action constraints.
- [docs/schema-outline.md](docs/schema-outline.md): canonical fields, enums,
  constraints, and relationships.
- [docs/api-surface.md](docs/api-surface.md): API domains, operations,
  contract conventions, and validation expectations.
- [docs/tech-stack.md](docs/tech-stack.md): application stack and
  infrastructure choices.
- [docs/testing-strategy.md](docs/testing-strategy.md): validation layers,
  local BDD personas, and fixture rules.

If code and docs disagree during this design phase, treat the docs as the
current source of truth and flag the mismatch.

## Root-Owned Workflow

- Keep agent and CI instructions at the repository root.
- Do not add nested `AGENTS.md` files or nested GitHub workflow files under
  application directories.
- The root `README.md` is public-facing documentation for people evaluating,
  cloning, configuring, and running `codex-events` on their own Cloudflare
  instances.
- Write the root `README.md` from the point of view of an operator or adopter
  of the platform, not from the point of view of a contributor to this
  repository.
- The root `README.md` should focus on platform capabilities,
  deployment/runtime configuration, and links to canonical product docs.
- Production deployment variables, runtime configuration, and operator setup
  belong in `OPERATOR.md`.
- Contributor workflow, local setup, validation commands, and test-running
  instructions belong in `DEVELOPMENT.md`, not in the root `README.md`.
- When adding new canonical docs, place them in `docs/` and link them from
  `docs/README.md`.
- Prefer updating existing canonical docs over creating duplicate notes.
- Write documentation as the current product truth, not as change history.
- Record unresolved product questions explicitly instead of implying certainty.

## Package Scripts

- Treat root `package.json` scripts as developer-facing and automation-facing
  entrypoints.
- Keep a script in `package.json` only when a contributor, CI workflow, or
  deployment workflow needs it for local development, local validation,
  troubleshooting, or a checked-in operational process.
- Do not add one-off, personal, or environment-specific commands to
  `package.json` when they are better expressed as documented shell commands or
  CI workflow steps.
- Put remote database migrations, remote storage setup, deployments, queue
  reconciliation, Auth0 automation, and similar environment-specific operations
  in checked-in tools plus the root CI workflows or deployment automation that
  owns those environments.

## Authoring Rules

- Write documentation as the current canonical state of the product.
- Do not narrate previous versions of the spec.
- Do not explain how the team arrived at the current model unless explicitly
  asked.
- Do not preserve obsolete concepts for backward compatibility.
- Do not introduce backward-compatibility constraints unless the user explicitly
  requests them.
- Prefer clear first-read explanations for someone learning the system today.
- If code and docs disagree during this design phase, treat the docs as
  authoritative and flag the mismatch.
- Do not add roadmap, planned-work, "current direction", or
  conversation-specific sections to canonical docs unless the user explicitly
  asks for them.
- Do not include speculative future documents, future phases, or placeholders
  for work that is not yet canonically defined.
- If something is not current truth, either omit it or record it explicitly as
  an unresolved question in the appropriate canonical document.
- Do not document naming debates, rejected alternatives, or authoring heuristics
  inside canonical product docs.
- Do not include rationale that only explains why one wording or model was
  chosen over another unless that rationale is itself part of the product rules.
- Do not describe canonical decisions in contrast to prototype code or existing
  local setup.
- Do not include optional alternatives in canonical docs unless those
  alternatives are themselves part of the supported product architecture.
- Do not add sections such as "current position" or language such as "for the
  first version" unless the user explicitly asks for phased planning.

## Compatibility Policy (Strict)

- Do not add backward-compatibility behavior unless the user explicitly requests
  it.
- Do not add compatibility fallbacks, dual-read paths, or dual-write paths to
  support legacy shapes by default.
- Do not preserve legacy adapters, shims, or migration glue in runtime code
  "just in case".
- When replacing a model or contract, update callers to the new canonical shape
  directly instead of introducing temporary fallback logic.
- If migration is required, use an explicit data migration or backfill plan
  rather than runtime fallback behavior.

## Platform Guardrails

- Auth0 is responsible for authentication and identity. Application
  authorization remains in the platform database through platform roles, event
  roles, team roles, approvals, and related business rules.
- Cloudflare D1 is the primary relational database. Do not introduce a second
  persistence model for canonical platform data unless the canonical docs change
  first.
- Cloudflare R2 and Cloudflare Images handle file storage, public responsive
  delivery, and protected preview transformations. Keep stored originals and
  derived previews conceptually separate.
- Cloudflare Queues own asynchronous email and integration work. Do not make
  user-facing request paths depend on best-effort external sync completing
  inline unless the docs explicitly require it.
- Legal settings and platform document content are deployment-owned. Public
  legal pages and account registration should require configured legal content
  rather than falling back to repository-owned operator details.
- Luma is an optional event integration for guest verification,
  approval/rejection sync, and attendance webhooks. Core event participation
  should remain understandable without exposing Luma mechanics to participants.

## Performance and Request Topology

- Public event and discovery delivery may use cacheable SSR or static responses. `/account/**`, `/admin/**`, and prize-redemption workspaces use an immediate client-rendered or static shell; API authorization remains server-side.
- Use the shared typed account bootstrap for actor, session, and capability data. Route guards and feature components consume it. Do not add feature-local `/api/session` calls or refresh actor data for query-only tab changes.
- The shared account bootstrap owns one authorization fingerprint and generation for the Nuxt app instance. Protected `useApiData` and `useApiFetch` state is scoped through that boundary and is cleared when actor identity, platform user, roles, capabilities, or current consent changes; public data and the bootstrap itself remain outside that generation.
- Resolve the request actor once per API request. Identity reconciliation belongs to login and account-link flows, not ordinary reads. Mutations enforce canonical authorization and current consent.
- The normal HTTP platform-user actor path reads Auth0 session state, then performs one strong D1 identity-and-current-consent lookup. Its consent predicate must evaluate the latest version of each required platform document type inside that lookup; do not reintroduce per-document or per-acceptance actor reads. `/api/session` may separately read event-role assignments for the shared bootstrap.
- Data-heavy event tabs use page-shaped contracts with one critical read after bootstrap, one authorization resolution, and one request-scoped D1 client/session. Do not add a generic graph API; see `docs/api-surface.md` for the contract boundary.
- Protected request timing must retain aggregate `actor` plus `actor-session`, `actor-d1`, and `database-session` subphases so deployed browser evidence distinguishes Auth0/session time, the combined actor D1 read, and request-session/facade construction. A zero phase counter on a handler without an explicit wrapper is unattributed work, not evidence of zero time; use the real-browser profiling method in `docs/testing-strategy.md` before changing shared boundaries.
- The capability-narrowed request-scoped D1 session adapter owns execution-level attribution. It records each executed `prepare` method or `batch` call with a request-local ordinal, API/kind, elapsed adapter duration, statement count, known `timings.sql_duration_ms` total, `total_attempts`, and bounded serving metadata (`served_by_region`, `served_by_colo`, and `served_by_primary`). `Server-Timing` reports `d1-exec-total`, `d1-db-total`, and at most eight `d1-exec-N` entries plus an overflow count; `d1-exec-total` names the total executions, completed total, succeeded, failed, and inflight counts separately. Batch entries may include bounded ordered per-statement SQL metadata, never per-statement adapter transport time. Active or failed executions are explicit at emission, and unknown or mixed D1 metadata remains explicit. It must never expose SQL, bound values, results, cookies, auth subjects, inferred table names, or raw binding/session capabilities. Browser latency gates inspect these execution fields before changing shared boundaries.
- Deployed Workers freeze `performance.now()` and `Date.now()` during CPU-only intervals, and execution totals can sum overlapping I/O durations rather than represent wall time, CPU time, or the critical path. Treat `Server-Timing` as attribution evidence only; browser TTFB and Workers Trace/Tail CPU and wall measurements are authoritative for latency.
- Strong consistency is the only production HTTP database path. Do not expose a generic consistency option or a public replica accessor; actor, consent, permission, lifecycle, mutation, and read-after-write paths remain strong.
- Use consistency bookmarks and read-after-write behavior defined in `docs/tech-stack.md`; preserve equivalent behavior in the local fake-D1 adapter.
- The application database passed to domain code must be created from a capability-narrowed request-session binding containing only `prepare` and `batch`. Never spread or pass the raw D1 binding into Drizzle: `AppDatabase` must not expose a raw D1 binding, public Drizzle `$client`, session construction, or any capability that can create, replace, or bypass the request session/bookmark. Raw request-session `prepare` and `batch` access belongs only to `getDatabaseSession(event)`.
- `AppDatabase` is an explicit, allowlisted facade. Bind supported operations to the request session and fail closed for dangerous capabilities or unsupported entry points. Harmless Drizzle builder metadata/configuration such as `dialect`, `$dynamic`, or `toSQL` is not a session escape when it cannot reach a raw client or create another session; do not build a recursive membrane merely to hide that metadata. Reflective descriptors, prototype/constructor values, symbols, callbacks, and internal transaction entry points must not reintroduce a raw client, binding, or session. Descriptor values must not expose unwrapped functions, accessor receivers, or raw target objects; get, set, defineProperty, and __proto__ operations must not execute user-controlled code with the raw session as this. Tests prove that session/binding construction and raw prepare/batch capabilities are unavailable while supported builders, results, and same-session execution remain usable.
- HTTP requests do not trigger startup or recovery work. Queue consumers and scheduled recovery code construct a fresh non-HTTP database only in explicit worker, queue, scheduler, migration, and test entrypoints; HTTP paths pass their request-scoped `AppDatabase` or use `getDatabaseSession(event)`.
- Every production module under `server/` that can be reached by HTTP must use the request-scoped database or session accessors. It must not import or call raw D1 binding resolution, create a standalone Drizzle client or database access object, use replica consistency, or read/write H3 context database fields or test injection APIs. Split HTTP-safe domain code from explicit queue/scheduler/migration/test adapters; do not allow mixed queue/recovery modules to hide standalone construction behind source-test exemptions. Source, reachability, and call-site tests cover the whole production `server/` tree; non-HTTP construction and injection live only in explicit adapter boundaries and their module-private state.
- The single Nitro `beforeResponse` hook in `server/plugins/database-bookmark.ts` owns `X-D1-Bookmark` response emission for API and raw routes, including successful and error responses.
- The same single Nitro `beforeResponse` hook owns the fail-closed API cache policy. Actor, product, and every other non-allowlisted `/api/**` response must emit `Cache-Control: private, no-store` and `Cloudflare-CDN-Cache-Control: private, no-store` on success and error responses, including `/api/session` and returned `Response` bodies. The only exceptions are the explicit public/versioned event and media path allowlist, which may retain the exact public 30-second directives, and the separate static-framework `/api/_nuxt_icon/*.json` allowlist, which preserves generated framework cache headers for bundled static icon definitions. Static framework assets are not public product contracts; unknown generated-framework paths remain protected. Never add a handler-local shared-cache exception. Runtime/source tests must cover protected JSON and `Response` bodies, unauthenticated session isolation, public and static-framework allowlist preservation, fail-closed unknown framework paths, and real-browser rejection of protected actor/product `CF-Cache-Status: HIT` or `Age` evidence.
- Keep the tracked local Wrangler config cache-disabled (`cache.enabled=false`) because it is used for local D1 and migration work. Generated deployment configs use a split entrypoint topology: top-level Workers Cache is enabled, the default Nitro gateway entrypoint has `cache.enabled=false`, and only the internal `PublicCache` entrypoint has `cache.enabled=true`. Because the gateway calls the named export through `ctx.exports`, generated configs must explicitly include the `enable_ctx_exports` compatibility flag. The gateway must run for every external request and forward only the explicit public homepage, event-detail HTML, public JSON, versioned-media, and static-framework allowlists after stripping Cookie, Authorization, D1 bookmark, conditional, and other actor/request headers. Zone Cache Rules must bypass `/api/**` or respect origin no-store directives; no rule may use a Cookie-insensitive cache key for protected APIs. Release verification must use a safe, opt-in remote edge smoke test; local tests do not simulate a cache hit and no runtime purge is assumed.
- Cancel abandoned tab requests, lazy-load locally bundled heavy code, and do not load runtime editor dependencies from `unpkg`.
- Protected imperative reads use the shared signal-aware request contract. Route and tab changes abort their prior request, pass the signal through pagination and fan-out helpers, and do not commit an aborted response into active view state.
- Protected declarative and imperative query reads disable transport-level retries and use the shared request owner. The owner retains every non-abort settlement, including transport failures and terminal business responses, until an explicit refresh/action invalidates it; a changed request key or authorization generation creates a genuinely new read. The canonical protected key includes every declared watched source and request-shaping input that can alter the read, and is computed before Nuxt watcher execution so a changed watched shape cannot reuse a prior settlement. Each Nuxt app has an explicit bounded LRU of settled, inactive owner entries; capacity trimming may evict only entries with no active subscribers, and re-trims after settlement so temporary active overflow converges without aborting an active read. Aborts remain aborts and must not become retries.
- Public/versioned media uses streamed, cacheable Cloudflare Images variants. Keep private or mutable originals isolated, and do not use public `no-store` originals as page backgrounds.
- The TASK-432.6 managed public-media scope is event background and banner images, the platform default event background, and public event-gallery photo responses. Each managed resource has an independent immutable private R2 object pointer and named revision (`background_image_revision`, `banner_image_revision`, `default_event_background_image_revision`, or `image_revision`); event public HTML/JSON visibility has a separate `public_content_revision`. Newly issued versioned managed URLs include the exact current resource revision, and cache misses or revalidations validate that exact revision before storage access. Public gallery `variant=original` is a bounded 2400px full-display Images transform, and stored originals are available only through explicit `download=1` attachment responses that recheck photo access and revision, bypass the public cache entrypoint, and use `private, no-store`. Generated certificate PNGs and winner or published-project profile icons are outside this managed cache scope and remain private, `no-store` responses; `profileIconUpdatedAt` is metadata only and profile-icon URLs use the independent numeric `profileIconRevision`.
- Newly issued managed event, platform-default, and gallery responses use `Cache-Control: public, max-age=30, stale-if-error=0` and matching `Cloudflare-CDN-Cache-Control`, which is the strict maximum 30-second browser and Cloudflare freshness window. A cache hit can bypass the Worker, D1 visibility/revision checks apply only on a miss or revalidation, and Cache API deletion is not a global purge. Do not claim strict revocation for a cached response or add a runtime purge secret.
- A successful pointer replacement or removal records a fixed-kind cleanup intent in the same D1 mutation through the managed-media outbox. The scheduled Worker publishes eligible outbox rows after the exact 30-second safety window without request fan-out; the Queue consumer retries transient R2 failures and routes messages that exhaust their configured retries to the managed-media DLQ. Migration-era stable keys remain valid cleanup targets, and cleanup failures leave private bytes that no route can serve.
- Maintain real-browser request-topology, cancellation, media-payload, timing-phase, and wall-clock budget checks described in `docs/testing-strategy.md`.

## Database Query Guardrails

- Runtime database queries in `server/` and `app/` must not use SQL
  `WHERE IN` or Drizzle `inArray`.
- Use joins, `exists`-style predicates, direct equality predicates, or explicit
  per-row point operations instead.
- For small fixed enum filters, use explicit `or(eq(...), eq(...))`
  predicates.
- Ignore or suppress this rule only for static/configuration tables whose rows
  cannot be added at runtime. Never ignore it for tables containing dynamic
  product data such as users, events, applications, teams, submissions, judging,
  credits, audit logs, or other participant/admin-created records.
- Tests may use `inArray` when useful, but runtime source must not import it.

## Interface Component Ownership

Prevent component entropy by reusing the existing interface system before
creating new Vue components.

- Before creating any component, search `app/components/`, the target route,
  and the nearest domain directory for an existing visual or behavioral analog.
  Identify the closest analog and prefer adapting that pattern.
- Generated `shadcn-vue` primitives under `app/components/ui/` are the
  primitive layer. They are not app-level components to copy from in feature
  work. Use them directly only when extending primitives or maintaining the
  App wrapper layer.
- Root `App*` components under `app/components/` are shared interface
  primitives for application styling, controls, icons, layout, and feedback.
  Feature work should use these wrappers before importing generated primitives.
- Domain and shared components under directories such as `admin`, `events`,
  `public/events`, `account`, `applications`, `judging`, `shell`, and `teams`
  are the next reuse layer. Reuse or extend them before creating another domain
  panel, card, row, form, or status presentation.
- Large page and panel components should compose existing App and domain
  components. They must not invent local row, card, filter, roster, editor,
  or form patterns when a shared pattern already exists.
- Create a new component only when the closest existing component cannot express
  the current behavior through props, slots, composition, or a focused
  extension. Document the closest existing analog and why extension is not
  enough in the Backlog task or implementation notes.
- All new interface work follows atomic design mapped onto the tiers above:
  atoms are the `ui/` primitives plus their `App*` wrappers, molecules and
  organisms are domain components (feature areas may use explicit `molecules/`
  and `organisms/` subdirectories, as `app/components/admin/builder/` does),
  templates compose organisms and own no business logic, and pages wire state
  and data fetching. Composition flows strictly downward with props down and
  events up; no cross-organism reach-ins.
- When a task would refactor existing components that predate this rule, ask
  Alex first whether to migrate them to the atomic structure as part of that
  change. The goal state is an entirely atomic component tree, reached
  incrementally with explicit approval per refactor.

## Working Style

- Keep domain language stable and intentional.
- Assume high concurrency in this repository. Other agents or collaborators may
  be editing nearby files at the same time.
- Do not stop work just because you notice unrelated or unexpected changes in
  the worktree. Expect parallel work by default and continue unless those
  changes directly block the task you are doing.
- Inspect the worktree before staging, committing, pushing, or reverting
  anything, and isolate only the files required for your task.
- When parallel work is present, adapt to it. Read carefully, avoid overwriting
  others, and stage or commit only the changes required for your task.
- Do not overwrite, revert, or "clean up" changes you did not make unless the
  user explicitly asks you to do so.
- Default git workflow for this repository is to commit directly on `main` and
  push to `origin/main`.
- When a user-requested change is complete, commit and push it unless the user
  explicitly asks not to.
- Do not create feature branches or PRs unless the user explicitly asks for
  them.
- When creating a GitHub Release, do not manually update `package.json` or
  create a local version-bump commit first. The production release workflow
  derives the package version from the published release tag, writes
  `package.json`, and commits that version sync back to `main` automatically.
  Check `.github/workflows/deploy-production.yml` before changing release
  automation behavior.
- Separate product concepts from storage details when possible.
- Record unresolved product questions explicitly instead of implying false
  certainty.
- Use current-state language such as "A hackathon has..." rather than "We
  changed..." or "Previously...".
- Prefer the simplest model that expresses the business rules clearly.
- Prefer proven libraries and existing framework capabilities over writing
  custom implementations from scratch in most cases.
- Favor booleans, enums, and direct fields over additional entities or
  abstractions when the extra structure does not provide clear operational
  value.
- Do not add general-purpose extensibility for hypothetical future needs unless
  the user explicitly asks for it.
- Optimize for systems that are easy to understand, query, and operate at scale,
  even when that means rejecting more textbook modeling patterns.
- Reject fallback-based implementations when a direct canonical implementation
  is possible.
- Do not bloat the code. Every added line must be justified by a concrete
  requirement in the current task.
- You are penalized for extra lines, branches, helpers, fallbacks, or state that
  are not strictly necessary to implement the requested behavior safely.
- Do not add defensive UI or runtime fallbacks for states that are already
  prevented by routing, permissions, or upstream invariants unless the user
  explicitly asks for them.

## Codex Events Validation

For any code changes, run validation before handoff and before committing:

- `bun run lint`
- `bun run typecheck`
- `bun run test:unit`

Run `bun run test:integration` and `bun run test:bdd` when the change touches
server integrations, Auth0-backed flows, browser workflows, or other behavior
covered by those suites.

For docs-only changes, run `git diff --check`. Report any validation command
that cannot be run and why.

## Collaboration Style

Work with the user like a teammate, not a fully delegated contractor.

Default behavior:

- Treat user requests as the start of a collaboration, not automatic permission
  to run to completion.
- Do not turn collaboration into a ritual checklist. Restate goals,
  assumptions, ambiguities, or questions only when they materially affect
  implementation.
- If the task is mechanical, local, reversible, and unambiguous, proceed
  directly.
- If ambiguity could change product behavior, scope, architecture, naming, or
  tradeoffs, pause and collaborate before implementing.
- When you pause, separate clearly what is certain, what you are inferring, and
  what you need from the user.
- If there are multiple reasonable interpretations or tradeoffs, present them
  briefly before choosing.
- If you think the request is pointing at the wrong solution, say so directly
  and explain the better framing.
- Do not silently make product or architectural decisions just to keep momentum.

Rule of thumb:

- If a human teammate would normally just make the edit, do it.
- If a human teammate would normally pause to confirm because the choice affects
  behavior or direction, pause and confirm.

## Communication Style

- Respond briefly and pragmatically.
- Default to a few sentences, not long explanations.
- Lead with the answer or result.
- Include only the minimum context needed to act safely.
- Expand only when the user explicitly asks for more detail.
- Keep progress updates short and factual.
- When a user gives a non-trivial task, ask focused follow-up questions until
  you have high confidence in the outcome they actually want, not just the
  solution they initially proposed.
- Clarify the underlying goal, constraints, and success criteria before
  implementing when the user's intent could reasonably be interpreted in more
  than one way.
- If the task is purely mechanical and the intended outcome is already clear,
  do not ask unnecessary questions.

## User POV For Copy And UX

- When writing product copy, labels, helper text, empty states, or UX flows,
  write from the point of view of the current product actor:
  - event participant
  - hackathon participant
  - hackathon judge
  - event staff
  - event admin
  - platform admin
- Before proposing or editing copy, identify the actor, what they are trying to
  do, and what they already know at that moment.
- Prefer the user's mental model over internal implementation language.
- Do not write copy that only makes sense to contributors who have read the docs
  or know the schema.
- Do not expose backend concepts, internal entities, lifecycle mechanics, Auth0,
  database details, queue mechanics, or implementation details unless the
  product explicitly requires them.
- Labels and field descriptions must be understandable on first read by the
  target actor without extra platform context.
- Do not add subtitles, helper text, or descriptive copy beneath headings,
  labels, cards, or settings by default. Prefer one concise, self-explanatory
  heading or label. Only add supporting copy when the user explicitly asks for
  it or when it is necessary to prevent misunderstanding or error, and never
  use it to restate the heading.
- Helper text should explain only what the actor needs to provide or decide, not
  what the system is doing internally.
- Button, form, and workflow copy should focus on user intent and outcome, not
  technical process.
- Avoid overly technical explanations of what happens after an action unless
  that detail changes the user's decision.
- If a screen or flow is actor-specific, optimize the copy and information
  hierarchy for that actor rather than for a generic platform operator.
- When uncertain between internal precision and user clarity, prefer user
  clarity and keep internal precision in code, schema, and admin-only
  operational docs.
- For dashboard and admin UI, default to one visual container depth per section.
  Do not place bordered cards, inset panels, or similar surfaces inside another
  card unless the nested surface is a truly separate workflow or tool.
- Inside an existing card, create hierarchy with spacing, columns, headings, and
  dividers before introducing another bordered box.
- If nested surfaces appear necessary, pause and justify that choice explicitly
  instead of making it the default.
- For any meaningful UX or copy change, explicitly validate:
  - Who is the actor?
  - What is their goal?
  - What terms would they naturally use?
  - What information do they need before acting?
  - What implementation detail can be safely omitted?

## Audience Translation Rule

Keep private reasoning separate from visible output.

Before writing or editing any user-facing copy, UI label, heading, empty state,
README section, landing-page text, or canonical documentation, identify two
layers:

- Internal intent: what the team or agent is trying to achieve, prove, model,
  or validate.
- Audience-facing expression: what the target reader or user should actually
  see.

Never publish the internal intent directly unless the audience is explicitly an
internal contributor reading implementation notes.

Examples of internal intent that must usually be translated:

- "external validation"
- "technical credibility"
- "onboarding flow"
- "activation"
- "happy path"
- "edge case"
- "admin lifecycle"
- "canonical state"
- "MVP scope"
- "assumptions"
- "current direction"
- "migration strategy"
- "proof of value"

Translate intent into audience-native language, evidence, actions, or outcomes.
Good visible copy names the thing the user recognizes, the action they can take,
or the outcome they care about. Bad visible copy names the reason the team
wanted the copy to exist.

Before finalizing, scan headings, buttons, helper text, empty states, README
sections, and docs intros. If a phrase sounds like a planning note, product
strategy label, schema concept, or agent reasoning artifact, rewrite it from the
reader's point of view.

Use this test:

- Would the target actor naturally say this phrase?
- Would this phrase make sense without knowing our implementation or planning
  conversation?
- Is this evidence/action/outcome, or is it a label for what we hoped to
  communicate?

For this project, do not expose organizer/platform implementation language to
participants or judges. A participant joins an event, submits a project when
the event is a hackathon, checks requirements, and sees decisions or results. A
judge reviews assigned submissions using visible criteria. They do not need to
see concepts like lifecycle state, canonical workflow, review pipeline, queue
delivery, or internal scoring model unless those concepts are part of the
visible rules.

When in doubt, keep the precise internal term in code, schema, specs, or task
notes, and use audience-native wording in the visible surface.

<!-- BACKLOG.MD GUIDELINES START -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Use the detailed guides when needed:
- `backlog instructions task-creation` for creating or splitting tasks
- `backlog instructions task-execution` for planning and implementation workflow
- `backlog instructions task-finalization` for completion and handoff

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->
