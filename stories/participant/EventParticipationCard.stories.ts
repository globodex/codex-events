import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type {
  AccountOverviewApplicationSummary,
  AccountOverviewRecord
} from '#shared/domains/account/account-overview-page'

import EventParticipationCard from '~/components/events/EventParticipationCard.vue'

const submittedAt = '2026-11-05T09:00:00Z'
const checkedInAt = '2026-12-05T08:45:00Z'

const application: AccountOverviewApplicationSummary = {
  id: 'application-example',
  userId: 'participant-example',
  status: 'submitted',
  lumaSyncStatus: 'not_synced',
  submittedAt,
  withdrawnAt: null,
  reviewedAt: null,
  checkedInAt: null,
  isCheckedIn: false,
  certificateHiddenAt: null,
  certificateRevokedAt: null,
  selectedTrackId: null,
  selectedChallengeId: null,
  updatedAt: submittedAt
}

const record: AccountOverviewRecord = {
  event: {
    id: 'build-day',
    slug: 'build-day',
    name: 'Build Day',
    city: 'Vienna',
    country: 'Austria',
    eventType: 'build',
    state: 'registration_open',
    startsAt: '2026-12-05T09:00:00Z',
    registrationOpensAt: '2026-11-01T08:00:00Z',
    registrationClosesAt: '2026-12-03T18:00:00Z',
    submissionClosesAt: null,
    maxTeamMembers: 4
  },
  application,
  isPast: false,
  lastActivityAt: submittedAt,
  activeTeam: null,
  latestTeam: null,
  latestSubmission: null,
  outcome: null
}

const meta = {
  title: 'Participant/Events/Participation card',
  component: EventParticipationCard
} satisfies Meta<typeof EventParticipationCard>

export default meta
type Story = StoryObj<typeof meta>

export const PendingReview: Story = { args: { record } }

export const CertificateAvailable: Story = {
  args: {
    record: {
      ...record,
      isPast: true,
      lastActivityAt: checkedInAt,
      event: { ...record.event, state: 'completed' },
      application: {
        ...application,
        status: 'approved',
        reviewedAt: submittedAt,
        checkedInAt,
        isCheckedIn: true,
        updatedAt: checkedInAt
      }
    }
  }
}
