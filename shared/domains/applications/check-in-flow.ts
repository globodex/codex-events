import { z } from 'zod'

import {
  getCustomQuestionAnswerIssues,
  type CustomQuestionAnswer,
  type CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'

// The check-in flow is what a confirmed participant does on arrival at an event: check in, then
// answer the event questionnaire when the event has one, then use the event's activities.
// This file owns the rules of the flow for the server and the app.

/** The event settings that decide the check-in flow. */
export interface CheckInFlowSettings {
  checkInFlowEnabled: boolean
  questionnaireQuestions: CustomQuestionDefinition[]
}

/** How far one participant is in the check-in flow. */
export interface CheckInFlowProgress {
  /** The result of `isApplicationEffectivelyCheckedIn`, never the bare check-in time. */
  isCheckedIn: boolean
  questionnaireCompletedAt: string | null
}

/** An event has a questionnaire when its check-in flow is on and it has at least one question. */
export function eventHasQuestionnaire(event: CheckInFlowSettings) {
  return event.checkInFlowEnabled && event.questionnaireQuestions.length > 0
}

/**
 * True when the participant has nothing left to do after arriving: they are checked in, and they
 * completed the questionnaire or the event has none.
 *
 * This is the only owner of that rule. Everything that opens after check-in asks this function.
 */
export function hasParticipantFinishedCheckInFlow(
  progress: CheckInFlowProgress,
  event: CheckInFlowSettings
) {
  if (!progress.isCheckedIn) {
    return false
  }

  return !eventHasQuestionnaire(event) || progress.questionnaireCompletedAt !== null
}

/**
 * One stored answer of a completed questionnaire. It keeps the question text the participant
 * answered, so the answer stays readable after the organizer changes the questions.
 */
const questionnaireAnswerRecordSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  value: z.union([z.string(), z.boolean()])
})

export const questionnaireAnswerRecordsSchema = z.array(questionnaireAnswerRecordSchema)

export type QuestionnaireAnswerRecord = z.infer<typeof questionnaireAnswerRecordSchema>

/**
 * Checks the answers a participant sends against the event's current questions.
 * Every required question must be answered.
 */
export function getQuestionnaireAnswerIssues(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[]
) {
  return getCustomQuestionAnswerIssues(questions, answers, {
    requireComplete: true,
    // An answer to a question the event no longer has: the organizer changed the questions
    // while the participant was answering.
    unknownQuestionMessage: 'The questions changed. Check your answers and send them again.'
  })
}
