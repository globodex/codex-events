import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { TeamSubmissionRecord } from '~/domains/submissions/team-submission'

import { fn } from 'storybook/test'

import ParticipantTeamSubmissionPanel from '~/components/teams/ParticipantTeamSubmissionPanel.vue'

const project = {
  projectName: 'Open Tools',
  summary: 'Find related notes across your project workspaces.',
  repositoryUrl: 'https://example.com/open-tools',
  demoUrl: '',
  trackId: null
}

const submission: TeamSubmissionRecord = {
  ...project,
  id: 'submission-open-tools',
  teamId: 'team-open-tools',
  status: 'draft',
  isPubliclyVisible: false,
  submittedAt: null,
  lockedAt: null,
  withdrawnAt: null,
  disqualifiedAt: null,
  createdAt: '2026-12-05T12:00:00Z',
  updatedAt: '2026-12-05T14:00:00Z'
}

const allowed = { isAllowed: true }
const closed = { isAllowed: false, reason: 'Project submissions are closed.' }

const meta = {
  title: 'Participant/Teams/Project submission',
  component: ParticipantTeamSubmissionPanel,
  args: {
    submission,
    canManageSubmission: true,
    submissionRequirements: {
      requireSubmissionSummary: true,
      requireSubmissionRepositoryUrl: true,
      requireSubmissionDemoUrl: false
    },
    createAvailability: allowed,
    updateAvailability: allowed,
    submitAvailability: allowed,
    withdrawAvailability: allowed,
    onSaveDraft: fn(),
    onSubmitProject: fn()
  }
} satisfies Meta<typeof ParticipantTeamSubmissionPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Draft: Story = {}
export const Locked: Story = {
  args: {
    submission: {
      ...submission,
      status: 'locked',
      submittedAt: '2026-12-05T15:00:00Z',
      lockedAt: '2026-12-05T17:00:00Z'
    },
    createAvailability: closed,
    updateAvailability: closed,
    submitAvailability: closed,
    withdrawAvailability: closed
  }
}
