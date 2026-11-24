import { z } from 'zod'

// Custom questions are the questions an organizer writes for an event. The Call for talks and
// the registration questions both use this model. Wording that fits only one of them belongs to
// that feature and is passed in (see `getCustomQuestionAnswerIssues`).

export const customQuestionTypes = [
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'acknowledgement'
] as const

export const customQuestionTypeSchema = z.enum(customQuestionTypes)

/** True for the question types that offer choices: one of them, or any number of them. */
export function customQuestionHasChoices(type: z.infer<typeof customQuestionTypeSchema>) {
  return type === 'single_choice' || type === 'multiple_choice'
}

export const customQuestionDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  type: customQuestionTypeSchema,
  // The messages tell the organizer what to fix. The event builder shows them in its checklist
  // next to the position of the question, for example "Question 2: Write the question."
  prompt: z.string().trim()
    .min(1, 'Write the question.')
    .max(500, 'Use a question of 500 characters or fewer.'),
  required: z.boolean(),
  options: z.array(
    z.string().trim()
      .min(1, 'Fill in every choice.')
      .max(200, 'Use choices of 200 characters or fewer.')
  ).max(20).default([])
}).superRefine((question, context) => {
  if (customQuestionHasChoices(question.type)) {
    if (question.options.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Choice questions need at least two choices.'
      })
    }

    if (new Set(question.options).size !== question.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Question choices must be unique.'
      })
    }
  } else if (question.options.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Only choice questions can have choices.'
    })
  }

  if (question.type === 'acknowledgement' && !question.required) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['required'],
      message: 'Acknowledgments must be required.'
    })
  }
})

export const customQuestionsSchema = z.array(customQuestionDefinitionSchema)
  .max(20)
  .superRefine((questions, context) => {
    const ids = new Set<string>()
    for (const [index, question] of questions.entries()) {
      if (ids.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Question IDs must be unique.'
        })
      }
      ids.add(question.id)
    }
  })

/**
 * An answer value: text, a checkbox state for an acknowledgment, or the ticked choices of a
 * multiple-choice question.
 */
export const customQuestionAnswerValueSchema = z.union([
  z.string().trim().max(8000),
  z.boolean(),
  z.array(z.string().trim().max(200)).max(20)
])

export const customQuestionAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(64),
  value: customQuestionAnswerValueSchema
})

export const customQuestionAnswersSchema = z.array(customQuestionAnswerSchema)
  .max(20)
  .superRefine((answers, context) => {
    const ids = new Set<string>()
    for (const [index, answer] of answers.entries()) {
      if (ids.has(answer.questionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'questionId'],
          message: 'Each question can have only one answer.'
        })
      }
      ids.add(answer.questionId)
    }
  })

export type CustomQuestionType = z.infer<typeof customQuestionTypeSchema>
export type CustomQuestionDefinition = z.infer<typeof customQuestionDefinitionSchema>
export type CustomQuestionAnswer = z.infer<typeof customQuestionAnswerSchema>
export type CustomQuestionAnswerValue = z.infer<typeof customQuestionAnswerValueSchema>

export interface CustomQuestionAnswerIssue {
  questionId: string
  message: string
}

/**
 * The value of a question nobody answered yet: unchecked for an acknowledgment, no ticked choice
 * for a multiple-choice question, empty text otherwise.
 */
export function getEmptyCustomQuestionAnswerValue(question: Pick<CustomQuestionDefinition, 'type'>): CustomQuestionAnswerValue {
  if (question.type === 'acknowledgement') return false
  return question.type === 'multiple_choice' ? [] : ''
}

/** True when the value answers the question: a checked acknowledgment, a ticked choice, or text. */
export function isCustomQuestionAnswered(
  question: Pick<CustomQuestionDefinition, 'type'>,
  value: CustomQuestionAnswerValue | undefined
) {
  if (question.type === 'acknowledgement') return value === true
  if (question.type === 'multiple_choice') return Array.isArray(value) && value.length > 0
  return typeof value === 'string' && value.length > 0
}

export function parseCustomQuestionsJson(value: string) {
  return customQuestionsSchema.parse(JSON.parse(value))
}

export function parseCustomQuestionAnswersJson(value: string) {
  return customQuestionAnswersSchema.parse(JSON.parse(value))
}

/**
 * Checks answers against the questions they belong to and returns one issue per problem.
 *
 * Call it through the function of the feature that owns the questions
 * (`getTalkProposalAnswerIssues`, `getRegistrationAnswerIssues`). That function supplies the
 * feature's wording for an answer to a question the feature does not have.
 */
export function getCustomQuestionAnswerIssues(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[],
  options: {
    /** True when every required question must be answered, false for an unfinished draft. */
    requireComplete: boolean
    unknownQuestionMessage: string
  }
) {
  const questionsById = new Map(questions.map(question => [question.id, question]))
  const answersById = new Map(answers.map(answer => [answer.questionId, answer]))
  const issues: CustomQuestionAnswerIssue[] = []

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId)
    if (!question) {
      issues.push({ questionId: answer.questionId, message: options.unknownQuestionMessage })
      continue
    }

    if (question.type === 'acknowledgement') {
      if (typeof answer.value !== 'boolean') {
        issues.push({ questionId: question.id, message: 'This acknowledgment must be checked or unchecked.' })
      }
      continue
    }

    if (question.type === 'multiple_choice') {
      const ticked = Array.isArray(answer.value) ? answer.value : null
      if (!ticked || new Set(ticked).size !== ticked.length || ticked.some(choice => !question.options.includes(choice))) {
        issues.push({ questionId: question.id, message: 'Tick only the available options, each once.' })
      }
      continue
    }

    if (typeof answer.value !== 'string') {
      issues.push({ questionId: question.id, message: 'This answer must be text.' })
      continue
    }

    if (question.type === 'short_text' && answer.value.length > 500) {
      issues.push({ questionId: question.id, message: 'This answer must be 500 characters or fewer.' })
    }

    if (question.type === 'single_choice' && answer.value !== '' && !question.options.includes(answer.value)) {
      issues.push({ questionId: question.id, message: 'Choose one of the available options.' })
    }
  }

  if (options.requireComplete) {
    for (const question of questions) {
      if (!question.required) continue
      if (!isCustomQuestionAnswered(question, answersById.get(question.id)?.value)) {
        issues.push({ questionId: question.id, message: question.type === 'acknowledgement'
          ? 'Confirm this acknowledgment before submitting.'
          : 'Answer this required question before submitting.' })
      }
    }
  }

  return issues
}
