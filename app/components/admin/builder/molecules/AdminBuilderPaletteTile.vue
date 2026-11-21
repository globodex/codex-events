<script setup lang="ts">
import type { EventBuilderBlockType } from '#shared/domains/events/builder-blocks'
import { eventBuilderBlockDefinitions } from '#shared/domains/events/builder-blocks'
import { PopoverClose } from '~/components/ui/popover'
import { eventBuilderBlockIcons } from '~/domains/events/builder'

const props = defineProps<{
  type: EventBuilderBlockType
}>()

const emit = defineEmits<{
  add: [type: EventBuilderBlockType]
}>()

const definition = computed(() => eventBuilderBlockDefinitions[props.type])

const focusLabel = computed(() =>
  definition.value.focusCost === 0 ? '±0' : `−${definition.value.focusCost}`)

const energyLabel = computed(() => {
  const delta = definition.value.energyDelta

  if (delta === 0) {
    return '±0'
  }

  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
})

const kindLabel = computed(() => {
  switch (definition.value.kind) {
    case 'recovery':
      return 'Recovery'
    case 'social':
      return 'Social'
    case 'ceremony':
      return 'Ceremony'
    default:
      return definition.value.interactive ? 'Hands-on session' : 'Session'
  }
})
</script>

<template>
  <div
    data-builder-palette-tile
    :data-builder-palette-type="type"
    class="group flex items-center gap-2 rounded-xl border border-black/8 bg-white/88 p-2 transition hover:border-black/20 hover:shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] active:cursor-grabbing dark:border-white/[0.08] dark:bg-[#151515] dark:hover:border-white/[0.18]"
  >
    <AppPopover align="start">
      <template #trigger>
        <button
          type="button"
          :data-testid="`event-builder-block-info-${type}`"
          :aria-label="`About ${definition.label}`"
          class="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left"
        >
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-toned transition group-hover:scale-105 dark:bg-white/[0.06]">
            <AppIcon
              :name="eventBuilderBlockIcons[type]"
              class="size-4.5"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="line-clamp-2 text-sm font-medium leading-snug text-highlighted">{{ definition.label }}</span>
            <span
              v-if="type === 'custom'"
              class="block truncate text-xs text-dimmed"
            >
              you set focus and energy
            </span>
            <span
              v-else
              class="flex items-center gap-2 text-xs tabular-nums text-dimmed"
            >
              <span>{{ definition.defaultDurationMinutes }}m</span>
              <span class="inline-flex items-center gap-0.5 text-sky-500">
                <AppIcon
                  name="i-lucide-crosshair"
                  class="size-3.5"
                />{{ focusLabel }}
              </span>
              <span
                class="inline-flex items-center gap-0.5"
                :class="definition.energyDelta >= 0 ? 'text-emerald-500' : 'text-amber-500'"
              >
                <AppIcon
                  :name="definition.energyDelta >= 0 ? 'i-lucide-battery-charging' : 'i-lucide-battery-low'"
                  class="size-3.5"
                />{{ energyLabel }}
              </span>
            </span>
          </span>
        </button>
      </template>

      <div class="space-y-3">
        <div class="flex items-center gap-2.5">
          <span class="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-toned dark:bg-white/[0.06]">
            <AppIcon
              :name="eventBuilderBlockIcons[type]"
              class="size-4.5"
            />
          </span>
          <div>
            <p class="text-sm font-semibold text-highlighted">
              {{ definition.label }}
            </p>
            <p class="text-[11px] text-muted">
              {{ kindLabel }}
            </p>
          </div>
        </div>

        <p class="text-xs text-toned">
          {{ definition.tagline }}
        </p>

        <dl class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg bg-black/4 px-2 py-1.5 dark:bg-white/[0.05]">
            <dt class="text-[10px] uppercase tracking-[0.12em] text-dimmed">
              Default
            </dt>
            <dd class="text-xs font-medium tabular-nums text-highlighted">
              {{ definition.defaultDurationMinutes }}m
            </dd>
          </div>
          <div class="rounded-lg bg-black/4 px-2 py-1.5 dark:bg-white/[0.05]">
            <dt class="text-[10px] uppercase tracking-[0.12em] text-dimmed">
              Focus
            </dt>
            <dd class="text-xs font-medium tabular-nums text-sky-500">
              {{ focusLabel }}
            </dd>
          </div>
          <div class="rounded-lg bg-black/4 px-2 py-1.5 dark:bg-white/[0.05]">
            <dt class="text-[10px] uppercase tracking-[0.12em] text-dimmed">
              Energy
            </dt>
            <dd
              class="text-xs font-medium tabular-nums"
              :class="definition.energyDelta >= 0 ? 'text-emerald-500' : 'text-amber-500'"
            >
              {{ energyLabel }}
            </dd>
          </div>
        </dl>

        <PopoverClose as-child>
          <AppButton
            color="neutral"
            variant="soft"
            size="sm"
            label="Add to agenda"
            trailing-icon="i-lucide-plus"
            class="w-full justify-center"
            @click="emit('add', type)"
          />
        </PopoverClose>
      </div>
    </AppPopover>

    <AppButton
      color="neutral"
      variant="outline"
      size="xs"
      icon="i-lucide-plus"
      :data-testid="`event-builder-add-block-${type}`"
      :aria-label="`Add ${definition.label}, ${definition.defaultDurationMinutes} minutes`"
      title="Add to agenda"
      class="size-6 px-0"
      @click="emit('add', type)"
    />
  </div>
</template>
