import { afterEach, describe, expect, test, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

import { executeApplicationOperation } from '../../../../server/application/operations/execute'
import type { ApplicationOperation } from '../../../../server/application/operations/types'

describe('application operation execution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('has one shared final-envelope output-validation call', async () => {
    const source = await readFile(join(process.cwd(), 'server/application/operations/execute.ts'), 'utf8')

    expect(source.match(/validateApplicationOperationOutput\(/gu)).toHaveLength(1)
    expect(source).toContain('validateApplicationOperationOutput(operation.id, operation.outputSchema, output)')
    expect(source).not.toContain('validateWithSchema')
  })

  test('owns one operation-envelope output validation after execution', async () => {
    const inputSchema = z.object({})
    const outputSchema = z.object({ data: z.string() })
    const operation = {
      id: 'test.execute',
      domain: 'events',
      description: 'Test operation',
      rest: { method: 'GET', path: '/api/test' },
      inputSchema,
      outputSchema,
      capabilities: ['public'],
      effect: 'read',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      },
      execute: vi.fn(async () => ({ data: 'ok' }))
    } satisfies ApplicationOperation<typeof inputSchema, typeof outputSchema>
    const safeParse = vi.spyOn(outputSchema, 'safeParse')

    await expect(executeApplicationOperation({} as never, operation, {})).resolves.toEqual({ data: 'ok' })
    expect(safeParse).toHaveBeenCalledOnce()
  })

  test('reports output contract failures as sanitized internal errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const inputSchema = z.object({})
    const outputSchema = z.object({ data: z.string() })
    const operation = {
      id: 'test.output.failure',
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

    await expect(executeApplicationOperation({} as never, operation, {})).rejects.toMatchObject({
      statusCode: 500,
      code: 'internal_error',
      message: 'An unexpected error occurred.',
      details: undefined
    })
    expect(safeParse).toHaveBeenCalledOnce()
    expect(consoleErrorSpy).toHaveBeenCalledOnce()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Application operation output validation failed', {
      operationId: 'test.output.failure',
      issues: [{
        code: 'invalid_type',
        path: ['data'],
        message: expect.any(String)
      }]
    })
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain('response-private')
  })
})
