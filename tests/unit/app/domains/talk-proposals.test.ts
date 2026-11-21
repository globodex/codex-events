import { describe, expect, test } from 'vitest'

import {
  createTalkProposalAnswers,
  talkProposalFormSchema,
  validateTalkProposalSubmission
} from '../../../../app/domains/talk-proposals'

describe('talk proposal workspace contracts', () => {
  test('accepts participant content with an optional HTTP(S) demo or slides URL', () => {
    expect(talkProposalFormSchema.safeParse({
      title: 'Building reliable agents',
      abstract: 'A practical field guide.',
      demoOrSlidesUrl: 'https://example.com/slides',
      questionSetRevision: 0,
      answers: []
    }).success).toBe(true)
    expect(talkProposalFormSchema.safeParse({
      title: 'Building reliable agents',
      abstract: 'A practical field guide.',
      demoOrSlidesUrl: 'file:///tmp/slides.pdf',
      questionSetRevision: 0,
      answers: []
    }).success).toBe(false)
  })

  test('validates standard and configured proposal fields as one submission', () => {
    const questions = [
      { id: 'format', type: 'single_choice' as const, prompt: 'Choose a format', required: true, options: ['Talk', 'Demo'] },
      { id: 'recording', type: 'acknowledgement' as const, prompt: 'I agree to recording.', required: true, options: [] }
    ]

    const missing = validateTalkProposalSubmission({
      title: '',
      abstract: '',
      demoOrSlidesUrl: '',
      questionSetRevision: 2,
      answers: createTalkProposalAnswers(questions)
    }, questions)

    expect(missing).toMatchObject({
      isValid: false,
      missingRequiredItemCount: 4,
      invalidFieldCount: 0
    })
    expect(missing.errors.questions).toEqual({
      format: 'Answer this required question before submitting.',
      recording: 'Confirm this acknowledgment before submitting.'
    })

    expect(validateTalkProposalSubmission({
      title: 'Reliable agent demos',
      abstract: 'How to build a demo that survives a live audience.',
      demoOrSlidesUrl: 'https://example.com/slides',
      questionSetRevision: 2,
      answers: [
        { questionId: 'format', value: 'Demo' },
        { questionId: 'recording', value: true }
      ]
    }, questions)).toMatchObject({
      isValid: true,
      missingRequiredItemCount: 0,
      invalidFieldCount: 0
    })
  })
})
