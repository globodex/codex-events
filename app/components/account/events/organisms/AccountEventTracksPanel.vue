<script setup lang="ts">
// The tracks of a Hackathon. Only Hackathons have tracks; a Build event offers open tracks in its
// challenge list instead (`AccountEventChallengeChoice`).
import type { AccountEventEntryTrack } from '#shared/domains/events/account-event-entry-page'

import EventStaffInstructions from '~/components/events/molecules/EventStaffInstructions.vue'
import EventTrackDetails from '~/components/events/molecules/EventTrackDetails.vue'

type ViewerMode = 'participant' | 'all-staff' | 'track-staff'

const props = defineProps<{
  tracks: AccountEventEntryTrack[]
  selectedTrackId?: string | null
  canSelectTrack?: boolean
  pendingTrackId?: string | null
  viewerMode?: ViewerMode
  staffTrackId?: string | null
}>()

const emit = defineEmits<{
  selectTrack: [trackId: string]
}>()

const viewerMode = computed(() => props.viewerMode ?? 'participant')
const sortedTracks = computed(() =>
  [...props.tracks].sort((left, right) =>
    left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )
)
const selectedTrack = computed(() =>
  props.selectedTrackId
    ? sortedTracks.value.find(track => track.id === props.selectedTrackId) ?? null
    : null
)
const orderedParticipantTracks = computed(() => {
  if (!selectedTrack.value) {
    return sortedTracks.value
  }

  return [
    selectedTrack.value,
    ...sortedTracks.value.filter(track => track.id !== selectedTrack.value?.id)
  ]
})
const visibleTracks = computed(() => {
  if (viewerMode.value === 'track-staff' && !props.canSelectTrack) {
    return props.staffTrackId
      ? sortedTracks.value.filter(track => track.id === props.staffTrackId || isSelected(track))
      : []
  }

  return viewerMode.value === 'participant'
    ? orderedParticipantTracks.value
    : sortedTracks.value
})
const isStaffView = computed(() => viewerMode.value !== 'participant')
const panelDescription = computed(() => {
  if (viewerMode.value === 'all-staff') {
    return 'Review track guidelines and internal notes for the event team.'
  }

  if (viewerMode.value === 'track-staff') {
    return 'Review the guidelines and internal notes for the track you support.'
  }

  if (selectedTrack.value) {
    return 'Your selected track appears first with its guidelines and resources.'
  }

  return 'Choose the track you want to participate in.'
})

function isSelected(track: AccountEventEntryTrack) {
  return props.selectedTrackId === track.id
}

function shouldShowFullDetails(track: AccountEventEntryTrack) {
  return track.fullDescription !== undefined
}
</script>

<template>
  <section
    v-if="visibleTracks.length > 0"
    class="!border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60 relative overflow-hidden rounded-[1.75rem] p-5 sm:p-7"
    data-testid="account-event-tracks"
  >
    <div
      class="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/55 to-transparent"
      aria-hidden="true"
    />

    <div class="relative mb-6 flex items-center gap-3 border-b border-black/8 pb-5 dark:border-white/[0.08]">
      <span class="flex size-8 items-center justify-center rounded-full border border-black/8 bg-white/80 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-sky-300">
        <AppIcon
          name="i-lucide-layout-grid"
          class="size-4"
        />
      </span>
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-[-0.03em] text-highlighted dark:text-white">
          Tracks
        </h2>
        <p class="mt-1 text-[14px] text-neutral-500 dark:text-[#A3A3A3]">
          {{ panelDescription }}
        </p>
      </div>
    </div>

    <div class="grid gap-4">
      <article
        v-for="track in visibleTracks"
        :key="track.id"
        class="rounded-2xl border p-5 transition"
        :class="shouldShowFullDetails(track)
          ? 'border-sky-500/35 bg-sky-500/[0.07] shadow-[0_14px_38px_-30px_rgba(2,132,199,0.55)] dark:border-sky-300/30 dark:bg-sky-300/[0.08]'
          : 'border-black/8 bg-white/68 dark:border-white/[0.08] dark:bg-white/[0.03]'"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0 space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-[16px] font-semibold text-highlighted dark:text-white">
                {{ track.name }}
              </h3>
              <AppBadge
                v-if="isSelected(track)"
                color="primary"
                variant="soft"
              >
                Selected
              </AppBadge>
              <AppBadge
                v-else-if="viewerMode === 'track-staff' && track.id === staffTrackId"
                color="info"
                variant="soft"
              >
                Your track
              </AppBadge>
            </div>

            <AppMarkdownRenderer
              :source="track.shortDescription"
              class="max-w-[66ch]"
            />
          </div>

          <AppButton
            v-if="canSelectTrack"
            type="button"
            color="neutral"
            :variant="isSelected(track) ? 'soft' : 'solid'"
            :loading="pendingTrackId === track.id"
            :disabled="pendingTrackId === track.id || isSelected(track)"
            class="shrink-0"
            @click="emit('selectTrack', track.id)"
          >
            {{ isSelected(track) ? 'Selected' : 'Choose track' }}
          </AppButton>
        </div>

        <EventTrackDetails
          v-if="shouldShowFullDetails(track)"
          :description="track.fullDescription"
          :resources="track.resources"
        >
          <EventStaffInstructions
            v-if="isStaffView && track.staffInstructions?.trim()"
            :source="track.staffInstructions"
          />
        </EventTrackDetails>
      </article>
    </div>
  </section>
</template>
