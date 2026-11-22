import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'

import { fn } from 'storybook/test'

import AdminApplicationsReviewPanel from '~/components/applications/AdminApplicationsReviewPanel.vue'

const applicationDate = '2026-12-01T10:00:00.000Z'
const applicationDefaults = {
  eventId: 'build-day',
  submittedAt: applicationDate,
  withdrawnAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
  applicationTermsDocumentId: null,
  applicationTermsAcceptedAt: null,
  createdAt: applicationDate,
  updatedAt: applicationDate,
  registrationDetailsJson: JSON.stringify({
    teamIntent: 'solo',
    whyThisEvent: 'I want to prototype a tool that helps volunteers hand over ongoing work.'
  })
}

const maya: AdminApplicationRecord = {
  ...applicationDefaults,
  id: 'application-maya',
  userId: 'user-maya',
  user: { id: 'user-maya', email: 'maya@example.test', displayName: 'Maya Patel' },
  status: 'submitted',
  preApprovalStatus: 'approved',
  selectedTrackId: 'prototypes'
}

const ellis: AdminApplicationRecord = {
  ...applicationDefaults,
  id: 'application-ellis',
  userId: 'user-ellis',
  user: { id: 'user-ellis', email: 'ellis@example.test', displayName: 'Ellis Novak' },
  status: 'submitted',
  selectedTrackId: 'workflows'
}

const meta = {
  title: 'Admin/Participant review',
  component: AdminApplicationsReviewPanel,
  args: {
    eventId: 'build-day',
    eventState: 'registration_open',
    view: 'applications',
    applications: [maya, ellis],
    tracks: [
      { id: 'prototypes', name: 'Prototypes', displayOrder: 0 },
      { id: 'workflows', name: 'Workflows', displayOrder: 1 }
    ],
    searchEnabled: true,
    onApprove: fn(),
    onReject: fn(),
    onCheckIn: fn(),
    onSaveDecisions: fn()
  },
  argTypes: { applications: { control: false } }
} satisfies Meta<typeof AdminApplicationsReviewPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Review: Story = {}

export const Approving: Story = {
  args: { pendingActionKey: 'stage:approved:application-ellis' }
}

export const Attendance: Story = {
  args: {
    view: 'approved',
    applications: [
      { ...maya, status: 'approved', preApprovalStatus: null, checkedInAt: '2026-12-05T09:10:00.000Z' },
      { ...ellis, status: 'approved' }
    ]
  }
}

export const CheckingIn: Story = {
  args: {
    ...Attendance.args,
    pendingActionKey: 'check-in:application-ellis'
  }
}
