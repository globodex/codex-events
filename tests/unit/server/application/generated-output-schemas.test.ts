import { afterEach, describe, expect, test, vi } from 'vitest'

import { mcpEligibilityManifest } from '../../../../server/application/operations/eligibility-manifest'

describe('generated structured operation output schemas', () => {
  afterEach(() => {
    vi.doUnmock('zod')
    vi.resetModules()
  })

  test('constructs only selected schemas and caches each selection in a fresh module', async () => {
    vi.resetModules()
    const fromJSONSchema = vi.fn()
    vi.doMock('zod', async () => {
      const actual = await vi.importActual<typeof import('zod')>('zod')
      fromJSONSchema.mockImplementation(actual.z.fromJSONSchema)
      return {
        ...actual,
        z: {
          ...actual.z,
          fromJSONSchema
        }
      }
    })

    const schemas = await import('../../../../server/application/operations/generated-output-schemas')

    expect(fromJSONSchema).not.toHaveBeenCalled()

    const overview = schemas.getStructuredOperationOutputSchema('get.account.overview')
    expect(fromJSONSchema).toHaveBeenCalledTimes(1)
    expect(schemas.getStructuredOperationOutputSchema('get.account.overview')).toBe(overview)
    expect(fromJSONSchema).toHaveBeenCalledTimes(1)

    const events = schemas.getStructuredOperationOutputSchema('get.events')
    expect(events).not.toBe(overview)
    expect(fromJSONSchema).toHaveBeenCalledTimes(2)
    const includedCount = mcpEligibilityManifest.filter(entry => entry.disposition === 'include').length
    expect(Object.keys(schemas.structuredOperationOutputSchemaFactories)).toHaveLength(includedCount)
  })
})
