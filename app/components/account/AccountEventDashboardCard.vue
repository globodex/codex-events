<script setup lang="ts">
import type { PublicEventState } from '~/domains/events/presentation'
import type { EventState } from '~/domains/events/states'

import EventStateBadge from '~/components/public/events/EventStateBadge.vue'
import { collapseMarkdownToPlainText } from '~/domains/events/description'

interface AccountEventDashboardCardAction {
  label: string
  to: string
}

interface AccountEventDashboardCardItem {
  id: string
  name: string
  description: string
  state: EventState | PublicEventState
  registrationOpensAt: string
  registrationClosesAt: string
  to: string
  actionLabel?: string
  overline?: string
  meta: string[]
  externalAction?: AccountEventDashboardCardAction
}

const props = defineProps<{
  item: AccountEventDashboardCardItem
  expanded: boolean
}>()

const emit = defineEmits<{
  toggleExpanded: []
}>()

const descriptionPreviewCharacterLimit = 280
const normalizedDescription = computed(() => collapseMarkdownToPlainText(props.item.description))
const descriptionPreview = computed(() => {
  if (props.expanded || normalizedDescription.value.length <= descriptionPreviewCharacterLimit) {
    return normalizedDescription.value
  }

  return `${normalizedDescription.value.slice(0, descriptionPreviewCharacterLimit).trimEnd()}…`
})
const shouldShowDescriptionToggle = computed(() =>
  normalizedDescription.value.length > descriptionPreviewCharacterLimit
)
</script>

<template>
  <article class="rounded-xl border border-black/8 bg-white p-5 transition-colors hover:border-black/20 dark:border-white/[0.08] dark:bg-[#111111] dark:hover:border-white/[0.2]">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <p
          v-if="props.item.overline"
          class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
        >
          {{ props.item.overline }}
        </p>

        <div class="flex flex-wrap items-center gap-2">
          <p class="text-[18px] font-semibold text-highlighted dark:text-white">
            {{ props.item.name }}
          </p>
          <EventStateBadge
            :state="props.item.state"
            :registration-opens-at="props.item.registrationOpensAt"
            :registration-closes-at="props.item.registrationClosesAt"
          />
        </div>

        <p class="max-w-3xl break-words text-[14px] text-neutral-600 dark:text-[#B0B0B0]">
          {{ descriptionPreview }}
        </p>

        <AppButton
          v-if="shouldShowDescriptionToggle"
          color="neutral"
          variant="ghost"
          class="h-auto p-0 text-[13px] text-highlighted hover:bg-transparent hover:text-neutral-700 dark:hover:bg-transparent dark:hover:text-[#D9D9D9]"
          :label="props.expanded ? 'Show less' : 'Load more'"
          @click="emit('toggleExpanded')"
        />

        <div class="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span
            v-for="metaItem in props.item.meta"
            :key="metaItem"
            class="min-w-0"
          >
            {{ metaItem }}
          </span>
        </div>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1.5">
        <AppButton
          :to="props.item.to"
          color="neutral"
          variant="solid"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
          class="rounded-lg bg-black px-4 py-2 text-white hover:bg-black/90 hover:text-white dark:bg-white dark:text-black dark:hover:bg-[#ECECEC]"
        >
          {{ props.item.actionLabel ?? 'Open' }}
        </AppButton>

        <AppButton
          v-if="props.item.externalAction"
          :to="props.item.externalAction.to"
          color="neutral"
          variant="outline"
          size="sm"
          external
          target="_blank"
          rel="noopener noreferrer"
          trailing-icon="i-lucide-external-link"
          class="rounded-lg px-4 py-2"
        >
          {{ props.item.externalAction.label }}
        </AppButton>
      </div>
    </div>
  </article>
</template>
