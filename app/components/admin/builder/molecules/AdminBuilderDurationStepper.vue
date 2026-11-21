<script setup lang="ts">
import {
  eventBuilderMaxBlockDurationMinutes,
  eventBuilderMinBlockDurationMinutes,
  getNextEventBuilderDurationMinutes,
  parseEventBuilderDurationMinutes
} from '~/domains/events/builder'

const props = defineProps<{
  blockId: string
}>()

const model = defineModel<number>({ required: true })

const decreaseValue = computed(() => getNextEventBuilderDurationMinutes(model.value, -1))
const increaseValue = computed(() => getNextEventBuilderDurationMinutes(model.value, 1))

function step(direction: -1 | 1) {
  model.value = direction === -1 ? decreaseValue.value : increaseValue.value
}

function setManualDuration(raw: string) {
  const parsed = parseEventBuilderDurationMinutes(raw)

  if (parsed === null) {
    return
  }

  model.value = parsed
}

function restoreManualDuration(event: FocusEvent) {
  if (event.currentTarget instanceof HTMLInputElement) {
    event.currentTarget.value = String(model.value)
  }
}

const formatted = computed(() => {
  const hours = Math.floor(model.value / 60)
  const minutes = model.value % 60

  if (hours === 0) {
    return `${minutes}m`
  }

  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
})
</script>

<template>
  <div
    class="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/8 bg-white p-1 transition focus-within:border-black/25 dark:border-white/[0.08] dark:bg-[#151515] dark:focus-within:border-white/[0.25]"
    role="group"
    aria-label="Block duration"
  >
    <AppButton
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-minus"
      :aria-label="`Shorten by ${model - decreaseValue} ${model - decreaseValue === 1 ? 'minute' : 'minutes'}`"
      :data-testid="`event-builder-duration-down-${props.blockId}`"
      :disabled="model <= eventBuilderMinBlockDurationMinutes"
      class="w-7 px-0"
      @click="step(-1)"
    />
    <label class="inline-flex min-w-11 items-center justify-center text-xs font-medium tabular-nums text-highlighted">
      <span class="sr-only">Duration in minutes</span>
      <input
        type="number"
        inputmode="numeric"
        :min="eventBuilderMinBlockDurationMinutes"
        :max="eventBuilderMaxBlockDurationMinutes"
        step="1"
        :value="model"
        :aria-label="`Duration for block in minutes, currently ${formatted}`"
        :data-testid="`event-builder-duration-input-${props.blockId}`"
        class="w-8 bg-transparent text-right text-xs font-medium tabular-nums text-highlighted outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        @input="event => setManualDuration((event.target as HTMLInputElement).value)"
        @blur="restoreManualDuration"
      >
      <span aria-hidden="true">m</span>
    </label>
    <AppButton
      color="neutral"
      variant="ghost"
      size="xs"
      icon="i-lucide-plus"
      :aria-label="`Extend by ${increaseValue - model} ${increaseValue - model === 1 ? 'minute' : 'minutes'}`"
      :data-testid="`event-builder-duration-up-${props.blockId}`"
      :disabled="model >= eventBuilderMaxBlockDurationMinutes"
      class="w-7 px-0"
      @click="step(1)"
    />
  </div>
</template>
