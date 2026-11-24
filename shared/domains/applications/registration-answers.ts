import { z } from 'zod'

import {
  getCustomQuestionAnswerIssues,
  getEmptyCustomQuestionAnswerValue,
  type CustomQuestionAnswer,
  type CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'

// Registration questions are the questions an organizer writes for the registration form of an
// event, next to the fixed registration fields. This file owns how the answers are checked and
// stored, for the server and the app.

/**
 * One stored answer of a registration. It keeps the question text the participant answered, so
 * the answer stays readable after the organizer changes the questions.
 */
const registrationAnswerRecordSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  value: z.union([z.string(), z.boolean()])
})

export const registrationAnswerRecordsSchema = z.array(registrationAnswerRecordSchema)

export type RegistrationAnswerRecord = z.infer<typeof registrationAnswerRecordSchema>

/**
 * Checks the answers of a registration against the event's current questions.
 * Every required question must be answered.
 */
export function getRegistrationAnswerIssues(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[]
) {
  return getCustomQuestionAnswerIssues(questions, answers, {
    requireComplete: true,
    // An answer to a question the event no longer has: the organizer changed the questions
    // while the participant was filling in the form.
    unknownQuestionMessage: 'The questions changed. Check your answers and send them again.'
  })
}

/**
 * Builds what is stored with a new registration: one record per question, in the order of the
 * questions. A question the participant skipped is stored with the empty value.
 */
export function buildRegistrationAnswerRecords(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[]
): RegistrationAnswerRecord[] {
  const valueByQuestionId = new Map(answers.map(answer => [answer.questionId, answer.value]))

  return questions.map(question => ({
    questionId: question.id,
    prompt: question.prompt,
    value: valueByQuestionId.get(question.id) ?? getEmptyCustomQuestionAnswerValue(question)
  }))
}

/** Reads `user_applications.registration_answers_json`. */
export function parseRegistrationAnswersJson(value: string) {
  return registrationAnswerRecordsSchema.parse(JSON.parse(value))
}
