import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, test } from 'vitest'

import {
  ensureDeployD1Database,
  parseD1DatabaseInfoOutput,
  parseD1DatabaseListOutput,
  writeGitHubD1DatabaseOutputs,
  type CommandRunner
} from '../../../../tools/deploy/ensure-d1-database'

const createdDatabaseId = '22222222-2222-4222-8222-222222222222'
const existingDatabaseId = '11111111-1111-4111-8111-111111111111'

let tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.map(directory => rm(directory, {
    force: true,
    recursive: true
  })))
  tempDirectories = []
})

function d1ListOutput(databases: Array<{ name: string, uuid: string, jurisdiction?: string | null }>) {
  return JSON.stringify(databases)
}

function d1InfoOutput(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    name: 'codex-events-test',
    uuid: existingDatabaseId,
    jurisdiction: 'eu',
    running_in_region: 'EEUR',
    read_replication: {
      mode: 'disabled'
    },
    ...overrides
  })
}

function createRunner(results: Array<string | Error>) {
  const calls: Array<{ command: string, args: string[] }> = []
  const runner: CommandRunner = async (command, args) => {
    calls.push({ command, args })

    const result = results.shift()

    if (result instanceof Error) {
      throw result
    }

    return {
      stdout: result ?? '',
      stderr: ''
    }
  }

  return {
    calls,
    runner
  }
}

describe('deploy D1 database provisioning', () => {
  test('parses Wrangler D1 list output', () => {
    expect(parseD1DatabaseListOutput(JSON.stringify({
      result: [
        {
          name: 'codex-events',
          uuid: existingDatabaseId
        }
      ]
    }))).toEqual([
      {
        name: 'codex-events',
        uuid: existingDatabaseId
      }
    ])
  })

  test('parses D1 info placement and replication output', () => {
    expect(parseD1DatabaseInfoOutput(JSON.stringify({
      result: {
        name: 'codex-events-test',
        uuid: existingDatabaseId,
        jurisdiction: 'eu',
        running_in_region: 'EEUR',
        read_replication: {
          mode: 'disabled'
        }
      }
    }))).toEqual({
      name: 'codex-events-test',
      uuid: existingDatabaseId,
      jurisdiction: 'eu',
      runningInRegion: 'eeur',
      readReplicationMode: 'disabled'
    })
  })

  test('returns an existing D1 database by resolved name', async () => {
    const { calls, runner } = createRunner([
      d1ListOutput([
        {
          name: 'codex-events-test',
          uuid: existingDatabaseId,
          jurisdiction: 'eu'
        }
      ]),
      d1InfoOutput()
    ])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {
        CF_D1_JURISDICTION: 'eu'
      },
      runner
    })).resolves.toEqual({
      databaseName: 'codex-events-test',
      databaseId: existingDatabaseId,
      created: false,
      placement: {
        jurisdiction: 'eu',
        runningInRegion: 'eeur',
        readReplicationMode: 'disabled'
      }
    })

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'info', 'codex-events-test', '--json']
      }
    ])
  })

  test('creates a missing D1 database and resolves its ID from the next list call', async () => {
    const { calls, runner } = createRunner([
      d1ListOutput([]),
      '',
      d1ListOutput([
        {
          name: 'codex-events-test',
          uuid: createdDatabaseId,
          jurisdiction: 'eu'
        }
      ]),
      d1InfoOutput({ uuid: createdDatabaseId })
    ])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {
        CF_D1_JURISDICTION: 'eu'
      },
      runner
    })).resolves.toEqual({
      databaseName: 'codex-events-test',
      databaseId: createdDatabaseId,
      created: true,
      placement: {
        jurisdiction: 'eu',
        runningInRegion: 'eeur',
        readReplicationMode: 'disabled'
      }
    })

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'create', 'codex-events-test', '--jurisdiction', 'eu']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'info', 'codex-events-test', '--json']
      }
    ])
  })

  test('uses the D1 name override when resolving the database', async () => {
    const { runner } = createRunner([
      d1ListOutput([
        {
          name: 'custom-d1',
          uuid: existingDatabaseId,
          jurisdiction: 'eu'
        }
      ]),
      d1InfoOutput({ name: 'custom-d1' })
    ])

    await expect(ensureDeployD1Database({
      target: 'production',
      environment: {
        CF_D1_DATABASE_NAME: 'custom-d1',
        CF_D1_JURISDICTION: 'eu'
      },
      runner
    })).resolves.toMatchObject({
      databaseName: 'custom-d1',
      databaseId: existingDatabaseId
    })
  })

  test('handles a concurrent create that succeeds in another deploy job', async () => {
    const { calls, runner } = createRunner([
      d1ListOutput([]),
      new Error('database already exists'),
      d1ListOutput([
        {
          name: 'codex-events-test',
          uuid: existingDatabaseId,
          jurisdiction: 'eu'
        }
      ]),
      d1InfoOutput()
    ])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {
        CF_D1_JURISDICTION: 'eu'
      },
      runner
    })).resolves.toEqual({
      databaseName: 'codex-events-test',
      databaseId: existingDatabaseId,
      created: false,
      placement: {
        jurisdiction: 'eu',
        runningInRegion: 'eeur',
        readReplicationMode: 'disabled'
      }
    })

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'create', 'codex-events-test', '--jurisdiction', 'eu']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'info', 'codex-events-test', '--json']
      }
    ])
  })

  test('fails closed when an existing database has the wrong placement without a destructive command', async () => {
    const { calls, runner } = createRunner([
      d1ListOutput([{
        name: 'codex-events-test',
        uuid: existingDatabaseId,
        jurisdiction: 'us'
      }]),
      d1InfoOutput({ jurisdiction: 'us' })
    ])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {
        CF_D1_JURISDICTION: 'eu'
      },
      runner
    })).rejects.toThrow('placement mismatch')

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'list', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'd1', 'info', 'codex-events-test', '--json']
      }
    ])
    expect(calls.flatMap(call => call.args)).not.toContain('delete')
    expect(calls.flatMap(call => call.args)).not.toContain('update')
  })

  test('fails closed when a location-only inspection omits the running region', async () => {
    const { runner } = createRunner([
      d1ListOutput([{
        name: 'codex-events-test',
        uuid: existingDatabaseId
      }]),
      d1InfoOutput({
        jurisdiction: null,
        running_in_region: null
      })
    ])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {
        CF_D1_PRIMARY_LOCATION_HINT: 'eeur'
      },
      runner
    })).rejects.toThrow('placement mismatch')
  })

  test('requires explicit placement before touching the D1 account', async () => {
    const { calls, runner } = createRunner([])

    await expect(ensureDeployD1Database({
      target: 'test',
      environment: {},
      runner
    })).rejects.toThrow('Set exactly one of CF_D1_JURISDICTION or CF_D1_PRIMARY_LOCATION_HINT')

    expect(calls).toEqual([])
  })

  test('writes GitHub Actions environment and output values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codex-events-d1-'))
    tempDirectories.push(directory)

    const githubEnv = join(directory, 'env')
    const githubOutput = join(directory, 'output')
    await writeGitHubD1DatabaseOutputs({
      databaseName: 'codex-events-test',
      databaseId: existingDatabaseId,
      created: false,
      placement: {
        jurisdiction: 'eu',
        runningInRegion: 'eeur',
        readReplicationMode: 'disabled'
      }
    }, {
      GITHUB_ENV: githubEnv,
      GITHUB_OUTPUT: githubOutput
    })

    await expect(readFile(githubEnv, 'utf8')).resolves.toBe(
      `RESOLVED_D1_DATABASE_ID=${existingDatabaseId}\nD1_ACTUAL_JURISDICTION=eu\nD1_ACTUAL_RUNNING_IN_REGION=eeur\nD1_READ_REPLICATION_MODE=disabled\n`
    )
    await expect(readFile(githubOutput, 'utf8')).resolves.toBe(
      `d1_database_id=${existingDatabaseId}\nd1_database_name=codex-events-test\nd1_jurisdiction=eu\nd1_running_in_region=eeur\nd1_read_replication_mode=disabled\n`
    )
  })
})
