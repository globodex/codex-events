import { z } from 'zod'

// Custom questions are the questions an organizer writes for an event. The Call for talks and
// the event questionnaire both use this model. Wording that fits only one of them belongs to
// that feature and is passed in (see `getCustomQuestionAnswerIssues`).

export const customQuestionTypes = [
  'short_text',
  'long_text',
  'single_choice',
  'acknowledgement'
] as const

export const customQuestionTypeSchema = z.enum(customQuestionTypes)

export const customQuestionDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  type: customQuestionTypeSchema,
  prompt: z.string().trim().min(1).max(500),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(20).default([])
}).superRefine((question, context) => {
  if (question.type === 'single_choice') {
    if (question.options.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Single-choice questions need at least two choices.'
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
      message: 'Only single-choice questions can define choices.'
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

export const customQuestionAnswerSchema = z.object({
  questionId: z.string().trim().min(1).max(64),
  value: z.union([z.string().trim().max(8000), z.boolean()])
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

export interface CustomQuestionAnswerIssue {
  questionId: string
  message: string
}

/** The value of a question nobody answered yet: unchecked for an acknowledgment, empty text otherwise. */
export function getEmptyCustomQuestionAnswerValue(question: Pick<CustomQuestionDefinition, 'type'>) {
  return question.type === 'acknowledgement' ? false : ''
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
 * (`getTalkProposalAnswerIssues`, `getQuestionnaireAnswerIssues`). That function supplies the
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
      const answer = answersById.get(question.id)
      const complete = question.type === 'acknowledgement'
        ? answer?.value === true
        : typeof answer?.value === 'string' && answer.value.length > 0
      if (!complete) {
        issues.push({ questionId: question.id, message: question.type === 'acknowledgement'
          ? 'Confirm this acknowledgment before submitting.'
          : 'Answer this required question before submitting.' })
      }
    }
  }

  return issues
}
