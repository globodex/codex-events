import { and, eq, isNull } from 'drizzle-orm'

import type { AppDatabase } from '#server/database/client'
import type { events } from '#server/database/schema'
import { userApplications } from '#server/database/schema'
import { isApplicationEffectivelyCheckedIn } from '#shared/domains/applications/check-in'
import {
  hasParticipantFinishedCheckInFlow,
  questionnaireAnswerRecordsSchema,
  type QuestionnaireAnswerRecord
} from '#shared/domains/applications/check-in-flow'
import {
  getEmptyCustomQuestionAnswerValue,
  parseCustomQuestionsJson,
  type CustomQuestionAnswer,
  type CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'

type EventRecord = typeof events.$inferSelect
type ApplicationRecord = typeof userApplications.$inferSelect

/**
 * True when a registration has finished the check-in flow of its event: the participant is
 * checked in, and completed the event questionnaire when the event has one.
 *
 * Server code that opens something after check-in asks this function. It reads the stored event
 * and registration and applies the one shared rule, `hasParticipantFinishedCheckInFlow`.
 *
 * An event with its check-in flow off has no questionnaire, so there this is true as soon as the
 * participant is checked in. A feature that must not wait for check-in in such an event reads
 * `event.checkInFlowEnabled` first.
 */
export function hasApplicationFinishedCheckInFlow(event: EventRecord, application: ApplicationRecord) {
  return hasParticipantFinishedCheckInFlow(
    {
      isCheckedIn: isApplicationEffectivelyCheckedIn(application),
      questionnaireCompletedAt: application.questionnaireCompletedAt
    },
    {
      checkInFlowEnabled: event.checkInFlowEnabled,
      questionnaireQuestions: parseCustomQuestionsJson(event.questionnaireQuestionsJson)
    }
  )
}

/**
 * Builds what is stored when a participant completes the questionnaire: one record per question,
 * in the order of the questions. Each record keeps the question text, so the answer stays
 * readable after the organizer changes the questions. A question the participant skipped is
 * stored with the empty value.
 */
export function buildQuestionnaireAnswerRecords(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[]
): QuestionnaireAnswerRecord[] {
  const valueByQuestionId = new Map(answers.map(answer => [answer.questionId, answer.value]))

  return questions.map(question => ({
    questionId: question.id,
    prompt: question.prompt,
    value: valueByQuestionId.get(question.id) ?? getEmptyCustomQuestionAnswerValue(question)
  }))
}

/** Reads `questionnaire_answers_json`. Null means the participant has not completed the questionnaire. */
export function parseQuestionnaireAnswersJson(value: string | null) {
  return value === null ? null : questionnaireAnswerRecordsSchema.parse(JSON.parse(value))
}

/**
 * Stores the answers of a participant who completes the questionnaire.
 *
 * A questionnaire is completed once. The update only matches an application without a
 * completion time, so a second request changes nothing, also when it arrives at the same moment.
 *
 * Returns the updated application, or null when the questionnaire was already completed.
 */
export async function recordQuestionnaireCompletion(
  database: AppDatabase,
  completion: {
    applicationId: string
    answers: QuestionnaireAnswerRecord[]
    completedAt: string
  }
) {
  const [completedApplication] = await database
    .update(userApplications)
    .set({
      questionnaireAnswersJson: JSON.stringify(completion.answers),
      questionnaireCompletedAt: completion.completedAt,
      updatedAt: completion.completedAt
    })
    .where(and(
      eq(userApplications.id, completion.applicationId),
      isNull(userApplications.questionnaireCompletedAt)
    ))
    .returning()

  return completedApplication ?? null
}
