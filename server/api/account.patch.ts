import { requirePlatformActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import {
  platformAccountProfileBodySchema,
  updatePlatformAccountProfile
} from '#server/domains/accounts'
import { assertLumaEmailChangeIsFree } from '#server/domains/applications/luma-email'
import { parseValidatedBody } from '#server/http/validation'

export const applicationOperation = defineStructuredRouteOperation({
  id: 'patch.account',
  domain: 'participation',
  description: 'PATCH /api/account',
  rest: { method: 'PATCH', path: '/api/account' },
  input: { body: platformAccountProfileBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const body = await parseValidatedBody(h3Event, platformAccountProfileBodySchema)
  const database = getDatabase(h3Event)
  const nextLumaEmail = body.lumaEmail?.trim() ?? ''
  const currentLumaEmail = actor.platformUser.lumaEmail?.trim() ?? ''

  if (nextLumaEmail && nextLumaEmail.toLowerCase() !== currentLumaEmail.toLowerCase()) {
    // A Luma email belongs to one active registration of an event (see `luma-email.ts`).
    await assertLumaEmailChangeIsFree(database, { userId: actor.platformUser.id, lumaEmail: nextLumaEmail })
  }

  const user = await updatePlatformAccountProfile(database, actor.platformUser.id, body)

  return apiData({
    user
  })
})

export default defineStructuredOperationApiHandler(applicationOperation)
