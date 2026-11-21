import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { computed, shallowRef } from 'vue'
import AccountEventProgramFloorPlan from '~/components/account/events/AccountEventProgramFloorPlan.vue'
import { buildDayGroundFloor, buildDayUpperFloor } from './fixtures/build-day.fixtures'

const meta = {
  title: 'Participant/Build Time/Floor plan',
  component: AccountEventProgramFloorPlan,
  args: { plan: buildDayGroundFloor, selectedRoom: null },
  render: args => ({
    components: { AccountEventProgramFloorPlan },
    setup() {
      const selectedRoomId = shallowRef<string | null>(null)
      const selectedRoom = computed(() => {
        const id = selectedRoomId.value ?? args.selectedRoom?.id
        return args.plan.rooms.find(room => room.id === id) ?? null
      })

      return { args, selectedRoom, selectedRoomId }
    },
    template: `
      <AccountEventProgramFloorPlan
        :plan="args.plan"
        :selected-room="selectedRoom"
        @select-room="selectedRoomId = $event"
      />
    `
  }),
  decorators: [() => ({
    template: '<div class="mx-auto max-w-xl"><story /></div>'
  })]
} satisfies Meta<typeof AccountEventProgramFloorPlan>

export default meta

type Story = StoryObj<typeof meta>

export const NoRoomSelected: Story = {}

export const HighlightedRoom: Story = {
  args: { selectedRoom: buildDayGroundFloor.rooms[1]! }
}

export const RouteToRoom: Story = {
  args: { selectedRoom: buildDayGroundFloor.rooms[0]! }
}

export const DifferentFloor: Story = {
  args: { plan: buildDayUpperFloor, selectedRoom: buildDayUpperFloor.rooms[0]! }
}
