import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AccountEventProgramAgenda from '~/components/account/events/AccountEventProgramAgenda.vue'
import { buildDayProgram } from './fixtures/build-day.fixtures'

const meta = {
  title: 'Participant/Build Time/Agenda',
  component: AccountEventProgramAgenda,
  args: { program: buildDayProgram },
  parameters: { controls: { disable: true } }
} satisfies Meta<typeof AccountEventProgramAgenda>

export default meta

type Story = StoryObj<typeof meta>

export const SessionsAndFloorPlans: Story = {}

export const NoSessionsScheduled: Story = {
  args: { program: { ...buildDayProgram, tracks: [], floorPlans: [] } }
}
