import type { H3Event } from 'h3'
import { getQuery, readBody } from 'h3'
import type { z } from 'zod'

import type { ApplicationOperation, OperationCapability, OperationDomain, OperationEffect, OperationRestBinding } from './types'
import type { StructuredOperationInputComponents } from './contracts'
import { structuredOperationInputSchema } from './contracts'
import { executeApplicationOperation } from './execute'
import { getStructuredOperationOutputSchema, type StructuredOperationId } from './generated-output-schemas'
import { defineApiHandler } from '#server/http/api-handler'

export interface RouteOperationDefinition {
  id: StructuredOperationId
  domain: OperationDomain
  description: string
  rest: OperationRestBinding
  input: StructuredOperationInputComponents
  output: 'data' | 'list'
  capabilities: readonly OperationCapability[]
  effect: OperationEffect
}

export function annotationsForOperationEffect(effect: OperationEffect): ApplicationOperation['annotations'] {
  return {
    readOnlyHint: effect === 'read',
    destructiveHint: effect === 'destructive' || effect === 'destructive_update' || effect === 'delete',
    idempotentHint: effect === 'read' || effect === 'update' || effect === 'destructive_update' || effect === 'delete'
  }
}

export function defineStructuredRouteOperation(
  definition: RouteOperationDefinition,
  executor: (event: H3Event) => Promise<unknown> | unknown
) {
  const inputSchema = structuredOperationInputSchema(definition.input)
  const outputSchema = getStructuredOperationOutputSchema(definition.id)
  return {
    ...definition,
    eligibleForMcp: true as const,
    annotations: annotationsForOperationEffect(definition.effect),
    inputSchema,
    outputSchema,
    async execute(event: H3Event, input: z.infer<typeof inputSchema>) {
      const previousInput = event.context.applicationOperationInput
      event.context.applicationOperationInput = input
      try {
        return await executor(event) as z.output<typeof outputSchema>
      } finally {
        event.context.applicationOperationInput = previousInput
      }
    }
  }
}

export function defineStructuredOperationApiHandler(operation: ReturnType<typeof defineStructuredRouteOperation>) {
  return defineApiHandler(async (event) => {
    const body = operation.rest.method === 'GET' ? undefined : await readBody(event)
    return await executeApplicationOperation(event, operation, {
      params: event.context.params ?? {},
      query: getQuery(event),
      body
    })
  })
}

export async function readStructuredOperationBody(event: H3Event) {
  const operationInput = event.context.applicationOperationInput as { body?: unknown } | undefined
  return operationInput ? operationInput.body : await readBody(event)
}
