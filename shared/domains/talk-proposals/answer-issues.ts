import {
  getCustomQuestionAnswerIssues,
  type CustomQuestionAnswer,
  type CustomQuestionDefinition
} from '#shared/domains/events/custom-questions'

/**
 * Checks the answers of a Talk proposal against the Call for talks questions.
 * A draft may be incomplete; pass `requireComplete` when the proposal is submitted.
 */
export function getTalkProposalAnswerIssues(
  questions: CustomQuestionDefinition[],
  answers: CustomQuestionAnswer[],
  requireComplete: boolean
) {
  return getCustomQuestionAnswerIssues(questions, answers, {
    requireComplete,
    unknownQuestionMessage: 'This question is not part of the Call for talks.'
  })
}
