import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { TeamDirectoryEntry } from '~/domains/teams/workspace'

import { computed, shallowRef } from 'vue'

import ParticipantTeamDirectoryPanel from '~/components/teams/ParticipantTeamDirectoryPanel.vue'
import { openToolsTeam as openTeam } from './teams'

const teamEntries: TeamDirectoryEntry[] = [
  {
    team: openTeam,
    detailHref: '/account/events/build-day/teams/open-tools',
    isOwnTeam: false,
    hasPendingJoinRequest: false,
    pendingJoinRequestId: null,
    joinAvailability: { isAllowed: true }
  },
  {
    team: {
      ...openTeam,
      id: 'quiet-workshop',
      name: 'Quiet Workshop',
      slug: 'quiet-workshop',
      bio: 'We are building a calendar that keeps blocks of focus time free.',
      createdByUserId: 'person-quiet-workshop',
      activeMemberCount: 4,
      isOpenToJoinRequests: false
    },
    detailHref: '/account/events/build-day/teams/quiet-workshop',
    isOwnTeam: false,
    isFull: true,
    hasPendingJoinRequest: false,
    pendingJoinRequestId: null,
    joinAvailability: { isAllowed: false, reason: 'This team is full.' }
  }
]

const meta = {
  title: 'Participant/Teams/Directory',
  component: ParticipantTeamDirectoryPanel,
  args: {
    teams: teamEntries,
    maxTeamMembers: 4,
    createTeamHref: '/account/events/build-day?tab=team',
    filterOptions: [
      { label: 'All', value: 'all', count: 2 },
      { label: 'Open to join', value: 'open', count: 1 }
    ]
  }
} satisfies Meta<typeof ParticipantTeamDirectoryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const BrowseTeams: Story = {
  render: args => ({
    components: { ParticipantTeamDirectoryPanel },
    setup() {
      const directoryFilter = shallowRef('all')
      const pendingTeamId = shallowRef<string | null>(null)
      const visibleTeams = computed(() => {
        const teams = directoryFilter.value === 'open'
          ? args.teams.filter(entry => entry.joinAvailability.isAllowed)
          : args.teams

        return teams.map(entry => entry.team.id === pendingTeamId.value
          ? { ...entry, hasPendingJoinRequest: true, pendingJoinRequestId: 'story-join-request' }
          : entry)
      })

      return { args, directoryFilter, pendingTeamId, visibleTeams }
    },
    template: `
      <ParticipantTeamDirectoryPanel
        v-bind="args"
        v-model:directory-filter="directoryFilter"
        :teams="visibleTeams"
        @join-team="pendingTeamId = $event"
        @cancel-join-request="pendingTeamId = null"
      />
    `
  })
}

export const Loading: Story = { args: { teams: [], isLoadingTeams: true } }
export const Empty: Story = { args: { teams: [], filterOptions: [] } }
