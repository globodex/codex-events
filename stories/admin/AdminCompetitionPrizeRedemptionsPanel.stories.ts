import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { PublishedProjectShowcaseEntry } from '~/domains/outcomes/published-outcomes'
import type { PrizeRedemptionRecord } from '~/domains/prize-redemptions'
import AdminCompetitionPrizeRedemptionsPanel from '~/components/admin/organisms/AdminCompetitionPrizeRedemptionsPanel.vue'
import { winningProject } from '../public-events/fixtures/build-day'

const shortlistedProject: PublishedProjectShowcaseEntry = {
  teamId: 'workshop-notes',
  teamName: 'Workshop Notes',
  submissionId: 'session-notebook',
  projectName: 'Session Notebook',
  summary: 'Share workshop notes with teammates after each session.',
  repositoryUrl: 'https://example.com/session-notebook/source',
  demoUrl: null,
  teamMembers: [{
    id: 'alex-sample',
    fullName: 'Alex Sample',
    bio: null,
    xProfileUrl: null,
    linkedinProfileUrl: null,
    githubProfileUrl: null,
    profileIconUrl: null
  }]
}

const rankedProject: PublishedProjectShowcaseEntry = {
  teamId: 'quiet-room-team',
  teamName: 'Quiet Room Team',
  submissionId: 'quiet-room-finder',
  projectName: 'Quiet Room Finder',
  summary: null,
  repositoryUrl: null,
  demoUrl: null,
  teamMembers: []
}

const pendingRedemption: PrizeRedemptionRecord = {
  id: 'repair-club-award',
  status: 'pending',
  userId: null,
  teamId: winningProject.teamId,
  legalName: null,
  winnerTermsDocumentId: null,
  winnerTermsAcceptedAt: null,
  redeemedAt: null,
  createdAt: '2026-09-12T17:00:00.000Z',
  updatedAt: '2026-09-12T17:00:00.000Z',
  prize: winningProject.prizes[0]!,
  event: {
    id: 'storybook-build-day',
    name: 'Vienna Build Day',
    slug: 'storybook-build-day',
    state: 'completed',
    currentWinnerTermsDocumentId: 'storybook-winner-terms'
  }
}

const meta = {
  title: 'Admin/Competition/Prize redemptions',
  component: AdminCompetitionPrizeRedemptionsPanel,
  args: {
    eventState: 'completed',
    winners: [winningProject],
    redemptions: [pendingRedemption],
    winnerTermsTitle: 'Winner terms',
    finalRankingEntries: [winningProject, { ...shortlistedProject, finalRank: 2 }],
    blindRankingEntries: [
      { ...rankedProject, blindRank: 3 },
      { ...shortlistedProject, blindRank: 1 },
      { ...winningProject, blindRank: 2 }
    ],
    pitchPresentationSubmissionIds: [winningProject.submissionId, shortlistedProject.submissionId]
  },
  render: args => ({
    components: { AdminCompetitionPrizeRedemptionsPanel },
    setup: () => ({ args }),
    template: `
      <div class="mx-auto max-w-5xl space-y-4">
        <AdminCompetitionPrizeRedemptionsPanel v-bind="args" />
      </div>
    `
  })
} satisfies Meta<typeof AdminCompetitionPrizeRedemptionsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Completed: Story = {}

export const WinnersAnnounced: Story = { args: { eventState: 'winners_announced' } }

export const Loading: Story = { args: { isLoading: true, winners: [], redemptions: [] } }

export const NoRankedTeams: Story = { args: { finalRankingEntries: [], blindRankingEntries: [] } }

export const LoadingError: Story = { args: { errorMessage: 'Could not load prize redemptions.' } }
