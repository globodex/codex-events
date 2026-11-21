<script setup lang="ts">
import type { EventBuilderBlockInstance, EventBuilderScheduleEntry } from '~/domains/events/builder'
import { eventBuilderBlockDefinitions } from '#shared/domains/events/builder-blocks'
import { getScaledBlockEnergyDelta, getScaledBlockFocusCost } from '#shared/domains/events/builder-scoring'
import { eventBuilderBlockIcons, getBlockDurationMinutes } from '~/domains/events/builder'
import { formatLocalTime } from '~/lib/date-formatting'
import AdminBuilderDurationStepper from '~/components/admin/builder/molecules/AdminBuilderDurationStepper.vue'

const props = defineProps<{
  block: EventBuilderBlockInstance
  schedule?: EventBuilderScheduleEntry
  index: number
}>()

const emit = defineEmits<{
  updateTitle: [id: string, title: string]
  updateDetails: [id: string, details: string]
  updateDuration: [id: string, minutes: number]
  updateFocusCost: [id: string, value: number]
  updateEnergyDelta: [id: string, value: number]
  clone: [id: string]
  remove: [id: string]
}>()

const detailsOpen = ref(false)
const hasDetails = computed(() => props.block.details.trim().length > 0)

function parseDial(value: string | number | undefined, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

const definition = computed(() => eventBuilderBlockDefinitions[props.block.type])
const durationMinutes = computed(() => getBlockDurationMinutes(props.block))

const timeRange = computed(() => {
  if (!props.schedule?.startsAt) {
    return ''
  }

  const start = formatLocalTime(props.schedule.startsAt)
  return props.schedule.endsAt ? `${start} – ${formatLocalTime(props.schedule.endsAt)}` : start
})

const scaledFocus = computed(() =>
  Math.round(getScaledBlockFocusCost(definition.value, durationMinutes.value)))

const focusLabel = computed(() => scaledFocus.value === 0 ? '±0' : `−${scaledFocus.value}`)

const scaledEnergy = computed(() =>
  Math.round(getScaledBlockEnergyDelta(definition.value, durationMinutes.value)))

const energyLabel = computed(() => {
  if (scaledEnergy.value === 0) {
    return '±0'
  }

  return scaledEnergy.value > 0 ? `+${scaledEnergy.value}` : `−${Math.abs(scaledEnergy.value)}`
})

const durationModel = computed({
  get: () => durationMinutes.value,
  set: value => emit('updateDuration', props.block.id, value)
})
</script>

<template>
  <div class="min-w-0">
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-toned dark:bg-white/[0.06]"
        :title="definition.label"
      >
        <AppIcon
          :name="eventBuilderBlockIcons[block.type]"
          class="size-4.5"
        />
      </span>

      <AppInput
        :model-value="block.title"
        size="sm"
        class="min-w-24 flex-1"
        :aria-label="`Title for block ${index + 1}`"
        @update:model-value="value => emit('updateTitle', block.id, String(value))"
      />

      <span
        v-if="timeRange"
        class="hidden shrink-0 text-xs tabular-nums text-dimmed lg:inline"
      >
        {{ timeRange }}
      </span>

      <AdminBuilderDurationStepper
        v-model="durationModel"
        :block-id="block.id"
      />

      <span class="hidden w-44 shrink-0 items-center justify-center gap-2 sm:flex">
        <template v-if="block.custom">
          <label
            class="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-white p-1 pl-2 transition focus-within:border-black/25 dark:border-white/[0.08] dark:bg-[#151515] dark:focus-within:border-white/[0.25]"
            title="Focus cost for this custom block"
          >
            <AppIcon
              name="i-lucide-crosshair"
              class="size-3.5 shrink-0 text-sky-500"
            />
            <input
              type="number"
              min="0"
              max="99"
              :value="block.focusCost ?? 0"
              :aria-label="`Focus cost for ${block.title}`"
              :data-testid="`event-builder-focus-dial-${block.id}`"
              class="h-7 w-9 bg-transparent text-center text-xs font-medium tabular-nums text-sky-500 outline-none"
              @change="event => emit('updateFocusCost', block.id, parseDial((event.target as HTMLInputElement).value, block.focusCost ?? 0))"
            >
          </label>
          <label
            class="inline-flex items-center gap-1 rounded-lg border border-black/8 bg-white p-1 pl-2 transition focus-within:border-black/25 dark:border-white/[0.08] dark:bg-[#151515] dark:focus-within:border-white/[0.25]"
            title="Energy delta for this custom block"
          >
            <AppIcon
              :name="(block.energyDelta ?? 0) >= 0 ? 'i-lucide-battery-charging' : 'i-lucide-battery-low'"
              class="size-3.5 shrink-0"
              :class="(block.energyDelta ?? 0) >= 0 ? 'text-emerald-500' : 'text-amber-500'"
            />
            <input
              type="number"
              min="-99"
              max="99"
              :value="block.energyDelta ?? 0"
              :aria-label="`Energy delta for ${block.title}`"
              :data-testid="`event-builder-energy-dial-${block.id}`"
              class="h-7 w-11 bg-transparent text-center text-xs font-medium tabular-nums outline-none"
              :class="(block.energyDelta ?? 0) >= 0 ? 'text-emerald-500' : 'text-amber-500'"
              @change="event => emit('updateEnergyDelta', block.id, parseDial((event.target as HTMLInputElement).value, block.energyDelta ?? 0))"
            >
          </label>
        </template>
        <template v-else>
          <span
            class="inline-flex items-center gap-0.5 text-xs tabular-nums text-sky-500"
            :title="`Focus cost ${scaledFocus}`"
          >
            <AppIcon
              name="i-lucide-crosshair"
              class="size-3.5"
            />{{ focusLabel }}
          </span>
          <span
            class="inline-flex items-center gap-0.5 text-xs tabular-nums"
            :class="scaledEnergy >= 0 ? 'text-emerald-500' : 'text-amber-500'"
            :title="`Energy ${energyLabel}`"
          >
            <AppIcon
              :name="scaledEnergy >= 0 ? 'i-lucide-battery-charging' : 'i-lucide-battery-low'"
              class="size-3.5"
            />{{ energyLabel }}
          </span>
        </template>
      </span>

      <button
        type="button"
        :aria-label="`Duplicate ${block.title}`"
        title="Duplicate this block"
        :data-testid="`event-builder-clone-block-${block.id}`"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-black/5 hover:text-highlighted dark:hover:bg-white/[0.06]"
        @click="emit('clone', block.id)"
      >
        <AppIcon
          name="i-lucide-copy"
          class="size-3.5"
        />
      </button>

      <button
        type="button"
        :aria-expanded="detailsOpen"
        :aria-label="hasDetails ? `Edit the description of ${block.title}` : `Add a description to ${block.title}`"
        :title="hasDetails ? 'Edit description' : 'Add description'"
        :data-testid="`event-builder-block-details-toggle-${block.id}`"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition hover:bg-black/5 hover:text-highlighted dark:hover:bg-white/[0.06]"
        :class="hasDetails ? 'text-highlighted' : 'text-muted'"
        @click="detailsOpen = !detailsOpen"
      >
        <AppIcon
          name="i-lucide-chevron-down"
          class="size-4 transition-transform"
          :class="detailsOpen ? 'rotate-180' : ''"
        />
      </button>

      <button
        type="button"
        :aria-label="`Remove ${block.title}`"
        :data-testid="`event-builder-remove-block-${block.id}`"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
        @click="emit('remove', block.id)"
      >
        <AppIcon
          name="i-lucide-trash-2"
          class="size-4"
        />
      </button>
    </div>

    <div
      v-if="detailsOpen"
      class="mt-2 pl-11.5 animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <label class="grid gap-1.5">
        <span class="text-xs font-medium text-toned">Description</span>
        <AppTextarea
          :model-value="block.details"
          rows="1"
          size="sm"
          placeholder="Optional notes for this agenda item."
          :data-testid="`event-builder-block-details-${block.id}`"
          @update:model-value="value => emit('updateDetails', block.id, String(value ?? ''))"
        />
      </label>
    </div>
  </div>
</template>
