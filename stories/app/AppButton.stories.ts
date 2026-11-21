import type { Meta, StoryObj } from '@storybook-vue/nuxt'

import AppButton from '~/components/AppButton.vue'
import AppCard from '~/components/AppCard.vue'

const colors = ['primary', 'secondary', 'neutral', 'success', 'warning', 'error', 'info'] as const
const variants = ['solid', 'soft', 'subtle', 'ghost', 'outline'] as const
const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const

const meta = {
  title: 'Shared/AppButton',
  component: AppButton,
  args: { label: 'Save changes' },
  argTypes: {
    color: { control: 'select', options: colors },
    variant: { control: 'select', options: variants },
    size: { control: 'select', options: sizes }
  }
} satisfies Meta<typeof AppButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ColorsAndVariants: Story = {
  render: () => ({
    components: { AppButton },
    setup: () => ({ colors, variants }),
    template: `
      <div class="overflow-x-auto">
        <table class="border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th scope="col">Color</th>
              <th v-for="variant in variants" :key="variant" scope="col" class="capitalize">
                {{ variant }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="color in colors" :key="color">
              <th scope="row" class="pe-2 text-left font-medium capitalize">{{ color }}</th>
              <td v-for="variant in variants" :key="variant">
                <AppButton
                  :color="color"
                  :variant="variant"
                  label="Continue"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  })
}

export const Sizes: Story = {
  render: () => ({
    components: { AppButton },
    setup: () => ({ sizes }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppButton v-for="size in sizes" :key="size" :size="size" :label="size.toUpperCase()" />
      </div>
    `
  })
}

export const Icons: Story = {
  render: () => ({
    components: { AppButton },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppButton label="Add session" icon="i-lucide-plus" />
        <AppButton label="Continue" trailing-icon="i-lucide-arrow-right" />
        <AppButton
          variant="outline"
          color="neutral"
          aria-label="Edit session"
          icon="i-lucide-pencil"
          size="sm"
          class="w-8 p-0"
        />
      </div>
    `
  })
}

export const Links: Story = {
  render: () => ({
    components: { AppButton },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppButton to="#storybook-link-example" label="Internal link" @click.prevent />
        <AppButton
          to="https://example.com/"
          external
          target="_blank"
          rel="noopener noreferrer"
          label="External link"
          trailing-icon="i-lucide-external-link"
          @click.prevent
        />
        <AppButton to="#storybook-link-example" label="Internal link unavailable" disabled />
        <AppButton to="https://example.com/" external label="Opening external link" loading />
      </div>
    `
  })
}

export const LoadingAndDisabled: Story = {
  render: () => ({
    components: { AppButton },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppButton label="Save changes" />
        <AppButton label="Saving changes" icon="i-lucide-save" loading />
        <AppButton label="Save unavailable" disabled />
        <AppButton label="Cancel unavailable" variant="outline" color="neutral" disabled />
      </div>
    `
  })
}

export const KeyboardFocus: Story = {
  parameters: {
    docs: { description: { story: 'Press Tab to see the focus ring. The disabled button is skipped.' } }
  },
  render: () => ({
    components: { AppButton },
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <AppButton label="Continue" />
        <AppButton label="Unavailable" disabled />
        <AppButton label="Cancel" color="neutral" variant="outline" />
      </div>
    `
  })
}

export const EventSettings: Story = {
  globals: { theme: 'dark' },
  render: () => ({
    components: { AppButton, AppCard },
    template: `
      <div class="grid w-full max-w-sm gap-3">
        <AppCard :ui="{ body: 'p-4' }">
          <template #header><h2 class="text-sm font-semibold">Tracks</h2></template>
          <AppButton label="Add track" trailing-icon="i-lucide-plus" color="neutral" variant="outline" size="sm" />
        </AppCard>
        <AppCard :ui="{ body: 'p-4' }">
          <template #header><h2 class="text-sm font-semibold">Luma connection</h2></template>
          <AppButton label="Connect Luma" color="neutral" variant="outline" />
        </AppCard>
      </div>
    `
  })
}
