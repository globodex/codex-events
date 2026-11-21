import { describe, expect, test } from 'vitest'

import {
  ensureDeployR2Buckets,
  type CommandRunner
} from '../../../../tools/deploy/ensure-r2-buckets'

function r2InfoOutput(bucketName: string) {
  return JSON.stringify({
    name: bucketName,
    created: '2026-05-30T00:00:00.000Z',
    location: '(unknown)',
    default_storage_class: 'Standard',
    object_count: '0',
    bucket_size: '0 B'
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

describe('deploy R2 bucket provisioning', () => {
  test('returns existing R2 buckets by resolved names', async () => {
    const { calls, runner } = createRunner([
      r2InfoOutput('codex-events-test-profile-icons'),
      r2InfoOutput('codex-events-test-event-images')
    ])

    await expect(ensureDeployR2Buckets({
      target: 'test',
      environment: {},
      runner
    })).resolves.toEqual([
      {
        binding: 'PROFILE_ICONS',
        bucketName: 'codex-events-test-profile-icons',
        created: false
      },
      {
        binding: 'EVENT_IMAGES',
        bucketName: 'codex-events-test-event-images',
        created: false
      }
    ])

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-test-profile-icons', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-test-event-images', '--json']
      }
    ])
  })

  test('creates missing R2 buckets and verifies them afterward', async () => {
    const { calls, runner } = createRunner([
      new Error('bucket not found'),
      new Error('bucket not found'),
      '',
      '',
      r2InfoOutput('codex-events-prod-profile-icons'),
      r2InfoOutput('codex-events-prod-event-images')
    ])

    await expect(ensureDeployR2Buckets({
      target: 'production',
      environment: {},
      runner
    })).resolves.toEqual([
      {
        binding: 'PROFILE_ICONS',
        bucketName: 'codex-events-prod-profile-icons',
        created: true
      },
      {
        binding: 'EVENT_IMAGES',
        bucketName: 'codex-events-prod-event-images',
        created: true
      }
    ])

    expect(calls).toEqual([
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-prod-profile-icons', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-prod-event-images', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'create', 'codex-events-prod-profile-icons']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'create', 'codex-events-prod-event-images']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-prod-profile-icons', '--json']
      },
      {
        command: 'bunx',
        args: ['wrangler', 'r2', 'bucket', 'info', 'codex-events-prod-event-images', '--json']
      }
    ])
  })

  test('uses R2 bucket name overrides when resolving buckets', async () => {
    const { runner } = createRunner([
      r2InfoOutput('custom-profile-icons'),
      r2InfoOutput('custom-event-images')
    ])

    await expect(ensureDeployR2Buckets({
      target: 'production',
      environment: {
        CF_PROFILE_ICONS_BUCKET: 'custom-profile-icons',
        CF_EVENT_IMAGES_BUCKET: 'custom-event-images'
      },
      runner
    })).resolves.toEqual([
      {
        binding: 'PROFILE_ICONS',
        bucketName: 'custom-profile-icons',
        created: false
      },
      {
        binding: 'EVENT_IMAGES',
        bucketName: 'custom-event-images',
        created: false
      }
    ])
  })

  test('handles a concurrent create that succeeds in another deploy job', async () => {
    const { calls, runner } = createRunner([
      new Error('bucket not found'),
      r2InfoOutput('codex-events-test-event-images'),
      new Error('bucket already exists'),
      r2InfoOutput('codex-events-test-profile-icons')
    ])

    await expect(ensureDeployR2Buckets({
      target: 'test',
      environment: {},
      runner
    })).resolves.toEqual([
      {
        binding: 'PROFILE_ICONS',
        bucketName: 'codex-events-test-profile-icons',
        created: false
      },
      {
        binding: 'EVENT_IMAGES',
        bucketName: 'codex-events-test-event-images',
        created: false
      }
    ])

    expect(calls).toHaveLength(4)
  })

  test('rejects unexpected bucket info output', async () => {
    const { runner } = createRunner([
      '{}',
      r2InfoOutput('codex-events-test-event-images')
    ])

    await expect(ensureDeployR2Buckets({
      target: 'test',
      environment: {},
      runner
    })).rejects.toThrow('unexpected bucket record')
  })
})
