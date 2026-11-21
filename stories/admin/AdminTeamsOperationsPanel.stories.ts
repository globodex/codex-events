import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { AdminSubmissionDashboardFilter } from '~/domains/submissions/admin-operations'
import type { TeamSummary } from '~/domains/teams/admin-team-record'
import { computed, ref } from 'vue'
import AdminSubmissionInterventionsPanel from '~/components/admin/AdminSubmissionInterventionsPanel.vue'
import AdminTeamsOperationsPanel from '~/components/admin/AdminTeamsOperationsPanel.vue'
import {
  buildAdminOperationalTeams,
  filterAdminOperationalTeams,
  getAdminSubmissionDashboardMetrics
} from '~/domains/submissions/admin-operations'

interface OperationsStoryArgs {
  pendingActionKey: string | null
}

const time = '2026-09-12T17:00:00.000Z'
const mapTeam: TeamSummary = {
  id: 'map-team',
  eventId: 'build-vienna',
  name: 'Map Makers',
  slug: 'map-makers',
  bio: null,
  isOpenToJoinRequests: false,
  createdByUserId: 'ava',
  createdAt: time,
  updatedAt: time
}
const runnerTeam: TeamSummary = {
  ...mapTeam,
  id: 'runner-team',
  name: 'River Runners',
  slug: 'river-runners',
  createdByUserId: 'mika'
}
const teams = buildAdminOperationalTeams([mapTeam, runnerTeam], {
  submissions: [{
    id: 'workshop-finder',
    teamId: mapTeam.id,
    trackId: null,
    status: 'locked',
    projectName: 'Workshop Finder',
    summary: 'A map that highlights the room for each workshop.',
    repositoryUrl: null,
    demoUrl: null,
    submittedAt: time,
    lockedAt: time,
    withdrawnAt: null,
    disqualifiedAt: null,
    disqualificationReason: null,
    createdAt: time,
    updatedAt: time
  }]
})
const metrics = getAdminSubmissionDashboardMetrics(teams)

const meta = {
  title: 'Admin/Teams/Submission operations',
  component: AdminTeamsOperationsPanel,
  args: { pendingActionKey: null },
  render: args => ({
    components: { AdminTeamsOperationsPanel, AdminSubmissionInterventionsPanel },
    setup() {
      const search = ref('')
      const filter = ref<AdminSubmissionDashboardFilter>('all')
      const visibleTeams = computed(() => filterAdminOperationalTeams(teams, {
        search: search.value,
        filter: filter.value
      }))
      return { args, teams, metrics, search, filter, visibleTeams }
    },
    template: `
      <div class="mx-auto max-w-5xl space-y-4">
        <AdminTeamsOperationsPanel
          v-model:search="search"
          v-model:filter="filter"
          event-state="blind_review"
          :teams="visibleTeams"
          :metrics="metrics"
          :pending-action-key="args.pendingActionKey"
        />
        <AdminSubmissionInterventionsPanel
          event-state="blind_review"
          :teams="teams"
          :pending-action-key="args.pendingActionKey"
        />
      </div>
    `
  })
} satisfies Meta<OperationsStoryArgs>

export default meta

type Story = StoryObj<Partial<OperationsStoryArgs>>

export const DuringJudging: Story = {}
export const DisqualificationPending: Story = {
  args: { pendingActionKey: 'disqualify:map-team' }
}
