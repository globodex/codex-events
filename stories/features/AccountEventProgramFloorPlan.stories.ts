import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AccountEventProgramFloorPlan from '~/components/account/events/AccountEventProgramFloorPlan.vue'
import { buildDayGroundFloor, buildDayUpperFloor } from './fixtures/build-day.fixtures'

const meta = {
  title: 'Participant/Build Time/Floor plan',
  component: AccountEventProgramFloorPlan,
  args: { plan: buildDayGroundFloor, selectedRoom: null },
  decorators: [() => ({
    template: '<div class="mx-auto max-w-xl"><story /></div>'
  })]
} satisfies Meta<typeof AccountEventProgramFloorPlan>

export default meta

type Story = StoryObj<typeof meta>

export const NoRoomSelected: Story = {}

export const HighlightedRoom: Story = {
  args: { selectedRoom: buildDayGroundFloor.rooms[0]! }
}

export const DifferentFloor: Story = {
  args: { plan: buildDayUpperFloor, selectedRoom: buildDayUpperFloor.rooms[0]! }
}
