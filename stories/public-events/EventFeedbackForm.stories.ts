import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { createFetch } from 'ofetch'
import EventFeedbackForm from '~/components/public/events/EventFeedbackForm.vue'
import { publicBuildDay } from './fixtures/build-day'

const feedbackPath = `/api/public/events/${publicBuildDay.slug}/feedback`

const meta = {
  title: 'Public/Event/Feedback',
  component: EventFeedbackForm,
  args: { eventSlug: publicBuildDay.slug, eventType: 'build' },
  parameters: { controls: { exclude: ['eventSlug'] } },
  beforeEach() {
    const previousFetch = globalThis.$fetch

    const fixtureFetch = createFetch({
      fetch: async (request, options) => {
        if (request === feedbackPath && options?.method === 'POST') {
          return Response.json({ data: {} })
        }

        return new Response(null, { status: 404 })
      }
    })

    globalThis.$fetch = fixtureFetch as unknown as typeof globalThis.$fetch

    return () => {
      globalThis.$fetch = previousFetch
    }
  }
} satisfies Meta<typeof EventFeedbackForm>

export default meta

type Story = StoryObj<typeof meta>

export const Build: Story = {}

export const Hackathon: Story = { args: { eventType: 'hackathon' } }
