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
