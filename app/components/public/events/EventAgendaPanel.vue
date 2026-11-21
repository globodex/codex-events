<script setup lang="ts">
import {
  getAgendaItemPresentation,
  shouldShowAgendaDayContext,
  type PublicEventAgendaItem
} from '~/domains/events/presentation'

const props = defineProps<{
  agendaItems: PublicEventAgendaItem[]
  program?: { itemId: string, href: string }
}>()

const sortedAgendaItems = computed(() =>
  [...props.agendaItems]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.startsAt.localeCompare(right.startsAt))
)
const showAgendaDayContext = computed(() => shouldShowAgendaDayContext(sortedAgendaItems.value))
const agendaEntries = computed(() =>
  sortedAgendaItems.value.map(item => ({
    ...item,
    presentation: getAgendaItemPresentation(item, showAgendaDayContext.value)
  }))
)

const agendaTimeChipClasses = 'flex min-w-0 items-center justify-center rounded-full border border-black/8 bg-white/80 px-2.5 py-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#C9C9C9]'
</script>

<template>
  <section
    v-if="agendaEntries.length > 0"
    class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
    data-testid="public-event-agenda"
  >
    <div
      class="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -right-10 top-6 size-28 rounded-full bg-amber-500/12 blur-3xl"
      aria-hidden="true"
    />

    <div class="relative mb-6 flex items-center gap-3 border-b border-black/8 pb-5 dark:border-white/[0.08]">
      <span class="flex size-8 items-center justify-center rounded-full border border-black/8 bg-white/80 text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-amber-300">
        <AppIcon
          name="i-lucide-calendar-range"
          class="size-4"
        />
      </span>
      <h2 class="text-xl font-semibold tracking-[-0.03em] text-highlighted dark:text-white">
        Agenda
      </h2>
    </div>

    <div class="relative lg:pl-[7.5rem]">
      <div class="absolute bottom-2 left-[6rem] top-2 hidden w-px bg-black/12 dark:bg-white/[0.14] lg:block" />

      <ol class="space-y-3.5">
        <li
          v-for="item in agendaEntries"
          :key="item.id"
          class="relative"
        >
          <div
            class="absolute left-[-2rem] top-1/2 hidden size-4 -translate-y-1/2 rounded-full border-[3px] border-[#FAF7EF] bg-amber-500 shadow-[0_0_0_6px_rgba(250,247,239,0.92)] dark:border-[#101010] dark:bg-amber-300 dark:shadow-[0_0_0_6px_rgba(16,16,16,0.9)] lg:block"
            aria-hidden="true"
          />
          <div class="absolute left-[-7.5rem] top-1/2 hidden w-[5rem] -translate-y-1/2 text-right lg:block">
            <div
              class="text-[12px] font-medium leading-tight text-neutral-500 dark:text-[#8C8C8C]"
              :title="item.presentation.metaLabel"
            >
              <template v-if="item.presentation.dayLabel">
                <p>{{ item.presentation.dateLabel }}</p>
              </template>
              <template v-else>
                <div class="ml-auto flex w-fit flex-col items-center gap-0.5">
                  <p class="whitespace-nowrap">
                    {{ item.presentation.timeLines[0] }}
                  </p>
                  <AppIcon
                    v-if="item.presentation.timeFlowDirection === 'down'"
                    name="i-lucide-arrow-down"
                    class="size-3 text-amber-700/80 dark:text-amber-300/75"
                  />
                  <p
                    v-if="item.presentation.timeLines[1]"
                    class="whitespace-nowrap"
                  >
                    {{ item.presentation.timeLines[1] }}
                  </p>
                </div>
              </template>
            </div>
            <p
              v-if="item.presentation.dayLabel"
              class="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/75"
            >
              {{ item.presentation.dayLabel }}
            </p>
          </div>

          <div class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 group relative overflow-hidden rounded-[1.35rem] p-4 transition duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:border-black/15 active:translate-y-px dark:hover:border-white/[0.16] sm:p-5">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 flex-1">
                <div
                  v-if="item.presentation.dayLabel"
                  class="mb-3 flex flex-wrap items-center gap-2"
                >
                  <span class="inline-flex items-center rounded-full border border-black/8 bg-black/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700/80 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-amber-300/75">
                    {{ item.presentation.dayLabel }}
                  </span>
                  <span class="inline-flex items-center rounded-full border border-black/8 bg-white/78 px-3 py-1 text-[11px] font-medium text-neutral-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#C9C9C9]">
                    {{ item.presentation.dateLabel }}
                  </span>
                </div>

                <NuxtLink
                  v-if="program?.itemId === item.id"
                  :to="program.href"
                  class="inline-flex items-center gap-2 rounded-sm text-[17px] font-semibold tracking-[-0.02em] text-highlighted underline-offset-4 hover:underline dark:text-white"
                >
                  {{ item.title }}
                  <AppIcon name="i-lucide-arrow-right" class="size-4" aria-hidden="true" />
                </NuxtLink>
                <p v-else class="text-[17px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                  {{ item.title }}
                </p>
                <p
                  v-if="item.details"
                  class="mt-2 max-w-[62ch] text-sm leading-6 text-neutral-600 dark:text-[#AFAFAF]"
                >
                  {{ item.details }}
                </p>
              </div>

              <div
                v-if="item.presentation.timeLines[1]"
                class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:hidden"
                :title="item.presentation.metaLabel"
              >
                <div :class="agendaTimeChipClasses">
                  <span class="truncate">
                    {{ item.presentation.timeLines[0] }}
                  </span>
                </div>

                <span
                  class="inline-flex size-7 items-center justify-center rounded-full border border-black/8 bg-white/78 text-neutral-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#A3A3A3]"
                  aria-hidden="true"
                >
                  <AppIcon
                    name="i-lucide-arrow-right"
                    class="size-3.5"
                  />
                </span>

                <div :class="agendaTimeChipClasses">
                  <span class="truncate">
                    {{ item.presentation.timeLines[1] }}
                  </span>
                </div>
              </div>

              <div
                :class="[
                  agendaTimeChipClasses,
                  'shrink-0',
                  item.presentation.timeLines[1]
                    ? 'hidden sm:inline-flex lg:hidden'
                    : item.presentation.dayLabel ? 'inline-flex' : 'inline-flex lg:hidden'
                ]"
                :title="item.presentation.metaLabel"
              >
                {{ item.presentation.timeLabel }}
              </div>
            </div>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>
