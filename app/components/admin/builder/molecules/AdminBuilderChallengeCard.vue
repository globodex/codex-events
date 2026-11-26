<script setup lang="ts">
// One challenge in the builder's challenge list: its title, its staff instructions, and whether
// participants can read it. Its slides, materials and links are on its page on the Agenda tab, where
// its staff and the event admins edit them.
import type { EventChallenge } from '#shared/domains/events/challenges'
import { eventChallengeLimits } from '#shared/domains/events/challenges'
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import AdminBuilderTrackRow from '~/components/admin/builder/molecules/AdminBuilderTrackRow.vue'
import { eventBuilderChallengeTitleIdPrefix } from '~/domains/events/builder'

const props = defineProps<{
  challenge: EventChallenge
  /** The address of the event, for the link to the challenge page. */
  eventSlug: string
  index: number
  /** True while the organizer drags this challenge to another position. */
  active?: boolean
}>()

const emit = defineEmits<{
  update: [patch: Partial<EventChallenge>]
  move: [direction: -1 | 1]
  remove: []
}>()

// The builder checklist focuses this field when the challenge is unfinished.
const titleFieldId = computed(() => `${eventBuilderChallengeTitleIdPrefix}${props.challenge.id}`)
const staffInstructionsFieldId = computed(() => `event-builder-challenge-staff-instructions-${props.challenge.id}`)
// The challenge page on the Agenda tab. It opens in a new tab, so the builder keeps unsaved changes.
const challengePageHref = computed(() =>
  `/account/events/${encodeURIComponent(props.eventSlug)}?tab=program&challenge=${encodeURIComponent(props.challenge.id)}`)
</script>

<template>
  <AdminBuilderTrackRow
    :item-id="props.challenge.id"
    :index="props.index"
    :title="props.challenge.title || `Challenge ${props.index + 1}`"
    :active="props.active"
    test-id-prefix="event-builder-challenge"
    item-id-attribute="data-builder-challenge-id"
    row-attribute="data-builder-challenge-row"
    sort-handle-attribute="data-builder-challenge-sort-handle"
    @move="emit('move', $event)"
  >
    <div class="space-y-3 p-1.5">
      <div class="flex items-center gap-3">
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Challenge {{ props.index + 1 }}
        </p>
        <AppBadge
          :color="props.challenge.isPublished ? 'success' : 'neutral'"
          variant="soft"
          size="sm"
        >
          {{ props.challenge.isPublished ? 'Published' : 'Draft' }}
        </AppBadge>
        <AppButton
          color="error"
          variant="ghost"
          size="xs"
          icon="i-lucide-trash-2"
          :aria-label="`Remove challenge ${props.index + 1}`"
          class="ml-auto w-7 rounded-lg px-0 text-muted hover:text-error"
          @click="emit('remove')"
        />
      </div>

      <AppFormField
        :name="titleFieldId"
        label="Title"
      >
        <AppInput
          :id="titleFieldId"
          :model-value="props.challenge.title"
          :maxlength="eventChallengeLimits.maxTitleLength"
          size="sm"
          @update:model-value="emit('update', { title: String($event ?? '') })"
        />
      </AppFormField>

      <!-- A published challenge has its page on the Agenda tab once the event is saved. -->
      <AppButton
        v-if="props.challenge.isPublished"
        :to="challengePageHref"
        target="_blank"
        external
        size="xs"
        color="neutral"
        variant="ghost"
        trailing-icon="i-lucide-external-link"
        label="Edit slides and links"
      />

      <!-- Only the event team reads these: staff, event admins and platform admins. -->
      <AdminMarkdownEditorField
        :model-value="props.challenge.staffInstructions ?? ''"
        :name="staffInstructionsFieldId"
        label="Staff instructions"
        :editor-id="staffInstructionsFieldId"
        :data-testid="`event-builder-challenge-staff-instructions-${props.index}`"
        height="140px"
        @update:model-value="emit('update', { staffInstructions: $event })"
      />

      <AppCheckbox
        :model-value="props.challenge.isPublished"
        label="Published"
        @update:model-value="emit('update', { isPublished: $event })"
      />
      <!-- The Agenda tab lists an open track in its own group "Open track", below the challenges. -->
      <AppCheckbox
        :model-value="props.challenge.isOpenTrack ?? false"
        label="List as open track, below the challenges"
        @update:model-value="emit('update', { isOpenTrack: $event })"
      />
    </div>
  </AdminBuilderTrackRow>
</template>
