<script setup lang="ts">
// One challenge in the builder's challenge list: its title, instructions and resources, and
// whether participants can read it.
import type { EventChallenge } from '#shared/domains/events/challenges'
import { eventChallengeLimits } from '#shared/domains/events/challenges'
import AdminMarkdownEditorField from '~/components/admin/AdminMarkdownEditorField.vue'
import AdminBuilderTrackRow from '~/components/admin/builder/molecules/AdminBuilderTrackRow.vue'
import { eventBuilderChallengeTitleIdPrefix } from '~/domains/events/builder'

type ChallengeResource = EventChallenge['resources'][number]

const props = defineProps<{
  challenge: EventChallenge
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
const instructionsFieldId = computed(() => `event-builder-challenge-instructions-${props.challenge.id}`)
const staffInstructionsFieldId = computed(() => `event-builder-challenge-staff-instructions-${props.challenge.id}`)

function updateResource(resourceIndex: number, patch: Partial<ChallengeResource>) {
  emit('update', {
    resources: props.challenge.resources.map((resource, index) => index === resourceIndex
      ? { ...resource, ...patch }
      : resource)
  })
}

function addResource() {
  emit('update', { resources: [...props.challenge.resources, { label: '', url: '' }] })
}

function removeResource(resourceIndex: number) {
  emit('update', {
    resources: props.challenge.resources.filter((_, index) => index !== resourceIndex)
  })
}
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

      <AdminMarkdownEditorField
        :model-value="props.challenge.instructions"
        :name="instructionsFieldId"
        label="Instructions"
        :editor-id="instructionsFieldId"
        :data-testid="`event-builder-challenge-instructions-${props.index}`"
        height="220px"
        @update:model-value="emit('update', { instructions: $event })"
      />

      <div class="space-y-2">
        <p class="text-xs font-medium text-toned">
          Resources
        </p>
        <div
          v-for="(resource, resourceIndex) in props.challenge.resources"
          :key="resourceIndex"
          class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
        >
          <AppInput
            :model-value="resource.label"
            :aria-label="`Name of resource ${resourceIndex + 1}`"
            :maxlength="eventChallengeLimits.maxResourceLabelLength"
            size="sm"
            placeholder="Name"
            @update:model-value="updateResource(resourceIndex, { label: String($event ?? '') })"
          />
          <AppInput
            :model-value="resource.url"
            :aria-label="`Link of resource ${resourceIndex + 1}`"
            size="sm"
            placeholder="https://…"
            @update:model-value="updateResource(resourceIndex, { url: String($event ?? '') })"
          />
          <AppButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            :aria-label="`Remove resource ${resourceIndex + 1}`"
            class="w-8 px-0 text-muted hover:text-error"
            @click="removeResource(resourceIndex)"
          />
        </div>
        <AppButton
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="props.challenge.resources.length >= eventChallengeLimits.maxResources"
          @click="addResource"
        >
          Add resource
        </AppButton>
      </div>

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
