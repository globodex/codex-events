<script setup lang="ts">
import {
  formatPrizeRank,
  formatPrizeReward,
  formatPrizeScope,
  type PublicPrize
} from '~/domains/events/presentation'

const props = withDefaults(defineProps<{
  prizes: Array<PublicPrize & {
    id?: string
  }>
  title?: string
}>(), {
  title: 'Published awards'
})

function getPodiumCup(prize: PublicPrize) {
  if (prize.rankStart !== prize.rankEnd) {
    return null
  }

  if (prize.rankStart === 1) {
    return {
      label: 'Gold cup',
      class: 'text-amber-400'
    }
  }

  if (prize.rankStart === 2) {
    return {
      label: 'Silver cup',
      class: 'text-slate-300'
    }
  }

  if (prize.rankStart === 3) {
    return {
      label: 'Bronze cup',
      class: 'text-orange-500'
    }
  }

  return null
}
</script>

<template>
  <section
    class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 rounded-xl p-6"
    data-testid="public-event-prizes"
  >
    <h2 class="mb-4 text-[16px] font-medium text-highlighted dark:text-white">
      {{ props.title }}
    </h2>

    <div
      v-if="props.prizes.length === 0"
      class="text-[14px] leading-relaxed text-neutral-500 dark:text-[#A3A3A3]"
    >
      This program has not published prize definitions yet.
    </div>

    <div
      v-else
      class="divide-y divide-black/8 dark:divide-white/[0.08]"
    >
      <div
        v-for="prize in props.prizes"
        :key="`${prize.rankStart}-${prize.rankEnd}-${prize.name}`"
        class="py-5 first:pt-0 last:pb-0"
      >
        <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div class="min-w-0 flex flex-1 items-start gap-4">
            <div
              v-if="getPodiumCup(prize)"
              class="flex w-20 shrink-0 items-start justify-center pt-0.5"
            >
              <AppIcon
                name="i-lucide-trophy"
                class="text-amber-400"
                :class="getPodiumCup(prize)?.class"
                style="font-size: 44px;"
              />
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-[16px] font-semibold text-highlighted dark:text-white">
                  {{ prize.name }}
                </h3>
                <div class="text-[12px] font-medium text-neutral-500 dark:text-[#A3A3A3]">
                  {{ formatPrizeRank(prize) }}
                </div>
              </div>

              <p class="text-[14px] leading-relaxed text-neutral-500 dark:text-[#A3A3A3]">
                {{ prize.description }}
              </p>
            </div>
          </div>

          <div class="shrink-0 text-right">
            <p class="text-[16px] font-semibold text-highlighted dark:text-white">
              {{ formatPrizeReward(prize) }}
            </p>
            <p class="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-[#8C8C8C]">
              {{ formatPrizeScope(prize.awardScope) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
