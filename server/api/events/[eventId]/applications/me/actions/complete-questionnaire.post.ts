import { z } from 'zod'

import { requirePlatformActor } from '#server/auth/actor'
import { writeAuditLog } from '#server/database/audit-log'
import { getDatabase } from '#server/database/client'
import {
  getOwnUserApplication,
  serializeUserApplication
} from '#server/domains/applications'
import {
  buildQuestionnaireAnswerRecords,
  recordQuestionnaireCompletion
} from '#server/domains/applications/check-in-flow'
import {
  getVisibleEventOrThrow,
  routeIdParamsSchema
} from '#server/domains/events'
import { assertGuard } from '#server/domains/lifecycle-guard'
import { ApiError } from '#server/http/api-error'
import { defineStructuredOperationApiHandler, defineStructuredRouteOperation } from '#server/application/operations/route-operation'
import { apiData } from '#server/http/api-response'
import { parseValidatedBody, parseValidatedParams } from '#server/http/validation'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import {
  eventHasQuestionnaire,
  getQuestionnaireAnswerIssues
} from '#shared/domains/applications/check-in-flow'
import {
  customQuestionAnswersSchema,
  parseCustomQuestionsJson
} from '#shared/domains/events/custom-questions'

const completeQuestionnaireBodySchema = z.object({
  answers: customQuestionAnswersSchema
})

function questionnaireAlreadyCompletedError() {
  return new ApiError({
    statusCode: 409,
    code: 'questionnaire_already_completed',
    message: 'You already answered these questions.'
  })
}

/**
 * A checked-in participant answers the event questionnaire. This happens once per registration:
 * a second request answers with a conflict and changes nothing.
 */
export const applicationOperation = defineStructuredRouteOperation({
  id: 'post.events.by-eventId.applications.me.actions.complete-questionnaire',
  domain: 'participation',
  description: 'POST /api/events/:eventId/applications/me/actions/complete-questionnaire',
  rest: { method: 'POST', path: '/api/events/:eventId/applications/me/actions/complete-questionnaire' },
  input: { params: routeIdParamsSchema, body: completeQuestionnaireBodySchema },
  output: 'data',
  capabilities: ['platform_user'],
  effect: 'update'
}, async (h3Event) => {
  const actor = await requirePlatformActor(h3Event)
  const { eventId } = parseValidatedParams(h3Event, routeIdParamsSchema)
  const { answers } = await parseValidatedBody(h3Event, completeQuestionnaireBodySchema)
  const database = getDatabase(h3Event)
  const event = await getVisibleEventOrThrow(h3Event, eventId)
  // Only finds the caller's own registration, so nobody can answer for another participant.
  const application = await getOwnUserApplication(database, eventId, actor.platformUser.id)

  if (!application) {
    throw new ApiError({
      statusCode: 404,
      code: 'user_application_not_found',
      message: 'The requested user application was not found.',
      details: { eventId }
    })
  }

  assertGuard(application.status === 'approved', {
    code: 'application_not_approved',
    message: 'Only confirmed participants can answer the event questions.'
  })

  const questions = parseCustomQuestionsJson(event.questionnaireQuestionsJson)

  assertGuard(eventHasQuestionnaire({
    checkInFlowEnabled: event.checkInFlowEnabled,
    questionnaireQuestions: questions
  }), {
    code: 'questionnaire_unavailable',
    message: 'This event has no questions to answer.'
  })
  assertGuard(isApplicationEffectivelyCheckedIn(application), {
    code: 'application_not_checked_in',
    message: 'Check in with the event team before you answer the event questions.'
  })

  if (application.questionnaireCompletedAt) {
    throw questionnaireAlreadyCompletedError()
  }

  const issues = getQuestionnaireAnswerIssues(questions, answers)

  assertGuard(issues.length === 0, {
    statusCode: 422,
    code: 'questionnaire_answers_invalid',
    message: issues[0]?.message ?? 'The answers are invalid.',
    details: { questions: issues.map(issue => issue.questionId) }
  })

  const completedAt = new Date().toISOString()
  const completedApplication = await recordQuestionnaireCompletion(database, {
    applicationId: application.id,
    questionsJson: event.questionnaireQuestionsJson,
    answers: buildQuestionnaireAnswerRecords(questions, answers),
    completedAt
  })

  if (!completedApplication) {
    const current = await getOwnUserApplication(database, eventId, actor.platformUser.id)
    if (current?.questionnaireCompletedAt) {
      throw questionnaireAlreadyCompletedError()
    }
    throw new ApiError({
      statusCode: 409,
      code: 'questionnaire_changed',
      message: 'Your registration or the event questions changed. Refresh the event page.'
    })
  }

  // The audit record says who completed the questionnaire. It never holds the answers.
  await writeAuditLog(database, {
    actorUserId: actor.platformUser.id,
    entityType: 'user_application',
    entityId: completedApplication.id,
    action: 'user_application.questionnaire_completed',
    metadata: {
      eventId,
      userId: completedApplication.userId
    },
    createdAt: completedAt
  })

  return apiData(serializeUserApplication(completedApplication))
})

export default defineStructuredOperationApiHandler(applicationOperation)
