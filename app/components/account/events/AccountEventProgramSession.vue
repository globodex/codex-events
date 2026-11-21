<script setup lang="ts">
import type { ProgramSession } from '#shared/domains/events/program'

const props = defineProps<{
  session: ProgramSession
  timeLabel: string
  roomName?: string
  selected: boolean
  canSave: boolean
  saved: boolean
  pending: boolean
}>()

defineEmits<{
  select: [session: ProgramSession]
  toggleFavorite: [sessionId: string]
}>()

const accessibleLabel = computed(() =>
  [props.session.title, props.timeLabel, props.roomName].filter(Boolean).join(', ')
)
const favoriteLabel = computed(() => props.saved
  ? `Remove ${props.session.title} from My agenda`
  : `Save ${props.session.title} to My agenda`)
</script>

<template>
  <div
    class="relative m-1 min-w-0 rounded-lg border"
    :class="selected ? 'border-primary bg-primary/10' : 'border-default/75 bg-default'"
  >
    <AppButton
      :id="`program-session-${encodeURIComponent(session.id)}`"
      color="neutral"
      variant="ghost"
      class="h-full min-h-full w-full flex-col items-start justify-start gap-1 whitespace-normal rounded-lg px-2.5 py-2 text-left hover:bg-primary/5 focus-visible:ring-inset"
      :class="canSave ? 'pr-9' : ''"
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
    <AppButton
      v-if="canSave"
      variant="ghost"
      :color="saved ? 'primary' : 'neutral'"
      :icon="saved ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark'"
      size="sm"
      class="absolute right-1 top-1 size-8 p-0"
      :aria-label="favoriteLabel"
      :aria-pressed="saved"
      :loading="pending"
      :data-testid="`program-favorite-${session.id}`"
      @click="$emit('toggleFavorite', session.id)"
    />
  </div>
</template>
