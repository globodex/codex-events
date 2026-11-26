import { requireAuthenticatedActor } from '#server/auth/actor'
import { isRegistrationEmailVerified } from '#server/domains/accounts/email-verification'
import { ApiError } from '#server/http/api-error'
import { defineApiHandler } from '#server/http/api-handler'
import { apiData } from '#server/http/api-response'
import { measureRequestPhase } from '#server/http/request-timing'

export default defineApiHandler(async (h3Event) => {
  const actor = await measureRequestPhase(h3Event, 'actor', () => requireAuthenticatedActor(h3Event))

  if (actor.hasPlatformAccount) {
    throw new ApiError({
      statusCode: 409,
      code: 'platform_account_already_exists',
      message: 'A platform account already exists for the authenticated identity.'
    })
  }

  return apiData({
    verified: await isRegistrationEmailVerified(actor.sessionUser, useRuntimeConfig(h3Event))
  })
})
