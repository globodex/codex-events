import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import AccountEventProgramTimeline from '~/components/account/events/AccountEventProgramTimeline.vue'
import { buildDayProgram } from './fixtures/build-day.fixtures'

const meta = {
  title: 'Participant/Build Time/Timeline',
  component: AccountEventProgramTimeline,
  args: {
    tracks: buildDayProgram.tracks,
    floorPlans: buildDayProgram.floorPlans,
    startsAt: buildDayProgram.agendaItem.startsAt,
    endsAt: buildDayProgram.agendaItem.endsAt,
    selectedSessionId: null,
    now: Date.parse('2026-10-16T10:00:00Z')
  },
  parameters: { controls: { disable: true } },
  decorators: [() => ({
    template: '<div class="max-w-xl"><story /></div>'
  })]
} satisfies Meta<typeof AccountEventProgramTimeline>

export default meta

type Story = StoryObj<typeof meta>

export const BeforeTheProgram: Story = {}

export const InProgress: Story = {
  args: { now: Date.parse('2026-10-17T10:25:00Z') }
}

export const SelectedSession: Story = {
  args: { selectedSessionId: 'prototype' }
}
