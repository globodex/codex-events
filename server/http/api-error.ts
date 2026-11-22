import type { H3Event } from 'h3'

import { setResponseStatus } from 'h3'

import { maxParticipantPhotosPerEvent } from '#shared/domains/events/photos'

export const unexpectedErrorMessage = 'An unexpected error occurred.'

export interface ApiErrorOptions {
  statusCode: number
  code: string
  message: string
  details?: Record<string, unknown>
  cause?: unknown
}

export class ApiError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly details?: Record<string, unknown>

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = 'ApiError'
    this.statusCode = options.statusCode
    this.code = options.code
    this.details = options.details
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function createInternalApiError(cause?: unknown) {
  return new ApiError({
    statusCode: 500,
    code: 'internal_error',
    message: unexpectedErrorMessage,
    ...(cause === undefined ? {} : { cause })
  })
}

/**
 * Two rules live in the database, because only the database sees two writes that arrive at the
 * same moment (migration `0085_build_day_guards.sql`). When one of these rules refuses a write,
 * the refusal arrives here as a database error. This function turns it into the answer for the
 * person who made the request.
 *
 * Returns undefined for every other error.
 */
function toDatabaseRuleApiError(error: unknown) {
  // Drizzle wraps the database error. The database message is at the end of the `cause` chain.
  let cause = error

  while (cause instanceof Error && cause.cause instanceof Error) {
    cause = cause.cause
  }

  const databaseMessage = cause instanceof Error ? cause.message : ''

  // The unique index `user_applications_active_luma_email_idx`.
  if (databaseMessage.includes('UNIQUE constraint failed: user_applications.event_id, user_applications.active_luma_email')) {
    return new ApiError({
      statusCode: 409,
      code: 'luma_email_already_used',
      message: 'This Luma email is already connected to another registration for this event.'
    })
  }

  // The trigger `participant_photo_limit`.
  if (databaseMessage.includes('event_photo_participant_limit_reached')) {
    return new ApiError({
      statusCode: 409,
      code: 'event_photo_participant_limit_reached',
      message: `You can add up to ${maxParticipantPhotosPerEvent} photos to this event.`
    })
  }
}

export function toApiError(error: unknown) {
  if (isApiError(error)) {
    return error
  }

  return toDatabaseRuleApiError(error) ?? createInternalApiError(error)
}

export function sendApiError(event: H3Event, error: unknown) {
  const apiError = toApiError(error)
  if (apiError.statusCode >= 500 && !isApiError(error)) {
    console.error('Unhandled API error', {
      method: event.node.req.method ?? 'UNKNOWN',
      url: event.node.req.url ?? '',
      error
    })
  }

  setResponseStatus(event, apiError.statusCode)

  return {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {})
    }
  }
}
