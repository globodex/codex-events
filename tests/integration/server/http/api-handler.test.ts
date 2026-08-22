import { afterEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

import { executeApplicationOperation } from '../../../../server/application/operations/execute'
import type { ApplicationOperation } from '../../../../server/application/operations/types'
import { defineApiHandler } from '../../../../server/http/api-handler'
import { ApiError } from '../../../../server/http/api-error'
import { createApiRouteTestHarness } from '../../../support/backend/api-route'

describe('api handler error responses', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('sanitizes unexpected errors and logs them server-side', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/test-error',
          handler: defineApiHandler(() => {
            throw new Error('database exploded')
          })
        }
      ]
    })

    const response = await harness.request('/api/test-error')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred.'
      }
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith('Unhandled API error', expect.objectContaining({
      method: 'GET',
      url: '/api/test-error',
      error: expect.objectContaining({
        message: 'database exploded'
      })
    }))
  })

  test('preserves explicit ApiError responses without logging them as unexpected', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/test-api-error',
          handler: defineApiHandler(() => {
            throw new ApiError({
              statusCode: 409,
              code: 'invalid_state',
              message: 'Already locked.',
              details: {
                state: 'submitted'
              }
            })
          })
        }
      ]
    })

    const response = await harness.request('/api/test-api-error')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: {
        code: 'invalid_state',
        message: 'Already locked.',
        details: {
          state: 'submitted'
        }
      }
    })
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  test('returns generic internal error semantics for an operation output contract failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const inputSchema = z.object({})
    const outputSchema = z.object({ data: z.string() })
    const operation = {
      id: 'test.http-output-failure',
      domain: 'events',
      description: 'Test operation',
      rest: { method: 'GET', path: '/api/test-output-failure' },
      inputSchema,
      outputSchema,
      capabilities: ['public'],
      effect: 'read',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      },
      execute: vi.fn(async () => ({ data: { secret: 'response-private' } } as unknown as z.output<typeof outputSchema>))
    } satisfies ApplicationOperation<typeof inputSchema, typeof outputSchema>
    const safeParse = vi.spyOn(outputSchema, 'safeParse')
    const harness = createApiRouteTestHarness({
      routes: [
        {
          method: 'get',
          path: '/api/test-output-failure',
          handler: defineApiHandler(event => executeApplicationOperation(event, operation, {}))
        }
      ]
    })

    const response = await harness.request('/api/test-output-failure')

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred.'
      }
    })
    expect(safeParse).toHaveBeenCalledOnce()
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Application operation output validation failed', {
      operationId: 'test.http-output-failure',
      issues: [{
        code: 'invalid_type',
        path: ['data'],
        message: expect.any(String)
      }]
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('response-private')
  })
})
