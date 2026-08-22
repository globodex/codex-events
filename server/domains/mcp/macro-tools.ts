import { z } from 'zod'

import {
  operationDomains,
  type ApplicationOperation,
  type OperationAnnotations,
  type OperationDomain
} from '#server/application/operations/types'
import { ApiError } from '#server/http/api-error'

export const mcpMacroDomains = operationDomains
export const mcpMacroKinds = ['read', 'upsert'] as const

export type McpMacroDomain = OperationDomain
export type McpMacroKind = (typeof mcpMacroKinds)[number]
export type McpMacroToolName = `${McpMacroDomain}_${McpMacroKind}`

export interface McpMacroTool {
  name: McpMacroToolName
  description: string
  operations: ApplicationOperation[]
  inputSchema: z.ZodTypeAny
  annotations: OperationAnnotations
}

const macroDescriptions: Record<McpMacroToolName, string> = {
  events_read: 'Read events, public event information, and event-builder guidance.',
  events_upsert: 'Create events or update event details and lifecycle state.',
  participation_read: 'Read applications, teams, submissions, talks, credits, prizes, and account workspaces.',
  participation_upsert: 'Manage applications, teams, submissions, talks, credits, prizes, and profile details.',
  judging_read: 'Read judging assignments, criteria, rankings, finalists, pitches, and winners.',
  judging_upsert: 'Score, assign, shortlist, deliberate, and manage judging outcomes.',
  administration_read: 'Read platform settings, event roles, terms, audits, staff, and operational records.',
  administration_upsert: 'Manage platform settings, event roles, terms, staff, media, and operational records.'
}

function macroInputSchema(actionIds: string[]) {
  const actions = actionIds as [string, ...string[]]
  return z.object({
    action: z.enum(actions).describe('The exact authorized operation to use.'),
    input: z.record(z.string(), z.unknown()).optional()
      .describe('The operation input. Omit it to inspect the exact field schema; pass an object to execute the action.')
  }).strict()
}

function macroAnnotations(kind: McpMacroKind, operations: ApplicationOperation[]): OperationAnnotations {
  if (kind === 'read') {
    return { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }
  return {
    readOnlyHint: false,
    destructiveHint: operations.some(operation => operation.annotations.destructiveHint),
    idempotentHint: operations.every(operation => operation.annotations.idempotentHint)
  }
}

export function createMcpMacroTools(operations: ApplicationOperation[]): McpMacroTool[] {
  const groups = new Map<McpMacroToolName, ApplicationOperation[]>()
  for (const operation of operations) {
    const kind = operation.effect === 'read' ? 'read' : 'upsert'
    const name = `${operation.domain}_${kind}` as McpMacroToolName
    const group = groups.get(name) ?? []
    group.push(operation)
    groups.set(name, group)
  }

  return mcpMacroDomains.flatMap(domain => mcpMacroKinds.flatMap((kind) => {
    const name = `${domain}_${kind}` as McpMacroToolName
    const group = groups.get(name)?.toSorted((left, right) => left.id.localeCompare(right.id)) ?? []
    if (group.length === 0) return []
    return [{
      name,
      description: `${macroDescriptions[name]} Omit input to inspect the selected action's exact schema.`,
      operations: group,
      inputSchema: macroInputSchema(group.map(operation => operation.id)),
      annotations: macroAnnotations(kind, group)
    }]
  }))
}

export function findMcpMacroAction(macro: McpMacroTool, action: unknown) {
  return typeof action === 'string'
    ? macro.operations.find(operation => operation.id === action)
    : undefined
}

export function describeMcpMacroAction(operation: ApplicationOperation) {
  return {
    action: operation.id,
    description: operation.description,
    effect: operation.effect,
    inputSchema: z.toJSONSchema(operation.inputSchema)
  }
}

export function validateMcpMacroActionInput(operation: ApplicationOperation, input: unknown) {
  const result = operation.inputSchema.safeParse(input)
  if (result.success) return result.data

  throw new ApiError({
    statusCode: 400,
    code: 'invalid_request',
    message: `The input for action ${operation.id} did not match the expected schema.`,
    details: {
      action: operation.id,
      issues: result.error.issues.map(issue => ({
        code: issue.code,
        path: issue.path,
        message: issue.message
      }))
    }
  })
}
