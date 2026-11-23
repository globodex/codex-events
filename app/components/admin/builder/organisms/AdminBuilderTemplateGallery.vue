<script setup lang="ts">
import type { EventBuilderTemplate } from '#shared/domains/events/builder-templates'
import { eventBuilderBlockDefinitions } from '#shared/domains/events/builder-blocks'
import { eventBuilderBlockIcons, projectTemplateBalance } from '~/domains/events/builder'
import AdminBuilderSparkline from '~/components/admin/builder/molecules/AdminBuilderSparkline.vue'
import AdminBuilderTemplateCard from '~/components/admin/builder/molecules/AdminBuilderTemplateCard.vue'

const props = defineProps<{
  templates: readonly EventBuilderTemplate[]
}>()

const emit = defineEmits<{
  apply: [template: EventBuilderTemplate]
}>()

const projections = computed(() => new Map(
  props.templates.map(template => [template.id, projectTemplateBalance(template)])
))

// Preview selection is browse-only state: it never touches the agenda.
const selectedId = ref<string | null>(null)

const selectedTemplate = computed(() =>
  props.templates.find(template => template.id === selectedId.value) ?? null
)

const selectedProjection = computed(() =>
  selectedId.value ? projections.value.get(selectedId.value) ?? null : null
)

// Switching event type swaps the template set; drop a stale selection.
watch(() => props.templates, (templates) => {
  if (selectedId.value && !templates.some(template => template.id === selectedId.value)) {
    selectedId.value = null
  }
})

function onSelect(template: EventBuilderTemplate) {
  selectedId.value = selectedId.value === template.id ? null : template.id
}

function onApply() {
  if (selectedTemplate.value) {
    emit('apply', selectedTemplate.value)
    selectedId.value = null
  }
}

const applicationFieldLabels: Record<string, string> = {
  xProfile: 'X profile',
  linkedinProfile: 'LinkedIn profile',
  githubProfile: 'GitHub profile',
  chatgptEmail: 'ChatGPT email',
  openaiOrgId: 'OpenAI org ID',
  lumaEmail: 'Luma email',
  whyThisEvent: 'Why this event',
  proofOfExecution: 'Proof of execution',
  teamIntent: 'Team intent',
  aiKnowledge: 'AI knowledge'
}

const applicationPresetLabel = computed(() => {
  const fields = selectedTemplate.value?.applicationFields

  if (!fields) {
    return ''
  }

  const required = fields.required.map(key => applicationFieldLabels[key] ?? key)
  const optional = fields.visible
    .filter(key => !fields.required.includes(key))
    .map(key => applicationFieldLabels[key] ?? key)
  const parts: string[] = []

  if (required.length > 0) {
    parts.push(`required: ${required.join(', ')}`)
  }

  if (optional.length > 0) {
    parts.push(`optional: ${optional.join(', ')}`)
  }

  return parts.length > 0 ? parts.join(' · ') : 'name only'
})

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) {
    return `${rest}m`
  }

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

// Column-major halves: 1..ceil(n/2) run down the first column, the rest down the second.
const previewColumns = computed(() => {
  const blocks = selectedTemplate.value?.blocks ?? []
  const splitAt = Math.ceil(blocks.length / 2)

  return [
    { startIndex: 0, blocks: blocks.slice(0, splitAt) },
    { startIndex: splitAt, blocks: blocks.slice(splitAt) }
  ].filter(column => column.blocks.length > 0)
})
</script>

<template>
  <section
    data-testid="event-builder-templates"
    class="space-y-2"
  >
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <AdminBuilderTemplateCard
        v-for="template in templates"
        :key="template.id"
        :template="template"
        :projection="projections.get(template.id)!"
        :selected="template.id === selectedId"
        @select="onSelect"
      />
    </div>

    <div
      v-if="selectedTemplate && selectedProjection"
      data-testid="event-builder-template-preview"
      class="space-y-3 rounded-xl border border-black/10 bg-white/92 p-4 dark:border-white/[0.12] dark:bg-[#161616]"
    >
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-sm font-semibold text-highlighted">
          {{ selectedTemplate.name }}
        </p>
        <AppBadge
          :color="selectedProjection.score >= 80 ? 'success' : selectedProjection.score >= 60 ? 'info' : 'warning'"
          variant="soft"
          size="sm"
          class="tabular-nums"
        >
          Agenda score {{ selectedProjection.score }} · {{ selectedProjection.band.label }}
        </AppBadge>
        <AppButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          aria-label="Close template preview"
          class="ml-auto w-7 px-0 rounded-lg"
          @click="selectedId = null"
        />
      </div>

      <div class="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <ol
          v-for="column in previewColumns"
          :key="`${selectedTemplate.id}-column-${column.startIndex}`"
          class="space-y-1.5"
        >
          <li
            v-for="(block, index) in column.blocks"
            :key="`${selectedTemplate.id}-preview-${column.startIndex + index}`"
            class="flex items-center gap-2 text-sm"
          >
            <span class="w-5 shrink-0 text-right text-[11px] tabular-nums text-dimmed">{{ column.startIndex + index + 1 }}.</span>
            <AppIcon
              :name="eventBuilderBlockIcons[block.builderBlockType]"
              class="size-3.5 shrink-0 text-toned"
            />
            <span class="min-w-0 flex-1 truncate text-toned">{{ block.title }}</span>
            <span class="shrink-0 text-[11px] tabular-nums text-dimmed">
              <template v-if="eventBuilderBlockDefinitions[block.builderBlockType].label !== block.title">
                {{ eventBuilderBlockDefinitions[block.builderBlockType].label }} ·
              </template>
              {{ formatDuration(block.durationMinutes) }}
            </span>
          </li>
        </ol>
      </div>

      <p class="text-xs text-dimmed">
        <span class="font-medium text-toned">Application form:</span>
        {{ applicationPresetLabel }}
      </p>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1">
          <AdminBuilderSparkline
            variant="bars"
            tone="energy"
            :values="selectedProjection.energyByItem"
            :labels="selectedTemplate.blocks.map(block => block.title)"
            :label="`Projected energy across ${selectedTemplate.blocks.length} blocks`"
            height-class="h-9"
          />
          <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">
            Audience energy per block
          </p>
        </div>
        <div class="space-y-1">
          <AdminBuilderSparkline
            variant="bars"
            tone="focus"
            :values="selectedProjection.focusByItem.map(value =>
              selectedProjection!.focusBudget > 0
                ? Math.max(0, 100 - (value / selectedProjection!.focusBudget) * 100)
                : 100)"
            :labels="selectedTemplate.blocks.map(block => block.title)"
            :label="`Focus remaining across ${selectedTemplate.blocks.length} blocks`"
            height-class="h-9"
          />
          <p class="text-[10px] uppercase tracking-[0.14em] text-dimmed">
            Focus left in the budget
          </p>
        </div>
      </div>

      <AppButton
        color="neutral"
        variant="solid"
        size="sm"
        :data-testid="`event-builder-use-template-${selectedTemplate.id}`"
        @click="onApply"
      >
        Use this template
        <template #trailing>
          <AppIcon
            name="i-lucide-sparkles"
            class="size-3.5"
          />
        </template>
      </AppButton>
    </div>
  </section>
</template>
