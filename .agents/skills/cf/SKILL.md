---
name: cf
description: Use the Cloudflare cf CLI for Codex Events Cloudflare operations, including command discovery, account and resource inspection, and planning a Workers tooling migration.
---

# Cloudflare CLI

Use `cf` for direct Cloudflare CLI work in this repository. When the installed
CLI lacks a command, check the current release and the official Cloudflare API.
Use the documented API if it supports the authorized operation. Otherwise,
report the gap. Do not fall back to ad hoc Wrangler CLI commands.

## Find and run commands

1. Check `cf --version` and `node --version`. If an older `cf` on `PATH` lacks
   the documented features, use the current official npm `cf` package with a
   supported Node.js version. Commands that load `cloudflare.config.ts` require
   Node.js. [Install and sign in](https://developers.cloudflare.com/cf/get-started/)
2. Find a command with `cf cli search "list D1 databases"`. Check its options
   with `cf d1 list --help` and its API shape with `cf schema d1 list`. For
   product details, use `cf docs search` with a generic query or consult the
   official docs. Keep account identifiers and credentials out of searches.
   [Agent guide](https://developers.cloudflare.com/cf/agents/)
3. Select the intended account, zone, and resource explicitly for remote work.
   Use the API resource ID where the command requires it. Check pagination for
   list operations. For a supported mutation, use `--dry-run` to preview the
   request before executing it. Keep tokens and secret payloads out of tool
   output. [Resource commands](https://developers.cloudflare.com/cf/get-started/resources/)

Check `npm view cf@latest engines` when the machine runs an older Node.js
version. Run the CLI with a compatible Node.js release.

```sh
npx --yes --package node@24 --package cf@latest --call 'cf --version'
```

Resource commands default to Cloudflare's remote API. For local D1 access, use
`cf d1 raw <database-id> --local --sql <query>` when the local `cf` runtime and
state path are configured. Check supported local operations and `--persist-to`.
The existing `.wrangler` state and `cf`'s `.cloudflare` state have separate
defaults. [Command and configuration reference](https://developers.cloudflare.com/cf/wrangler/reference/)

## Existing Workers project

Codex Events uses a tracked `wrangler.jsonc` for local development and generates
deployment configuration for each environment. Direct resource commands work
independently of this project configuration. Existing checked-in validation and
deployment entry points remain owned by their documented workflows.
[Contributor setup](../../../DEVELOPMENT.md) · [Operator guide](../../../OPERATOR.md)

For an explicit migration assessment, use
`cf migrate --dry-run --bundler vite wrangler.jsonc` from the repository root.
Review the reported follow-up work, including carrying the `drizzle/` directory
through `--dir drizzle` on `cf d1 migrations` commands. Validate configuration,
Worker output, and environment bindings before cutover. While the project relies on
`wrangler.jsonc`, avoid `cf init`, `cf dev`, `cf build`, and `cf deploy`, including
`cf deploy --dry-run`. Their automatic setup can create a configuration that
ignores the existing one. [Migration guide](https://developers.cloudflare.com/cf/wrangler/migrate/)
