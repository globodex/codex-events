import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { TeamMemberRecord } from '~/domains/teams/workspace'

import { ref } from 'vue'
import { fn } from 'storybook/test'

import ParticipantTeamWorkspacePanel from '~/components/teams/ParticipantTeamWorkspacePanel.vue'
import { openToolsTeam as team } from './teams'

const owner: TeamMemberRecord = {
  id: 'owner-membership',
  teamId: team.id,
  userId: team.createdByUserId,
  role: 'admin',
  joinedAt: team.createdAt,
  leftAt: null,
  createdAt: team.createdAt,
  user: { id: team.createdByUserId, displayName: 'Casey Rivera' }
}

const member: TeamMemberRecord = {
  ...owner,
  id: 'member-membership',
  userId: 'person-member',
  role: 'member',
  user: { id: 'person-member', displayName: 'Robin Ellis' }
}

const allowed = { isAllowed: true }
const locked = { isAllowed: false, reason: 'Team formation is closed.' }

const meta = {
  title: 'Participant/Teams/Workspace',
  component: ParticipantTeamWorkspacePanel,
  args: {
    team: { ...team, members: [owner, member] },
    eventState: 'submission_open',
    maxTeamMembers: 4,
    membership: owner,
    canManageTeam: true,
    joinAvailability: { isAllowed: false },
    leaveAvailability: allowed,
    onCopyTeamLink: fn(),
    onLeaveTeam: fn()
  },
  render: args => ({
    components: { ParticipantTeamWorkspacePanel },
    setup() {
      const displayedTeam = ref({ ...args.team })
      async function saveProfile(fields: { name: string, bio: string }) {
        Object.assign(displayedTeam.value, fields)
        return true
      }
      return { args, displayedTeam, saveProfile }
    },
    template: `
      <ParticipantTeamWorkspacePanel
        v-bind="args"
        :team="displayedTeam"
        :save-profile="saveProfile"
        @toggle-join-policy="displayedTeam.isOpenToJoinRequests = $event"
      />
    `
  })
} satisfies Meta<typeof ParticipantTeamWorkspacePanel>

export default meta
type Story = StoryObj<typeof meta>

export const TeamOwner: Story = {}
export const Locked: Story = {
  args: {
    eventState: 'blind_review',
    isTeamLocked: true,
    joinPolicyAvailability: locked,
    leaveAvailability: locked
  }
}
