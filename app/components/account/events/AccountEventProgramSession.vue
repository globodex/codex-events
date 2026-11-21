<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'

const props = defineProps<{
  session: ProgramSession
  timeLabel: string
  roomName?: string
  selected: boolean
}>()

defineEmits<{
  select: [session: ProgramSession]
}>()

const accessibleLabel = computed(() =>
  [props.session.title, props.timeLabel, props.roomName].filter(Boolean).join(', ')
)
</script>

<template>
  <AppButton
    :id="`program-session-${encodeURIComponent(session.id)}`"
    color="neutral"
    variant="ghost"
    class="m-1 h-auto min-w-0 flex-col items-start justify-start gap-0.5 whitespace-normal rounded-lg border px-2.5 py-1.5 text-left hover:bg-primary/5 focus-visible:ring-inset"
    :class="selected ? 'border-primary bg-primary/10' : 'border-default/75 bg-default'"
    :aria-label="accessibleLabel"
    :aria-pressed="selected"
    :data-testid="`program-session-${session.id}`"
    @click="$emit('select', session)"
  >
    <span class="text-[11px] tabular-nums leading-tight text-muted">{{ timeLabel }}</span>
    <span class="line-clamp-2 break-words text-sm font-semibold leading-tight text-highlighted">{{ session.title }}</span>
    <span
      v-if="roomName"
      class="flex max-w-full items-center gap-1 text-xs leading-tight text-toned"
    >
      <AppIcon
        name="i-lucide-map-pin"
        class="size-3 shrink-0"
      />
      <span class="truncate">{{ roomName }}</span>
    </span>
  </AppButton>
</template>
