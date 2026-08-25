import { describe, expect, test, vi } from 'vitest'

import type {
  WebMcpModelContext,
  WebMcpTool
} from '../../../../app/composables/useWebMcpTool'
import { createWebMcpToolRegistrationLifecycle } from '../../../../app/composables/useWebMcpTool'

function createTool(name: string): WebMcpTool {
  return {
    name,
    description: `Use ${name}.`,
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    execute: async () => ({ name })
  }
}

describe('WebMCP tool registration lifecycle', () => {
  test('is a quiet no-op when the browser does not support WebMCP', () => {
    const lifecycle = createWebMcpToolRegistrationLifecycle()

    expect(() => lifecycle.setTool(createTool('unsupported'))).not.toThrow()
    expect(() => lifecycle.dispose()).not.toThrow()
  })

  test('registers a tool and removes it during cleanup', () => {
    const signals: AbortSignal[] = []
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn((_tool, options) => {
        signals.push(options!.signal!)
      })
    }
    const lifecycle = createWebMcpToolRegistrationLifecycle(modelContext)

    lifecycle.setTool(createTool('get_event_details'))

    expect(modelContext.registerTool).toHaveBeenCalledOnce()
    expect(signals[0]?.aborted).toBe(false)

    lifecycle.dispose()

    expect(signals[0]?.aborted).toBe(true)
  })

  test('replaces the active registration without leaving the old tool active', () => {
    const signals: AbortSignal[] = []
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn((_tool, options) => {
        signals.push(options!.signal!)
      })
    }
    const lifecycle = createWebMcpToolRegistrationLifecycle(modelContext)

    lifecycle.setTool(createTool('first'))
    lifecycle.setTool(createTool('second'))

    expect(modelContext.registerTool).toHaveBeenCalledTimes(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)
  })

  test('removes the tool when reactive authority resolves to unavailable', () => {
    const signals: AbortSignal[] = []
    const modelContext: WebMcpModelContext = {
      registerTool: vi.fn((_tool, options) => {
        signals.push(options!.signal!)
      })
    }
    const lifecycle = createWebMcpToolRegistrationLifecycle(modelContext)

    lifecycle.setTool(createTool('create_event'))
    lifecycle.setTool(null)

    expect(signals[0]?.aborted).toBe(true)
    expect(modelContext.registerTool).toHaveBeenCalledOnce()
  })
})
