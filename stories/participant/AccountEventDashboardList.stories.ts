import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { AccountEventDashboardListItem } from '~/components/account/AccountEventDashboardList.vue'

import AccountEventDashboardList from '~/components/account/AccountEventDashboardList.vue'

const description = [
  'Bring something you have been meaning to build, or find a collaborator at the event.',
  'In the morning, there are short workshops on connecting tools and working with project context.',
  'The afternoon is open for building, with mentors available to help.',
  'We will finish by sharing demos and what we learned.'
].join(' ')

const events: AccountEventDashboardListItem[] = [
  {
    id: 'build-day',
    name: 'Build Day',
    description,
    state: 'registration_open',
    registrationOpensAt: '2026-11-01T08:00:00Z',
    registrationClosesAt: '2026-12-03T18:00:00Z',
    sortAt: '2026-12-05T09:00:00Z',
    to: '/account/events/build-day',
    actionLabel: 'Open overview',
    meta: ['Build', 'Dec 5', 'Vienna']
  },
  {
    id: 'show-and-tell',
    name: 'Project Show and Tell',
    description: 'Bring a short demo and see what others have been building.',
    state: 'registration_open',
    registrationOpensAt: '2026-11-01T08:00:00Z',
    registrationClosesAt: '2026-12-13T18:00:00Z',
    sortAt: '2026-12-15T17:00:00Z',
    to: '/events/project-show-and-tell',
    actionLabel: 'View event',
    meta: ['Meetup', 'Dec 15', 'Vienna']
  }
]

const meta = {
  title: 'Participant/Events/Event list',
  component: AccountEventDashboardList,
  args: {
    title: 'Your events',
    description: 'See your upcoming events.',
    emptyTitle: 'No events yet',
    emptyDescription: 'Events appear here when you register.'
  }
} satisfies Meta<typeof AccountEventDashboardList>

export default meta
type Story = StoryObj<typeof meta>

export const UpcomingEvents: Story = { args: { items: events } }
export const Empty: Story = { args: { items: [] } }
