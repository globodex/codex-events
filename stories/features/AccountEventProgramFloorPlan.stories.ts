import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { computed, shallowRef } from 'vue'
import AccountEventProgramFloorPlan from '~/components/account/events/molecules/AccountEventProgramFloorPlan.vue'
import { buildDayGroundFloor, buildDayUpperFloor } from './fixtures/build-day.fixtures'

const meta = {
  title: 'Participant/Build Time/Floor plan',
  component: AccountEventProgramFloorPlan,
  args: { plan: buildDayGroundFloor, selectedRooms: [], roomHint: 'Tap a session to see its room' },
  render: args => ({
    components: { AccountEventProgramFloorPlan },
    setup() {
      // A click on the map selects one room. Before the first click the story's rooms are selected.
      const selectedRoomId = shallowRef<string | null>(null)
      const selectedRooms = computed(() => selectedRoomId.value
        ? args.plan.rooms.filter(room => room.id === selectedRoomId.value)
        : args.selectedRooms)

      return { args, selectedRooms, selectedRoomId }
    },
    template: `
      <AccountEventProgramFloorPlan
        :plan="args.plan"
        :selected-rooms="selectedRooms"
        :room-hint="args.roomHint"
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
  args: { selectedRooms: [buildDayGroundFloor.rooms[1]!] }
}

export const RouteToRoom: Story = {
  args: { selectedRooms: [buildDayGroundFloor.rooms[0]!] }
}

export const DifferentFloor: Story = {
  args: { plan: buildDayUpperFloor, selectedRooms: [buildDayUpperFloor.rooms[0]!] }
}
