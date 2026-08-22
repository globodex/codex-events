import type { H3Event } from 'h3'
import type { z } from 'zod'

export const operationCapabilities = [
  'public',
  'platform_account',
  'platform_user',
  'event_organizer',
  'event_judge',
  'event_staff',
  'event_admin',
  'platform_admin'
] as const

export type OperationCapability = (typeof operationCapabilities)[number]

export const operationDomains = ['events', 'participation', 'judging', 'administration'] as const

export type OperationDomain = (typeof operationDomains)[number]

export interface OperationAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
}

export const operationEffects = [
  'read',
  'create',
  'update',
  'action',
  'destructive_update',
  'destructive',
  'delete'
] as const

export type OperationEffect = (typeof operationEffects)[number]

export interface OperationRestBinding {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
}

export interface RouteApplicationOperation<TInputSchema extends z.ZodType = z.ZodType, TOutputSchema extends z.ZodType = z.ZodType> extends ApplicationOperation<TInputSchema, TOutputSchema> {
  eligibleForMcp: true
}

export interface ApplicationOperation<TInputSchema extends z.ZodTypeAny = z.ZodTypeAny, TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string
  domain: OperationDomain
  description: string
  rest: OperationRestBinding
  inputSchema: TInputSchema
  outputSchema: TOutputSchema
  capabilities: readonly OperationCapability[]
  effect: OperationEffect
  annotations: OperationAnnotations
  execute: (event: H3Event, input: z.output<TInputSchema>) => Promise<z.output<TOutputSchema>>
}

export function defineApplicationOperation<const TOperation extends ApplicationOperation>(operation: TOperation) {
  return operation
}
