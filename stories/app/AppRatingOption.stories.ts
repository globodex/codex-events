import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import { shallowRef } from 'vue'

import AppRatingOption from '~/components/AppRatingOption.vue'

const meta = {
  title: 'Shared/AppRatingOption',
  component: AppRatingOption,
  args: { checked: false }
} satisfies Meta<typeof AppRatingOption>

export default meta

type Story = StoryObj<typeof meta>

export const RatingScale: Story = {
  render: () => ({
    components: { AppRatingOption },
    setup: () => ({ rating: shallowRef(3) }),
    template: `
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Workshop rating">
        <AppRatingOption
          v-for="score in 5"
          :key="score"
          :checked="rating === score"
          @click="rating = score"
        >
          {{ score }}
        </AppRatingOption>
      </div>
    `
  })
}

export const Invalid: Story = {
  args: { invalid: true },
  render: args => ({
    components: { AppRatingOption },
    setup: () => ({ args }),
    template: `
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Workshop rating">
        <AppRatingOption v-for="score in 5" :key="score" v-bind="args">
          {{ score }}
        </AppRatingOption>
      </div>
    `
  })
}

export const ReadOnly: Story = {
  render: () => ({
    components: { AppRatingOption },
    template: `
      <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Workshop rating">
        <AppRatingOption v-for="score in 5" :key="score" :checked="score === 3" disabled>
          {{ score }}
        </AppRatingOption>
      </div>
    `
  })
}
