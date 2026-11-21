<script setup lang="ts">
import type { EventFloorPlan } from '#shared/domains/events/program'
import type { ApiDataResponse } from '~/lib/api'
import { normalizeApiError } from '~/lib/api'
import AdminBuilderFloorPlanEditor from '~/components/admin/builder/molecules/AdminBuilderFloorPlanEditor.vue'

const props = defineProps<{
  eventId: string
  plans: EventFloorPlan[]
}>()
const emit = defineEmits<{
  updated: [plan: EventFloorPlan]
}>()

const apiFetch = useApiClient()
const formId = useId()
const showingForm = shallowRef(false)
const uploadedPlanId = shallowRef<string | null>(null)
const uploading = shallowRef(false)
const error = shallowRef('')
const initialOpenPlanId = computed(() => uploadedPlanId.value ?? props.plans[0]?.id)

function closeForm() {
  showingForm.value = false
  error.value = ''
}

async function addPlan(event: SubmitEvent) {
  const eventId = props.eventId
  if (uploading.value) {
    return
  }

  const body = new FormData(event.currentTarget as HTMLFormElement)

  uploading.value = true
  error.value = ''
  try {
    const { data } = await apiFetch<ApiDataResponse<EventFloorPlan>>(
      `/api/events/${encodeURIComponent(eventId)}/floor-plans`,
      { method: 'POST', body }
    )
    if (eventId === props.eventId) {
      emit('updated', data)
      uploadedPlanId.value = data.id
      closeForm()
    }
  } catch (caught) {
    error.value = normalizeApiError(caught).message
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <section
    :aria-labelledby="`${formId}-heading`"
    data-testid="event-builder-floor-plans"
    class="space-y-4"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3
        :id="`${formId}-heading`"
        class="text-base font-semibold text-highlighted"
      >
        Floor plans
      </h3>
      <AppButton
        v-if="!showingForm"
        size="sm"
        variant="outline"
        color="neutral"
        icon="i-lucide-plus"
        label="Add floor"
        @click="showingForm = true"
      />
    </div>

    <form
      v-if="showingForm"
      class="space-y-3"
      @submit.prevent="addPlan"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <AppFormField
          :name="`${formId}-name`"
          label="Floor name"
        >
          <AppInput
            :id="`${formId}-name`"
            name="name"
            size="sm"
            :disabled="uploading"
            required
          />
        </AppFormField>
        <AppFormField
          :name="`${formId}-file`"
          label="Floor plan image"
        >
          <input
            :id="`${formId}-file`"
            name="file"
            type="file"
            accept="image/jpeg,image/png"
            class="w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-default file:bg-elevated file:px-3 file:py-2 file:text-sm file:text-highlighted"
            :disabled="uploading"
            required
          >
        </AppFormField>
      </div>
      <AppAlert
        v-if="error"
        color="error"
        :description="error"
      />
      <div class="flex flex-wrap justify-end gap-2">
        <AppButton
          size="sm"
          variant="ghost"
          color="neutral"
          label="Cancel"
          :disabled="uploading"
          @click="closeForm"
        />
        <AppButton
          type="submit"
          size="sm"
          label="Upload floor plan"
          :loading="uploading"
        />
      </div>
    </form>

    <div
      v-if="plans.length"
      class="divide-y divide-default border-y border-default"
    >
      <details
        v-for="plan in plans"
        :key="plan.id"
        :open="initialOpenPlanId === plan.id"
        class="group"
      >
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 py-3 text-sm font-medium text-highlighted">
          {{ plan.name }}
          <AppIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <AdminBuilderFloorPlanEditor
          :event-id="eventId"
          :plan="plan"
          class="pb-4"
          @updated="emit('updated', $event)"
        />
      </details>
    </div>
  </section>
</template>
