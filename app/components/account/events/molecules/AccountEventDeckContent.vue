<script setup lang="ts">
import { deckResourceHref, type Deck, type DeckResourceKind } from '#shared/domains/events/decks'

// The slides of a deck one after another, then its materials and links. Each item opens in a new tab:
// a link, or an uploaded PDF in the browser's own viewer.
const props = defineProps<{
  deck: Deck
  /** The API of the deck (`deckApiPath`), where its PDFs open. */
  apiPath: string
}>()

const groups: Array<{ kind: DeckResourceKind, title: string }> = [
  { kind: 'material', title: 'Materials' },
  { kind: 'link', title: 'Links' }
]
const resourceGroups = computed(() => groups
  .map(group => ({ ...group, resources: props.deck.resources.filter(resource => resource.kind === group.kind) }))
  .filter(group => group.resources.length > 0))
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="deck.slides.length"
      class="divide-y divide-black/8 dark:divide-white/[0.08]"
    >
      <AppMarkdownRenderer
        v-for="slide in deck.slides"
        :key="slide.id"
        :source="slide.markdown"
        class="py-5 first:pt-0 last:pb-0"
        data-testid="deck-slide"
      />
    </div>
    <section
      v-for="group in resourceGroups"
      :key="group.kind"
      class="space-y-2"
      :data-testid="`deck-${group.kind}`"
    >
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">
        {{ group.title }}
      </h3>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="resource in group.resources"
          :key="resource.id"
          class="max-w-full"
        >
          <AppButton
            :to="deckResourceHref(apiPath, resource)"
            target="_blank"
            rel="noopener"
            external
            color="neutral"
            variant="outline"
            :icon="resource.file ? 'i-lucide-file-text' : 'i-lucide-external-link'"
            :label="resource.title"
            class="max-w-full"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
