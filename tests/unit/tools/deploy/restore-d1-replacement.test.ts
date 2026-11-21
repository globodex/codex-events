import { describe, expect, test } from 'vitest'

import {
  assertReplacementWranglerConfig,
  buildD1RestorePlan,
  buildReplacementWranglerConfig,
  parseD1RestoreInfo,
  restoreD1Replacement,
  type D1RestorePlan,
  type RestoreD1ReplacementOptions,
  type SqlFileSystem
} from '../../../../tools/deploy/restore-d1-replacement'
import type { CommandRunner } from '../../../../tools/deploy/wrangler-command'

const sourceDatabaseId = '11111111-1111-4111-8111-111111111111'
const replacementDatabaseId = '22222222-2222-4222-8222-222222222222'
const exportPath = '/secure/recovery/codex-events.sql'
const configPath = '/secure/recovery/wrangler.jsonc'
const replacementConfigPath = '/secure/recovery/wrangler.replacement.jsonc'
const restoreSqlPath = '/secure/recovery/codex-events.restore.sql'
const replacementExportPath = '/secure/recovery/codex-events.replacement.sql'
const migrationNames = ['0000_test.sql', '0001_follow-up.sql']
const migrationStateQuery = 'SELECT name FROM d1_migrations ORDER BY id;'

const baseConfig = JSON.stringify({
  name: 'codex-events-test',
  d1_databases: [{
    binding: 'DB',
    database_name: 'codex-events-source',
    database_id: sourceDatabaseId,
    migrations_dir: '../../drizzle'
  }]
})

const authExport = `
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE "parent" ("id" text PRIMARY KEY NOT NULL);
CREATE TABLE "child" (
  "id" text PRIMARY KEY NOT NULL,
  "parent_id" text NOT NULL REFERENCES "parent"("id"),
  "payload" text NOT NULL
);
CREATE TABLE "cycle_a" (
  "id" text PRIMARY KEY NOT NULL,
  "cycle_b_id" text NOT NULL REFERENCES "cycle_b"("id")
);
CREATE TABLE "cycle_b" (
  "id" text PRIMARY KEY NOT NULL,
  "cycle_a_id" text NOT NULL REFERENCES "cycle_a"("id")
);
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "auth0_subject" text NOT NULL,
  "email" text NOT NULL,
  "created_at" text NOT NULL,
  "deleted_at" text
);
CREATE TABLE "user_auth_identities" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "auth0_subject" text NOT NULL,
  "created_at" text NOT NULL
);
CREATE TABLE "d1_migrations" ("id" integer PRIMARY KEY, "name" text, "applied_at" integer);
INSERT INTO "user_auth_identities" VALUES ('user_auth_identity_user_1', 'user-1', 'auth0|primary', '2026-01-01');
INSERT INTO "user_auth_identities" VALUES ('secondary-identity', 'user-1', 'google-oauth2|secondary', '2026-01-02');
INSERT INTO "users" VALUES ('user-1', 'auth0|primary', 'primary@example.com', '2026-01-01', NULL);
INSERT INTO "parent" VALUES ('parent-1');
INSERT INTO "child" VALUES ('child-1', 'parent-1', 'contains;semicolon');
INSERT INTO "cycle_a" VALUES ('cycle-a', 'cycle-b');
INSERT INTO "cycle_b" VALUES ('cycle-b', 'cycle-a');
INSERT INTO "d1_migrations" VALUES (0, '0000_test.sql', 1), (1, '0001_follow-up.sql', 2);
CREATE TRIGGER "users_insert_primary_auth_identity"
AFTER INSERT ON "users"
WHEN NEW."deleted_at" IS NULL
BEGIN
  INSERT OR IGNORE INTO "user_auth_identities" ("id", "user_id", "auth0_subject", "created_at")
  VALUES ('user_auth_identity_' || replace(NEW."id", '-', '_'), NEW."id", NEW."auth0_subject", NEW."created_at");
END;
COMMIT;
`

function infoOutput(name: string, uuid: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    result: {
      name,
      uuid,
      jurisdiction: 'eu',
      running_in_region: 'eeur',
      database_size: 811008,
      read_replication: { mode: 'disabled' },
      ...overrides
    }
  })
}

function rowsOutput(rows: Record<string, unknown>[]) {
  return JSON.stringify({ result: [{ results: rows }] })
}

function countRows(plan: D1RestorePlan, tableIndex: number, zero = false) {
  return plan.tables
    .slice(tableIndex * 4, (tableIndex + 1) * 4)
    .map(table => ({
      table_name: table.name,
      row_count: zero ? 0 : table.rowCount
    }))
}

function createFileSystem() {
  const files = new Map<string, string>([
    [exportPath, authExport],
    [configPath, baseConfig]
  ])
  const fileSystem: SqlFileSystem = {
    readFile: async (path) => {
      const contents = files.get(path)

      if (contents === undefined) {
        throw new Error(`Missing fixture file ${path}`)
      }

      return contents
    },
    writeFile: async (path, contents) => {
      files.set(path, contents)
    }
  }

  return { files, fileSystem }
}

function createOptions(overrides: Partial<RestoreD1ReplacementOptions> = {}): RestoreD1ReplacementOptions {
  return {
    sourceDatabase: 'codex-events-source',
    sourceDatabaseId,
    replacementDatabase: 'codex-events-eu',
    replacementDatabaseId,
    exportPath,
    configPath,
    restoreSqlPath,
    replacementExportPath,
    placement: { jurisdiction: 'eu' },
    migrationNames,
    apply: true,
    ...overrides
  }
}

function createMockRunner(plan: D1RestorePlan, fileSystem: SqlFileSystem, replacementExport = authExport) {
  const calls: Array<{ command: string, args: string[] }> = []
  const countResponses = [
    ...plan.sourceCountChunks.map((_, index) => rowsOutput(countRows(plan, index))),
    ...plan.emptyCountChunks.map((_, index) => rowsOutput(countRows(plan, index, true))),
    ...plan.replacementCountChunks.map((_, index) => rowsOutput(countRows(plan, index)))
  ]
  let countIndex = 0
  const runner: CommandRunner = async (command, args) => {
    calls.push({ command, args })
    const database = args[3]
    const subcommand = args[2]

    if (subcommand === 'info') {
      return {
        stdout: database === 'codex-events-source'
          ? infoOutput(database, sourceDatabaseId)
          : infoOutput(database, replacementDatabaseId),
        stderr: ''
      }
    }

    if (subcommand === 'export') {
      if (database === 'codex-events-eu') {
        await fileSystem.writeFile(replacementExportPath, replacementExport)
      }
      return { stdout: '', stderr: '' }
    }

    if (subcommand === 'migrations') {
      return { stdout: '', stderr: '' }
    }

    if (subcommand !== 'execute') {
      throw new Error(`Unexpected command ${args.join(' ')}`)
    }

    if (args.includes('--file')) {
      expect(args[args.indexOf('--file') + 1]).toBe(restoreSqlPath)
      expect(await fileSystem.readFile(restoreSqlPath)).toContain('PRAGMA defer_foreign_keys = ON;')
      return { stdout: '', stderr: '' }
    }

    const query = args.includes('--command') ? args[args.indexOf('--command') + 1] : undefined

    if (query === migrationStateQuery) {
      return { stdout: rowsOutput(migrationNames.map(name => ({ name }))), stderr: '' }
    }

    if (query?.includes('sqlite_schema')) {
      return { stdout: rowsOutput([]), stderr: '' }
    }

    if (query === 'PRAGMA foreign_key_check;') {
      return { stdout: rowsOutput([]), stderr: '' }
    }

    if (query === 'PRAGMA quick_check;') {
      return { stdout: rowsOutput([{ quick_check: 'ok' }]), stderr: '' }
    }

    return { stdout: countResponses[countIndex++]!, stderr: '' }
  }

  return { calls, runner }
}

describe('D1 replacement restore planning', () => {
  test('patches a temporary UUID-pinned Wrangler config and fails closed on ambiguity', () => {
    const replacement = buildReplacementWranglerConfig(baseConfig, 'codex-events-eu', replacementDatabaseId)
    const parsed = JSON.parse(replacement) as { d1_databases: Array<Record<string, unknown>> }

    expect(parsed.d1_databases).toEqual([expect.objectContaining({
      database_name: 'codex-events-eu',
      database_id: replacementDatabaseId,
      migrations_dir: '../../drizzle'
    })])
    expect(() => assertReplacementWranglerConfig(baseConfig, 'codex-events-eu', replacementDatabaseId)).toThrow('must bind')
    expect(() => buildReplacementWranglerConfig(JSON.stringify({ d1_databases: [] }), 'codex-events-eu', replacementDatabaseId)).toThrow('exactly one')
    expect(() => buildReplacementWranglerConfig('{ // comment\n}', 'codex-events-eu', replacementDatabaseId)).toThrow('JSON-compatible')
  })

  test('parses placement, replication, and size evidence from Wrangler info', () => {
    expect(parseD1RestoreInfo(infoOutput('codex-events-eu', replacementDatabaseId))).toEqual({
      name: 'codex-events-eu',
      uuid: replacementDatabaseId,
      jurisdiction: 'eu',
      runningInRegion: 'eeur',
      readReplicationMode: 'disabled',
      size: 811008
    })
  })
})

describe('D1 replacement restore execution boundary', () => {
  test('dry run parses the export without invoking a command runner', async () => {
    const { fileSystem } = createFileSystem()
    let called = false

    const result = await restoreD1Replacement(createOptions({
      apply: false,
      runner: async () => {
        called = true
        return { stdout: '', stderr: '' }
      },
      fileSystem
    }))

    expect(result.dryRun).toBe(true)
    expect(result.bindingSwitchPermitted).toBe(false)
    expect(result.plan.rowCount).toBe(7)
    expect(result.replacementExportPath).toBe(replacementExportPath)
    expect(called).toBe(false)
  })

  test('permits binding guidance only after bounded checks and canonical export comparison pass', async () => {
    const { fileSystem, files } = createFileSystem()
    const plan = buildD1RestorePlan(authExport)
    const { calls, runner } = createMockRunner(plan, fileSystem)

    const result = await restoreD1Replacement(createOptions({ runner, fileSystem }))

    expect(result.bindingSwitchPermitted).toBe(true)
    expect(files.get(replacementConfigPath)).toContain(replacementDatabaseId)
    expect(files.get(restoreSqlPath)).toContain('PRAGMA defer_foreign_keys = ON;')
    expect(files.get(replacementExportPath)).toBe(authExport)
    expect(calls.some(call => call.args.includes('delete'))).toBe(false)
    expect(calls.some(call => call.args.includes('codex-events-source') && call.args.includes('--file'))).toBe(false)
    expect(calls.some(call => call.args.includes('codex-events-eu') && call.args.includes('export'))).toBe(true)
  })

  test('fails closed on placement mismatch before applying migrations', async () => {
    const { fileSystem } = createFileSystem()
    const plan = buildD1RestorePlan(authExport)
    const { calls, runner } = createMockRunner(plan, fileSystem)
    const mismatchRunner: CommandRunner = async (command, args) => {
      if (args[2] === 'info' && args[3] === 'codex-events-eu') {
        return { stdout: infoOutput('codex-events-eu', replacementDatabaseId, { jurisdiction: 'fedramp' }), stderr: '' }
      }

      return runner(command, args)
    }

    await expect(restoreD1Replacement(createOptions({ runner: mismatchRunner, fileSystem }))).rejects.toThrow('placement mismatch')
    expect(calls.some(call => call.args.includes('apply'))).toBe(false)
  })

  test('fails closed when the replacement canonical export differs', async () => {
    const { fileSystem } = createFileSystem()
    const plan = buildD1RestorePlan(authExport)
    const { runner } = createMockRunner(plan, fileSystem, authExport.replace('secondary-identity', 'different-identity'))

    await expect(restoreD1Replacement(createOptions({ runner, fileSystem }))).rejects.toThrow('canonical export mismatch')
  })

  test('fails closed on a non-empty replacement and keeps the source as rollback target', async () => {
    const { fileSystem } = createFileSystem()
    const plan = buildD1RestorePlan(authExport)
    const { calls, runner } = createMockRunner(plan, fileSystem)
    const nonEmptyRunner: CommandRunner = async (command, args) => {
      const query = args.includes('--command') ? args[args.indexOf('--command') + 1] : undefined

      if (query?.includes('sqlite_schema')) {
        return { stdout: rowsOutput([{ name: 'users' }]), stderr: '' }
      }

      return runner(command, args)
    }

    await expect(restoreD1Replacement(createOptions({ runner: nonEmptyRunner, fileSystem }))).rejects.toThrow('not empty')
    expect(calls.some(call => call.args.includes('apply'))).toBe(false)
  })
})
