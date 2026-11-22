import { z } from 'zod'
import {
  customQuestionAnswersSchema,
  getEmptyCustomQuestionAnswerValue,
  type CustomQuestionAnswer,
  type CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'
import { getTalkProposalAnswerIssues } from '#shared/domains/talk-proposals/answer-issues'

export const talkProposalFormSchema = z.object({
  title: z.string().trim().min(1, 'Enter a talk title.').max(200, 'Keep the title under 200 characters.'),
  abstract: z.string().trim().min(1, 'Enter a talk abstract.').max(8000, 'Keep the abstract under 8,000 characters.'),
  demoOrSlidesUrl: z.union([
    z.literal(''),
    z.string().trim().url('Enter a valid HTTP(S) URL.').refine(value => /^https?:\/\//i.test(value), 'Enter a valid HTTP(S) URL.')
  ]),
  questionSetRevision: z.number().int().min(0),
  answers: customQuestionAnswersSchema
})

export interface TalkProposalFormValues {
  title: string
  abstract: string
  demoOrSlidesUrl: string
  questionSetRevision: number
  answers: CustomQuestionAnswer[]
}

export interface TalkProposalFormErrors {
  title?: string
  abstract?: string
  demoOrSlidesUrl?: string
  questions: Record<string, string>
}

export function createTalkProposalAnswers(
  questions: CustomQuestionDefinition[],
  source: CustomQuestionAnswer[] = []
) {
  const sourceById = new Map(source.map(answer => [answer.questionId, answer]))

  return questions.map(question => sourceById.get(question.id) ?? {
    questionId: question.id,
    value: getEmptyCustomQuestionAnswerValue(question)
  })
}

export function validateTalkProposalSubmission(
  values: TalkProposalFormValues,
  questions: CustomQuestionDefinition[]
) {
  const result = talkProposalFormSchema.safeParse(values)
  const errors: TalkProposalFormErrors = { questions: {} }

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0]
      if ((field === 'title' || field === 'abstract' || field === 'demoOrSlidesUrl') && !errors[field]) {
        errors[field] = issue.message
      }
    }
  }

  const answerIssues = getTalkProposalAnswerIssues(questions, values.answers, true)
  errors.questions = Object.fromEntries(answerIssues.map(issue => [issue.questionId, issue.message]))

  const answersById = new Map(values.answers.map(answer => [answer.questionId, answer]))
  const missingRequiredItemCount = Number(!values.title.trim())
    + Number(!values.abstract.trim())
    + questions.filter((question) => {
      if (!question.required) return false
      const answer = answersById.get(question.id)
      return question.type === 'acknowledgement'
        ? answer?.value !== true
        : typeof answer?.value !== 'string' || answer.value.length === 0
    }).length
  const invalidFieldCount = Object.values({
    title: values.title.trim() ? errors.title : undefined,
    abstract: values.abstract.trim() ? errors.abstract : undefined,
    demoOrSlidesUrl: errors.demoOrSlidesUrl
  }).filter(Boolean).length
  + answerIssues.filter(issue => !questions.some((question) => {
    if (question.id !== issue.questionId || !question.required) return false
    const answer = answersById.get(question.id)
    return question.type === 'acknowledgement'
      ? answer?.value !== true
      : typeof answer?.value !== 'string' || answer.value.length === 0
  })).length

  return {
    errors,
    missingRequiredItemCount,
    invalidFieldCount,
    isValid: result.success && answerIssues.length === 0
  }
}

export type TalkProposalStatus = 'draft' | 'submitted' | 'withdrawn' | 'accepted' | 'rejected'

export interface TalkProposalRecord {
  id: string
  eventId: string
  userId: string
  status: TalkProposalStatus
  title: string
  abstract: string
  demoOrSlidesUrl: string | null
  questionSetRevision: number
  answers: CustomQuestionAnswer[]
  decisionMessage: string | null
  reviewedByUserId: string | null
  submittedAt: string | null
  withdrawnAt: string | null
  revisedAt: string | null
  decidedAt: string | null
  decisionEmailQueuedAt: string | null
  decisionEmailLastAttemptedAt: string | null
  decisionEmailSentAt: string | null
  decisionEmailFailedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TalkProposalReviewEntry {
  proposal: TalkProposalRecord
  owner: {
    id: string
    displayName: string
    firstName: string
    familyName: string
    email: string
  }
  applicationStatus: 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn' | null
}

export const talkProposalStatusLabels: Record<TalkProposalStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  withdrawn: 'Withdrawn',
  accepted: 'Accepted',
  rejected: 'Not accepted'
}

export function isTalkProposalWindowOpen(opensAt: string | null, closesAt: string | null, now = Date.now()) {
  const opens = Date.parse(opensAt ?? '')
  const closes = Date.parse(closesAt ?? '')
  return !Number.isNaN(opens) && !Number.isNaN(closes) && now >= opens && now <= closes
}
