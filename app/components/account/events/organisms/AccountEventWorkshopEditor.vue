<script setup lang="ts">
import type { AgendaWorkshop } from '#shared/domains/events/program'
import {
  workshopContentSchema,
  workshopPdfMaxBytes,
  workshopResourceKinds,
  type WorkshopResource,
  type WorkshopResourceKind
} from '#shared/domains/events/workshops'
import { useApiClient } from '~/composables/useApiClient'
import { normalizeApiError, type ApiDataResponse } from '~/lib/api'

// The Markdown editor is heavy, so it loads with this form only.
const AdminMarkdownEditorField = defineAsyncComponent(() => import('~/components/admin/AdminMarkdownEditorField.vue'))

// Edits the description and the slides, materials and links of a workshop. Each item is a link or
// an uploaded PDF. The staff of the workshop and the event admins use it on the workshop page.
const props = defineProps<{
  eventId: string
  sessionId: string
  workshop: AgendaWorkshop
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const kindLabels: Record<WorkshopResourceKind, string> = { slides: 'Slides', material: 'Material', link: 'Link' }
const apiFetch = useApiClient()
const toast = useToast()
const formId = useId()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const description = shallowRef(props.workshop.description)
const resources = ref<WorkshopResource[]>(props.workshop.resources.map(resource => ({ ...resource })))
const saving = shallowRef(false)
const uploading = shallowRef(false)
const error = shallowRef('')
const workshopPath = computed(() =>
  `/api/events/${encodeURIComponent(props.eventId)}/workshops/${encodeURIComponent(props.sessionId)}`)

function addLink() {
  resources.value.push({ id: crypto.randomUUID(), kind: 'link', title: '', url: '' })
}

function removeResource(id: string) {
  resources.value = resources.value.filter(resource => resource.id !== id)
}

// An uploaded PDF becomes a slides item named after the file. It is saved with the workshop.
async function uploadPdf(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (file.size > workshopPdfMaxBytes) {
    error.value = 'Choose a PDF that is 20 MB or smaller.'
    return
  }

  uploading.value = true
  error.value = ''
  try {
    const body = new FormData()
    body.set('file', file)
    const { data } = await apiFetch<ApiDataResponse<{ id: string, name: string }>>(`${workshopPath.value}/files`, { method: 'POST', body })
    resources.value.push({ id: crypto.randomUUID(), kind: 'slides', title: data.name.replace(/\.pdf$/i, ''), file: data })
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    uploading.value = false
  }
}

async function save() {
  // An item with a PDF has no link, so its empty link field is left out.
  const content = workshopContentSchema.safeParse({
    description: description.value,
    resources: resources.value.map(resource => ({ ...resource, url: resource.file ? undefined : resource.url }))
  })
  if (!content.success) {
    error.value = content.error.issues[0]!.message
    return
  }

  saving.value = true
  error.value = ''
  try {
    await apiFetch(workshopPath.value, { method: 'PUT', body: content.data })
    toast.add({ title: 'Workshop saved', color: 'success' })
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
    class="space-y-5"
    data-testid="program-workshop-editor"
    @submit.prevent="save"
  >
    <AdminMarkdownEditorField
      v-model="description"
      :name="`${formId}-description`"
      label="Description"
      :editor-id="`${formId}-description`"
      height="260px"
    />

    <fieldset class="space-y-3">
      <legend class="text-sm font-medium text-highlighted">
        Slides, materials and links
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
            @update:model-value="value => resource.kind = value as WorkshopResourceKind"
          >
            <option
              v-for="kind in workshopResourceKinds"
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
          data-testid="program-workshop-file"
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
        label="Save workshop"
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
