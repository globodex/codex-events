import { z } from 'zod'

import { requireAuthenticatedActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import {
  platformAccountRegistrationBodySchema,
  registerPlatformAccount
} from '#server/domains/accounts'
import { ApiError } from '#server/http/api-error'
import { measureRequestPhase } from '#server/http/request-timing'
import { parseValidatedBody } from '#server/http/validation'

const registrationRequestBodySchema = platformAccountRegistrationBodySchema.extend({
  returnTo: z.string().trim().optional()
})

export default defineApiHandler(async (h3Event) => {
  const actor = await measureRequestPhase(h3Event, 'actor', () => requireAuthenticatedActor(h3Event))

  if (actor.hasPlatformAccount) {
    throw new ApiError({
      statusCode: 409,
      code: 'platform_account_already_exists',
      message: 'A platform account already exists for the authenticated identity.'
    })
  }

  const body = await parseValidatedBody(h3Event, registrationRequestBodySchema)
  const runtimeConfig = useRuntimeConfig(h3Event)

  const result = await registerPlatformAccount(getDatabase(h3Event), actor, {
    privacyPolicyDocumentId: body.privacyPolicyDocumentId,
    platformTermsDocumentId: body.platformTermsDocumentId
  }, runtimeConfig)

  return apiData(result)
})
