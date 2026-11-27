import { defineEventHandler, readBody, sendRedirect, setResponseHeader } from 'h3'

import { requireAuthenticatedActor } from '#server/auth/actor'
import { getDatabase } from '#server/database/client'
import { isRegistrationEmailVerified } from '#server/domains/accounts/email-verification'
import { findRegistrationLinkTarget, startLinkStep } from '#server/domains/accounts/linking'
import { buildAccountRegisterHref, normalizeAuthReturnTo } from '#shared/domains/accounts/auth-navigation'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const body = await readBody(event)
  const returnTo = normalizeAuthReturnTo(typeof body?.returnTo === 'string' ? body.returnTo : null, '/account')
  const actor = await requireAuthenticatedActor(event)
  if (actor.hasPlatformAccount) return sendRedirect(event, returnTo, 303)
  const email = actor.sessionUser.email
  if (email && await isRegistrationEmailVerified(actor.sessionUser, useRuntimeConfig(event))) {
    const target = await findRegistrationLinkTarget(getDatabase(event), actor.sessionUser.sub, email)
    if (target && target !== 'conflict') return startLinkStep(event, { ...target, returnTo }, 'secondary')
  }
  return sendRedirect(event, buildAccountRegisterHref(returnTo) + '&linkingError=invalid', 303)
})
