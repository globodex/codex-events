import type { H3Event } from 'h3'
import { z } from 'zod'

import { apiData } from '#server/http/api-response'
import {
  resolveJudgeAssignmentAuthorization,
  type EventAuthorization,
  type JudgeAssignmentAuthorization
} from '#server/auth/authorization'
import { measureRequestPhase } from '#server/http/request-timing'
import { parseValidatedQuery } from '#server/http/validation'
import { routeSlugParamsSchema } from '#server/domains/events'
import {
  accountEventPageNames,
  accountEventPagePaths,
  accountJudgeAssignmentWorkspaceRoutePath,
  normalizeAccountEventPageQuery,
  participantListMaxRows,
  participantListStep,
  participantSearchMaxLength,
  type AccountEventPageName,
  type AccountEventPageQuery
} from '#shared/domains/events/account-event-page-registry'
import {
  resolveAccountEventPageContext,
  type AccountEventPageContext,
  type AccountEventPageEventRecord
} from './account-event-page-context'
import { loadAccountEventPageShell } from './account-event-page-shell'
import type { AccountEventPageShell } from '#shared/domains/events/account-event-page-shell'

export {
  accountEventPageNames,
  accountEventPagePaths,
  accountJudgeAssignmentWorkspaceRoutePath,
  type AccountEventPageName,
  type AccountEventPageQuery
}

export const accountEventPageParamsSchema = routeSlugParamsSchema.extend({
  page: z.enum(accountEventPageNames)
})

export const accountEventPageQuerySchema = z.object({
  selectedTeamSlug: z.string().trim().toLowerCase().min(1).max(120).optional(),
  participantSearch: z.string().trim().min(1).max(participantSearchMaxLength).optional(),
  participantRows: z.coerce.number().int().min(participantListStep).max(participantListMaxRows).optional(),
  includeAdminEventConfiguration: z.coerce.boolean().optional(),
  includeEventShell: z.union([z.boolean(), z.stringbool({ truthy: ['true'], falsy: ['false'] })]).optional()
}).passthrough()

export type AccountEventPageEvent = Pick<
  AccountEventPageEventRecord,
  'id' | 'slug' | 'name' | 'eventType' | 'state'
>

export interface AccountEventPageVisibility {
  canManage: boolean
  canJudge: boolean
  canViewParticipantsAndTeams: boolean
  isStaff: boolean
}

export interface AccountEventPageResponse<TPage> {
  event: AccountEventPageEvent
  visibility: AccountEventPageVisibility
  page: TPage
  shell?: AccountEventPageShell
}

export type AccountEventEntryPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventPrizesPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventOperationsPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventSubmissionsPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventJudgingPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventSettingsPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventParticipantsPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventWorkspacePage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventTeamsPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventRostersPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventGalleryPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventFeedbackPage<TPage> = AccountEventPageResponse<TPage>
export type AccountEventCertificatesPage<TPage> = AccountEventPageResponse<TPage>

export const accountEventPageRoutePaths = accountEventPagePaths

export type AccountEventPageLoader<TSchema extends z.ZodTypeAny> = (
  context: AccountEventPageContext,
  query: AccountEventPageQuery
) => z.input<TSchema> | Promise<z.input<TSchema>>

/**
 * Child routes assert page-specific access from the already-resolved context.
 * The callback receives no H3 event and must not resolve actor, authorization,
 * database, or another HTTP endpoint.
 */
export type AccountEventPageAuthorizer = (
  context: AccountEventPageContext
) => void | Promise<void>

export interface AccountEventPageRouteDefinition<
  TPageName extends AccountEventPageName,
  TSchema extends z.ZodTypeAny
> {
  page: TPageName
  schema: TSchema
  authorize: AccountEventPageAuthorizer
  load: AccountEventPageLoader<TSchema>
}

export function defineAccountEventPageRoute<
  TPageName extends AccountEventPageName,
  TSchema extends z.ZodTypeAny
>(
  definition: AccountEventPageRouteDefinition<TPageName, TSchema>
) {
  return definition
}

function toPageEvent(event: AccountEventPageEventRecord): AccountEventPageEvent {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    eventType: event.eventType,
    state: event.state
  }
}

function toPageVisibility(authorization: EventAuthorization): AccountEventPageVisibility {
  return {
    canManage: authorization.isEventAdmin,
    canJudge: authorization.canReviewThroughAssignment,
    canViewParticipantsAndTeams: authorization.canViewParticipantsAndTeams,
    isStaff: authorization.isStaff
  }
}

export async function executeAccountEventPageRoute<
  TPageName extends AccountEventPageName,
  TSchema extends z.ZodTypeAny
>(
  h3Event: H3Event,
  slug: string,
  definition: AccountEventPageRouteDefinition<TPageName, TSchema>
) {
  const params = accountEventPageParamsSchema.parse({
    slug,
    page: definition.page
  })
  const query = normalizeAccountEventPageQuery(
    parseValidatedQuery(h3Event, accountEventPageQuerySchema)
  )
  const context = await resolveAccountEventPageContext(h3Event, params.slug)
  await measureRequestPhase(h3Event, 'authorization', () => definition.authorize(context))
  const [pageResult, shell] = await measureRequestPhase(
    h3Event,
    'd1',
    () => Promise.all([
      definition.load(context, query),
      query.includeEventShell ? loadAccountEventPageShell(context) : Promise.resolve(undefined)
    ])
  )

  return await measureRequestPhase(h3Event, 'serialization', () => {
    const page = definition.schema.parse(pageResult)

    return apiData<AccountEventPageResponse<z.output<TSchema>>>({
      event: toPageEvent(context.event),
      visibility: toPageVisibility(context.authorization),
      page,
      ...(shell ? { shell } : {})
    })
  })
}

export interface AccountJudgeAssignmentPageContext extends AccountEventPageContext {
  assignmentAuthorization: JudgeAssignmentAuthorization
}

export type AccountJudgeAssignmentPageAuthorizer = (
  context: AccountJudgeAssignmentPageContext
) => void | Promise<void>

export type AccountJudgeAssignmentPageLoader<TSchema extends z.ZodTypeAny> = (
  context: AccountJudgeAssignmentPageContext,
  assignmentId: string
) => z.input<TSchema> | Promise<z.input<TSchema>>

export interface AccountJudgeAssignmentPageRouteDefinition<TSchema extends z.ZodTypeAny> {
  schema: TSchema
  authorize: AccountJudgeAssignmentPageAuthorizer
  load: AccountJudgeAssignmentPageLoader<TSchema>
}

export function defineAccountJudgeAssignmentPageRoute<TSchema extends z.ZodTypeAny>(
  definition: AccountJudgeAssignmentPageRouteDefinition<TSchema>
) {
  return definition
}

export async function executeAccountJudgeAssignmentPageRoute<TSchema extends z.ZodTypeAny>(
  h3Event: H3Event,
  slug: string,
  assignmentId: string,
  definition: AccountJudgeAssignmentPageRouteDefinition<TSchema>
) {
  const params = accountJudgeAssignmentParamsSchema.parse({ slug, assignmentId })
  const context = await resolveAccountEventPageContext(h3Event, params.slug)
  const assignmentAuthorization = await measureRequestPhase(
    h3Event,
    'authorization',
    () => resolveJudgeAssignmentAuthorization(h3Event, params.assignmentId)
  )
  const assignmentContext: AccountJudgeAssignmentPageContext = {
    ...context,
    assignmentAuthorization
  }

  await measureRequestPhase(h3Event, 'authorization', () => definition.authorize(assignmentContext))
  const pageInput = await measureRequestPhase(
    h3Event,
    'd1',
    () => definition.load(assignmentContext, params.assignmentId)
  )

  return await measureRequestPhase(h3Event, 'serialization', () => {
    const page = definition.schema.parse(pageInput)
    return apiData<z.output<TSchema>>(page)
  })
}

export const accountJudgeAssignmentParamsSchema = routeSlugParamsSchema.extend({
  assignmentId: z.string().trim().min(1)
})
