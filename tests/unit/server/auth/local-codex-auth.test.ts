import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

import { describe, expect, test, vi } from 'vitest'

import { authenticateWithCodex } from '../../../../server/auth/local-codex-auth'

function createProcess() {
  const process = new EventEmitter() as EventEmitter & {
    stdin: PassThrough
    stdout: PassThrough
    kill: ReturnType<typeof vi.fn>
  }

  process.stdin = new PassThrough()
  process.stdout = new PassThrough()
  process.kill = vi.fn()

  return process
}

function createSuccessfulSpawn(email: string | null) {
  const loginProcess = createProcess()
  const appServerProcess = createProcess()
  const appServerRequests: Array<{
    id?: number
    method?: string
    params?: Record<string, unknown>
  }> = []
  const spawn = vi.fn()
    .mockImplementationOnce(() => {
      queueMicrotask(() => loginProcess.emit('close', 0))
      return loginProcess
    })
    .mockImplementationOnce(() => {
      appServerProcess.stdin.on('data', (chunk) => {
        for (const line of chunk.toString().trim().split('\n')) {
          const message = JSON.parse(line) as {
            id?: number
            method?: string
            params?: Record<string, unknown>
          }

          appServerRequests.push(message)

          if (message.id === 1) {
            appServerProcess.stdout.write(`${JSON.stringify({
              id: 1,
              result: {}
            })}\n`)
          }

          if (message.id === 2) {
            appServerProcess.stdout.write(`${JSON.stringify({
              id: 2,
              result: {
                account: {
                  type: 'chatgpt',
                  email,
                  planType: 'pro'
                },
                requiresOpenaiAuth: true
              }
            })}\n`)
          }
        }
      })

      return appServerProcess
    })

  return {
    spawn,
    appServerProcess,
    appServerRequests
  }
}

describe('Codex account authentication', () => {
  test('runs Codex login and returns the app-server ChatGPT email', async () => {
    const {
      spawn,
      appServerProcess,
      appServerRequests
    } = createSuccessfulSpawn(' Developer@Example.COM ')

    await expect(authenticateWithCodex({ spawn: spawn as never })).resolves.toMatchObject({
      sub: 'local-chatgpt|developer@example.com',
      email: 'developer@example.com',
      email_verified: true
    })
    expect(spawn).toHaveBeenNthCalledWith(1, 'codex', ['login'], expect.any(Object))
    expect(spawn).toHaveBeenNthCalledWith(2, 'codex', ['app-server', '--stdio'], expect.any(Object))
    expect(appServerRequests).toContainEqual({
      id: 2,
      method: 'account/read',
      params: {
        refreshToken: false
      }
    })
    expect(appServerProcess.kill).toHaveBeenCalled()
  })

  test('rejects a ChatGPT account without an email', async () => {
    const { spawn } = createSuccessfulSpawn(null)

    await expect(authenticateWithCodex({ spawn: spawn as never })).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Codex Events could not read your ChatGPT account. Run `codex login` and try again.'
    })
  })
})
