import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { ApiClient } from '~/composables/useApiClient'
import type { EventRoleUserSummary } from '~/domains/events/access'

import AccountPlatformRoleRosterPanel from '~/components/account/organisms/AccountPlatformRoleRosterPanel.vue'
import { provideStorybookApiFixture } from '../../.storybook/api-client'
import { provideStorybookSession } from '../../.storybook/session'
import { administrator } from '../app/shell-session'

const sampleUsers: EventRoleUserSummary[] = [
  {
    id: 'jordan',
    displayName: 'Jordan Reyes',
    email: 'jordan@example.test',
    isPlatformAdmin: true,
    isEventOrganizer: true
  },
  {
    id: 'mei',
    displayName: 'Mei Tan',
    email: 'mei@example.test',
    isPlatformAdmin: true,
    isEventOrganizer: false
  },
  {
    id: 'maria',
    displayName: 'María Silva',
    email: 'maria@example.test',
    isPlatformAdmin: false,
    isEventOrganizer: true
  },
  {
    id: 'amira',
    displayName: 'Amira Haddad',
    email: 'amira@example.test',
    isPlatformAdmin: false,
    isEventOrganizer: false
  }
]

type Role = InstanceType<typeof AccountPlatformRoleRosterPanel>['$props']['role']

function buildRosterFixture(role: Role) {
  const listPath = `/api/${role}s`
  const roleFlag = role === 'platform-admin' ? 'isPlatformAdmin' : 'isEventOrganizer'
  let users = sampleUsers

  return (request: Parameters<ApiClient>[0], options?: Parameters<ApiClient>[1]) => {
    if (request === listPath) {
      return { data: users.filter(user => user[roleFlag]) }
    }

    if (request === `${listPath}/candidates`) {
      const search = String(options?.query?.search ?? '').toLowerCase()
      const matches = users.filter(user => `${user.displayName} ${user.email} ${user.id}`.toLowerCase().includes(search))
      return { data: matches, meta: { total: matches.length } }
    }

    const target = users.find(user => request === `${listPath}/${user.id}`)
    const method = options?.method
    if (!target || (method !== 'PUT' && method !== 'DELETE')) {
      throw new Error('This request is unavailable in the role roster preview.')
    }

    const updated = { ...target, [roleFlag]: method === 'PUT' }
    users = users.map(user => user.id === target.id ? updated : user)
    return { data: updated }
  }
}

const meta = {
  title: 'Admin/Platform settings/Role roster',
  component: AccountPlatformRoleRosterPanel,
  parameters: { controls: { disable: true } },
  render: args => ({
    components: { AccountPlatformRoleRosterPanel },
    setup() {
      provideStorybookSession(administrator)
      provideStorybookApiFixture(buildRosterFixture(args.role))
      return { args }
    },
    template: '<AccountPlatformRoleRosterPanel :role="args.role" />'
  })
} satisfies Meta<typeof AccountPlatformRoleRosterPanel>

export default meta

type Story = StoryObj<typeof meta>

export const PlatformAdmins: Story = { args: { role: 'platform-admin' } }

export const EventOrganizers: Story = { args: { role: 'event-organizer' } }
