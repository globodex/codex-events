import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { BlindJudgeAssignmentDetail, PitchJudgeAssignmentDetail } from '~/domains/judging/workspace'

import JudgeSubmissionPanel from '~/components/judging/JudgeSubmissionPanel.vue'

const assignedAt = '2026-11-21T10:00:00.000Z'
const assignment = {
  eventId: 'build-studio',
  submissionId: 'tool-library',
  judgeUserId: 'judge',
  status: 'assigned' as const,
  assignedAt,
  startedAt: null,
  completedAt: null,
  skippedAt: null,
  skippedByUserId: null,
  skipReason: null,
  ineligibilityStatus: 'eligible' as const,
  ineligibilityReason: null,
  ineligibilityMarkedAt: null,
  ineligibilityMarkedByUserId: null,
  createdAt: assignedAt
}

const submission = {
  id: 'tool-library',
  projectName: 'Tool Library',
  summary: 'A shared inventory that helps neighbors lend tools and keep track of returns.',
  repositoryUrl: 'https://example.com/tool-library',
  demoUrl: null,
  track: {
    id: 'community',
    name: 'Community tools',
    shortDescription: 'Build something people can use together.'
  },
  status: 'locked' as const,
  submittedAt: '2026-11-21T09:00:00.000Z',
  lockedAt: assignedAt
}

const blindAssignment = {
  ...assignment,
  id: 'blind-assignment',
  reviewStage: 'blind_review',
  blindReviewSlot: 1,
  blindSubmission: { ...submission, applications: [] },
  criterionScores: []
} satisfies BlindJudgeAssignmentDetail

const pitchAssignment = {
  ...assignment,
  id: 'pitch-assignment',
  reviewStage: 'pitch_review',
  pitchScore: null,
  pitchComment: null,
  pitchSubmission: { ...submission, teamName: 'Open Workbench' }
} satisfies PitchJudgeAssignmentDetail

const meta = {
  title: 'Judging/Submission',
  component: JudgeSubmissionPanel,
  argTypes: { assignment: { control: false } }
} satisfies Meta<typeof JudgeSubmissionPanel>

export default meta
type Story = StoryObj<typeof meta>

export const BlindReview: Story = {
  args: { assignment: blindAssignment }
}

export const PitchReview: Story = {
  args: { assignment: pitchAssignment }
}
