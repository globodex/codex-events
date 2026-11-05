import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { EnvironmentValues } from './generate-wrangler-config'

const execFileAsync = promisify(execFile)

export interface CommandResult {
  stdout: string
  stderr: string
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>

function readRequiredEnvironmentValue(environment: EnvironmentValues, name: string) {
  const value = environment[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required to run Wrangler.`)
  }

  return value
}

function resolveWranglerApiToken(environment: EnvironmentValues) {
  return environment.CF_MGMT_TOKEN?.trim() || readRequiredEnvironmentValue(environment, 'CF_API_TOKEN')
}

function mergeEnvironment(environment: EnvironmentValues) {
  const merged: NodeJS.ProcessEnv = { ...process.env }

  for (const [name, value] of Object.entries(environment)) {
    if (value !== undefined) {
      merged[name] = value
    }
  }

  return merged
}

export function buildWranglerEnvironment(environment: EnvironmentValues = process.env) {
  return {
    ...mergeEnvironment(environment),
    CLOUDFLARE_ACCOUNT_ID: readRequiredEnvironmentValue(environment, 'CF_ACCOUNT_ID'),
    CLOUDFLARE_API_TOKEN: resolveWranglerApiToken(environment)
  } satisfies NodeJS.ProcessEnv
}

export async function runWranglerCommand(
  args: string[],
  environment: EnvironmentValues = process.env
): Promise<CommandResult> {
  try {
    const result = await execFileAsync('bunx', ['wrangler', ...args], {
      env: buildWranglerEnvironment(environment),
      maxBuffer: 10 * 1024 * 1024
    })

    return {
      stdout: String(result.stdout),
      stderr: String(result.stderr)
    }
  } catch (error) {
    if (error && typeof error === 'object') {
      const output = [
        'stdout' in error ? String(error.stdout ?? '').trim() : '',
        'stderr' in error ? String(error.stderr ?? '').trim() : ''
      ].filter(Boolean).join('\n')

      if (output) {
        throw new Error(output, { cause: error })
      }
    }

    throw error
  }
}

export function createWranglerCommandRunner(environment: EnvironmentValues = process.env): CommandRunner {
  return (command, args) => {
    if (command !== 'bunx' || args[0] !== 'wrangler') {
      throw new Error(`Unsupported deploy command: ${command} ${args.join(' ')}`)
    }

    return runWranglerCommand(args.slice(1), environment)
  }
}
