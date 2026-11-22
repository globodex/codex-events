import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import EventAgendaPanel from '~/components/public/events/EventAgendaPanel.vue'
import { publicBuildDay } from './fixtures/build-day'

const meta = {
  title: 'Public/Event/Agenda',
  component: EventAgendaPanel,
  args: {
    agendaItems: publicBuildDay.agendaItems
  }
} satisfies Meta<typeof EventAgendaPanel>

export default meta

type Story = StoryObj<typeof meta>

export const PublicAgenda: Story = {}

const firstBlock = publicBuildDay.agendaItems[0]!

/** A time the given number of minutes after the start of the first agenda block. */
function minutesIntoFirstBlock(minutes: number) {
  return new Date(Date.parse(firstBlock.startsAt) + minutes * 60_000).toISOString()
}

export const WithPublicSessions: Story = {
  args: {
    publicSessions: {
      agendaItemId: firstBlock.id,
      sessions: [
        { id: 'doors', title: 'Doors open and check-in', startsAt: minutesIntoFirstBlock(0) },
        { id: 'kickoff', title: 'Kickoff', startsAt: minutesIntoFirstBlock(30) },
        { id: 'lunch', title: 'Lunch', startsAt: minutesIntoFirstBlock(180) }
      ]
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'The organizer made three sessions public. The panel lists them under their agenda block, each with its start time.'
      }
    }
  }
}
