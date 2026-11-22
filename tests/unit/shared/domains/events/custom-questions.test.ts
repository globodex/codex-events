import { describe, expect, it } from 'vitest'

import {
  customQuestionAnswersSchema,
  customQuestionsSchema,
  getCustomQuestionAnswerIssues
} from '../../../../../shared/domains/events/custom-questions'

const referenceQuestions = [
  { id: 'phone', type: 'short_text', prompt: 'Phone number', required: true, options: [] },
  {
    id: 'format',
    type: 'single_choice',
    prompt: 'How ready is the live demo?',
    required: true,
    options: ['Fully working', 'Mostly working with backup']
  },
  {
    id: 'rules',
    type: 'acknowledgement',
    prompt: 'I understand the format.',
    required: true,
    options: []
  }
] as const

const unknownQuestionMessage = 'This question is not part of the form.'
const asDraft = { requireComplete: false, unknownQuestionMessage }
const asSubmission = { requireComplete: true, unknownQuestionMessage }

describe('Custom questions', () => {
  it('parses supported ordered question definitions', () => {
    expect(customQuestionsSchema.parse(referenceQuestions)).toEqual(referenceQuestions)
  })

  it('requires unique IDs and valid single-choice options', () => {
    expect(customQuestionsSchema.safeParse([
      { ...referenceQuestions[0] },
      { ...referenceQuestions[0] }
    ]).success).toBe(false)
    expect(customQuestionsSchema.safeParse([
      { id: 'format', type: 'single_choice', prompt: 'Format', required: false, options: ['Same', 'Same'] }
    ]).success).toBe(false)
  })

  it('requires acknowledgments to be configured as required', () => {
    expect(customQuestionsSchema.safeParse([
      { id: 'rules', type: 'acknowledgement', prompt: 'Confirm', required: false, options: [] }
    ]).success).toBe(false)
  })

  it('accepts incomplete drafts but enforces required answers on submission', () => {
    const questions = customQuestionsSchema.parse(referenceQuestions)
    const draftAnswers = customQuestionAnswersSchema.parse([
      { questionId: 'phone', value: '' },
      { questionId: 'format', value: '' },
      { questionId: 'rules', value: false }
    ])

    const submissionIssues = getCustomQuestionAnswerIssues(questions, draftAnswers, asSubmission)

    expect(getCustomQuestionAnswerIssues(questions, draftAnswers, asDraft)).toEqual([])
    expect(submissionIssues.map(issue => issue.questionId)).toEqual([
      'phone',
      'format',
      'rules'
    ])
  })

  it('rejects unknown questions, invalid choices, and mismatched answer types', () => {
    const questions = customQuestionsSchema.parse(referenceQuestions)
    const answers = customQuestionAnswersSchema.parse([
      { questionId: 'unknown', value: 'value' },
      { questionId: 'phone', value: false },
      { questionId: 'format', value: 'Recorded only' },
      { questionId: 'rules', value: 'yes' }
    ])

    expect(getCustomQuestionAnswerIssues(questions, answers, asDraft).map(issue => issue.questionId)).toEqual([
      'unknown',
      'phone',
      'format',
      'rules'
    ])
  })
})
