<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'

import { formatMinutes, type SessionPhase } from '~/domains/events/program-timeline'

const props = defineProps<{
  session: ProgramSession
  timeLabel: string
  roomName?: string
  selected: boolean
  phase: SessionPhase
  /** Shown above the title while the session is running or next, for example "Now · 12m left". */
  phaseLabel?: string
}>()

defineEmits<{
  select: [session: ProgramSession]
}>()

const accessibleLabel = computed(() =>
  [props.phaseLabel, props.session.title, props.timeLabel, props.roomName].filter(Boolean).join(', ')
)

const cardClass = computed(() => {
  if (props.selected) return 'border-primary bg-primary/5'
  if (props.phase === 'now') return 'border-success/50 bg-success/10'
  return 'border-default bg-default'
})
</script>

<template>
  <div
    class="m-1 flex min-w-0 flex-col rounded-xl border transition-colors"
    :class="[cardClass, { 'opacity-60': phase === 'past' && !selected }]"
  >
    <AppButton
      :id="`program-session-${encodeURIComponent(session.id)}`"
      color="neutral"
      variant="ghost"
      class="h-auto w-full min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-3 py-2.5 text-left hover:bg-primary/5 focus-visible:ring-inset"
      :aria-label="accessibleLabel"
      :aria-pressed="selected"
      :data-testid="`program-session-${session.id}`"
      @click="$emit('select', session)"
    >
      <span
        v-if="phaseLabel"
        class="flex items-center gap-1.5 text-xs font-semibold leading-tight"
        :class="phase === 'now' ? 'text-success' : 'text-info'"
      >
        <span
          v-if="phase === 'now'"
          class="relative flex size-2"
        >
          <span class="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
          <span class="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        {{ phaseLabel }}
      </span>
      <span class="break-words text-sm font-semibold leading-snug text-highlighted">{{ session.title }}</span>
      <span class="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-tight text-muted">
        <span class="tabular-nums">{{ formatMinutes(session.durationMinutes) }}</span>
        <span
          v-if="roomName"
          class="flex min-w-0 items-center gap-1 text-toned"
        >
          <AppIcon
            name="i-lucide-map-pin"
            class="size-3"
          />
          <span class="truncate">{{ roomName }}</span>
        </span>
      </span>
    </AppButton>
    <p
      v-if="selected && session.details"
      class="whitespace-pre-wrap break-words px-3 pb-3 text-sm text-toned"
    >
      {{ session.details }}
    </p>
  </div>
</template>
