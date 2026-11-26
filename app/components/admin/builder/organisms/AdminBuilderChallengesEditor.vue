<script setup lang="ts">
// The challenge list of the builder's "Challenges" group: add, edit, remove and reorder.
import type { EventChallenge } from '#shared/domains/events/challenges'
import { eventChallengeLimits } from '#shared/domains/events/challenges'
import AdminBuilderChallengeCard from '~/components/admin/builder/molecules/AdminBuilderChallengeCard.vue'
import { moveListItemByIndex } from '~/utils/reorder-list'

const challenges = defineModel<EventChallenge[]>({ required: true })

defineProps<{
  /** The address of the event, for the links to the challenge pages. */
  eventSlug: string
}>()

const listElement = useTemplateRef<HTMLElement>('list')
// The id of the challenge the organizer is dragging. Its card is highlighted.
const activeDragId = shallowRef<string | null>(null)

useAdminSortableLists({
  elements: () => [listElement.value],
  enabled: () => challenges.value.length > 1,
  sources: [() => challenges.value.length],
  createOptions: () => ({
    animation: 180,
    handle: '[data-builder-challenge-sort-handle]',
    draggable: '[data-builder-challenge-row]',
    dataIdAttr: 'data-builder-challenge-id',
    ghostClass: 'opacity-45',
    chosenClass: 'cursor-grabbing',
    dragClass: 'cursor-grabbing',
    onChoose(event) {
      activeDragId.value = event.item.dataset.builderChallengeId ?? null
    },
    onEnd(event) {
      const oldIndex = event.oldDraggableIndex ?? event.oldIndex
      const newIndex = event.newDraggableIndex ?? event.newIndex

      if (oldIndex !== undefined && newIndex !== undefined) {
        moveChallenge(oldIndex, newIndex)
      }

      activeDragId.value = null
    }
  }),
  onDestroy: () => {
    activeDragId.value = null
  }
})

function addChallenge() {
  challenges.value = [
    ...challenges.value,
    // A new challenge is a draft until the organizer publishes it.
    { id: crypto.randomUUID(), title: '', isPublished: false }
  ]
}

function updateChallenge(index: number, patch: Partial<EventChallenge>) {
  challenges.value = challenges.value.map((challenge, currentIndex) => currentIndex === index
    ? { ...challenge, ...patch }
    : challenge)
}

function removeChallenge(index: number) {
  challenges.value = challenges.value.filter((_, currentIndex) => currentIndex !== index)
}

function moveChallenge(oldIndex: number, newIndex: number) {
  challenges.value = moveListItemByIndex(challenges.value, oldIndex, newIndex)
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="challenges.length > 0"
      ref="list"
      class="space-y-2.5"
    >
      <AdminBuilderChallengeCard
        v-for="(challenge, index) in challenges"
        :key="challenge.id"
        :challenge="challenge"
        :event-slug="eventSlug"
        :index="index"
        :active="activeDragId === challenge.id"
        @update="patch => updateChallenge(index, patch)"
        @move="offset => moveChallenge(index, index + offset)"
        @remove="removeChallenge(index)"
      />
    </div>

    <AppButton
      color="neutral"
      variant="outline"
      size="sm"
      label="Add challenge"
      trailing-icon="i-lucide-plus"
      :disabled="challenges.length >= eventChallengeLimits.maxChallenges"
      @click="addChallenge"
    />
  </div>
</template>
