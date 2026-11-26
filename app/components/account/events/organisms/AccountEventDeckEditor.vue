<script setup lang="ts">
import {
  deckContentSchema,
  deckPdfMaxBytes,
  deckResourceKinds,
  type DeckResource,
  type DeckResourceKind,
  type DeckSlide
} from '#shared/domains/events/decks'
import type { AgendaDeck } from '#shared/domains/events/program'
import { useApiClient } from '~/composables/useApiClient'
import { normalizeApiError, type ApiDataResponse } from '~/lib/api'

// The Markdown editor is heavy, so it loads with this form only.
const AdminMarkdownEditorField = defineAsyncComponent(() => import('~/components/admin/AdminMarkdownEditorField.vue'))

// Edits a deck: its slides, and its materials and links. A material or link is a link or an
// uploaded PDF. The staff of a workshop or challenge and the event admins use it on its page.
const props = defineProps<{
  /** The API of the deck (`deckApiPath`). */
  apiPath: string
  deck: AgendaDeck
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const kindLabels: Record<DeckResourceKind, string> = { material: 'Material', link: 'Link' }
const apiFetch = useApiClient()
const toast = useToast()
const formId = useId()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const slides = ref<DeckSlide[]>(props.deck.slides.map(slide => ({ ...slide })))
const resources = ref<DeckResource[]>(props.deck.resources.map(resource => ({ ...resource })))
// The slide in the Markdown editor, by its position.
const slideIndex = shallowRef(0)
const currentSlide = computed(() => slides.value[slideIndex.value])
const saving = shallowRef(false)
const uploading = shallowRef(false)
const error = shallowRef('')

// A new slide comes after the open slide, and opens.
function addSlide() {
  const position = slides.value.length ? slideIndex.value + 1 : 0
  slides.value.splice(position, 0, { id: crypto.randomUUID(), markdown: '' })
  slideIndex.value = position
}

// Moves the open slide one place earlier (-1) or later (1).
function moveSlide(direction: -1 | 1) {
  const [slide] = slides.value.splice(slideIndex.value, 1)
  slides.value.splice(slideIndex.value + direction, 0, slide!)
  slideIndex.value += direction
}

function removeSlide() {
  slides.value.splice(slideIndex.value, 1)
  slideIndex.value = Math.max(0, Math.min(slideIndex.value, slides.value.length - 1))
}

function addLink() {
  resources.value.push({ id: crypto.randomUUID(), kind: 'link', title: '', url: '' })
}

function removeResource(id: string) {
  resources.value = resources.value.filter(resource => resource.id !== id)
}

// An uploaded PDF becomes a material named after the file. It is saved with the page.
async function uploadPdf(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (file.size > deckPdfMaxBytes) {
    error.value = 'Choose a PDF that is 20 MB or smaller.'
    return
  }

  uploading.value = true
  error.value = ''
  try {
    const body = new FormData()
    body.set('file', file)
    const { data } = await apiFetch<ApiDataResponse<{ id: string, name: string }>>(`${props.apiPath}/files`, { method: 'POST', body })
    resources.value.push({ id: crypto.randomUUID(), kind: 'material', title: data.name.replace(/\.pdf$/i, ''), file: data })
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    uploading.value = false
  }
}

async function save() {
  // An item with a PDF has no link, so its empty link field is left out.
  const content = deckContentSchema.safeParse({
    slides: slides.value,
    resources: resources.value.map(resource => ({ ...resource, url: resource.file ? undefined : resource.url }))
  })
  if (!content.success) {
    error.value = content.error.issues[0]!.message
    return
  }

  saving.value = true
  error.value = ''
  try {
    await apiFetch(props.apiPath, { method: 'PUT', body: content.data })
    toast.add({ title: 'Page saved', color: 'success' })
    emit('saved')
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form
    class="space-y-6"
    data-testid="deck-editor"
    @submit.prevent="save"
  >
    <fieldset class="min-w-0 space-y-3">
      <legend class="text-sm font-medium text-highlighted">
        Slides
      </legend>
      <div class="flex flex-wrap items-center gap-1">
        <AppButton
          v-for="(slide, index) in slides"
          :key="slide.id"
          :color="index === slideIndex ? 'primary' : 'neutral'"
          :variant="index === slideIndex ? 'solid' : 'outline'"
          size="sm"
          :label="String(index + 1)"
          :aria-label="`Slide ${index + 1}`"
          :aria-pressed="index === slideIndex"
          @click="slideIndex = index"
        />
        <AppButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-plus"
          label="Add slide"
          @click="addSlide"
        />
      </div>
      <template v-if="currentSlide">
        <AdminMarkdownEditorField
          :key="currentSlide.id"
          v-model="currentSlide.markdown"
          :name="`${formId}-slide`"
          :label="`Slide ${slideIndex + 1}`"
          :editor-id="`${formId}-slide-${currentSlide.id}`"
          height="320px"
          data-testid="deck-slide-editor"
        />
        <div class="flex flex-wrap gap-2">
          <AppButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-arrow-left"
            label="Move earlier"
            :disabled="slideIndex === 0"
            @click="moveSlide(-1)"
          />
          <AppButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-arrow-right"
            label="Move later"
            :disabled="slideIndex === slides.length - 1"
            @click="moveSlide(1)"
          />
          <AppButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            label="Remove slide"
            @click="removeSlide"
          />
        </div>
      </template>
    </fieldset>

    <fieldset class="min-w-0 space-y-3">
      <legend class="text-sm font-medium text-highlighted">
        Materials and links
      </legend>
      <div
        v-for="(resource, index) in resources"
        :key="resource.id"
        class="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end"
      >
        <AppFormField
          :name="`${formId}-kind-${index}`"
          label="Type"
        >
          <AppSelect
            :id="`${formId}-kind-${index}`"
            :model-value="resource.kind"
            size="sm"
            @update:model-value="value => resource.kind = value as DeckResourceKind"
          >
            <option
              v-for="kind in deckResourceKinds"
              :key="kind"
              :value="kind"
            >
              {{ kindLabels[kind] }}
            </option>
          </AppSelect>
        </AppFormField>
        <AppFormField
          :name="`${formId}-title-${index}`"
          label="Title"
        >
          <AppInput
            :id="`${formId}-title-${index}`"
            v-model="resource.title"
            size="sm"
            :maxlength="120"
          />
        </AppFormField>
        <AppFormField
          v-if="!resource.file"
          :name="`${formId}-url-${index}`"
          label="Link"
        >
          <AppInput
            :id="`${formId}-url-${index}`"
            v-model="resource.url"
            type="url"
            size="sm"
            placeholder="https://"
          />
        </AppFormField>
        <p
          v-else
          class="flex min-h-8 min-w-0 items-center gap-2 text-sm text-toned"
        >
          <AppIcon
            name="i-lucide-file-text"
            class="size-4 shrink-0"
          />
          <span class="truncate">{{ resource.file.name }}</span>
        </p>
        <AppButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-lucide-trash-2"
          :aria-label="`Remove ${resource.title || 'this item'}`"
          @click="removeResource(resource.id)"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          label="Add link"
          @click="addLink"
        />
        <AppButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-upload"
          label="Upload PDF"
          :loading="uploading"
          :disabled="uploading"
          @click="fileInput?.click()"
        />
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf,.pdf"
          class="hidden"
          data-testid="deck-file"
          @change="uploadPdf"
        >
      </div>
    </fieldset>

    <AppAlert
      v-if="error"
      color="error"
      :description="error"
    />
    <div class="flex flex-wrap gap-2">
      <AppButton
        type="submit"
        label="Save page"
        :loading="saving"
        :disabled="saving || uploading"
      />
      <AppButton
        color="neutral"
        variant="ghost"
        label="Cancel"
        :disabled="saving"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
