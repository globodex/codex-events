<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import type { PlatformSettingsRecord } from '~/composables/usePlatformSettings'

import { normalizeApiError } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'

const toast = useToast()
const apiFetch = useApiClient()
const {
  data: settings,
  status: settingsStatus,
  error: settingsError,
  refresh: refreshSettings
} = usePlatformSettings()

const fileInput = ref<HTMLInputElement | null>(null)
const mutation = reactive({
  pending: false,
  error: ''
})
const defaultBackgroundImageUrl = computed(() =>
  settings.value?.defaultEventBackgroundImageUrl?.trim() ?? ''
)
const mutationLabel = computed(() =>
  defaultBackgroundImageUrl.value ? 'Replace default background' : 'Upload default background'
)

function promptUpload() {
  fileInput.value?.click()
}

async function uploadDefaultBackgroundImage(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.item(0) ?? null

  if (!file) {
    return
  }

  mutation.pending = true
  mutation.error = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    await apiFetch<ApiDataResponse<PlatformSettingsRecord>>('/api/platform-settings/event-default-background-image', {
      method: 'POST',
      body: formData
    })

    await refreshSettings()
    toast.add({
      title: 'Default background updated',
      description: 'Events without their own background now use this image.',
      color: 'success'
    })
  } catch (error) {
    mutation.error = normalizeApiError(error).message
  } finally {
    mutation.pending = false

    if (target) {
      target.value = ''
    }
  }
}

async function removeDefaultBackgroundImage() {
  mutation.pending = true
  mutation.error = ''

  try {
    await apiFetch<ApiDataResponse<PlatformSettingsRecord | null>>('/api/platform-settings/event-default-background-image', {
      method: 'DELETE'
    })

    await refreshSettings()
    toast.add({
      title: 'Default background removed',
      description: 'Events without their own background no longer use a platform default.',
      color: 'success'
    })
  } catch (error) {
    mutation.error = normalizeApiError(error).message
  } finally {
    mutation.pending = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppAlert
      v-if="settingsError"
      color="error"
      variant="soft"
      title="Unable to load event defaults"
      :description="settingsError.message"
    />

    <AppAlert
      v-else-if="settingsStatus !== 'success'"
      title="Loading event defaults"
    />
    <AppCard
      v-else
      class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
    >
      <template #header>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">
            Event backgrounds
          </h2>
          <p class="text-sm text-muted">
            Set the image shown on event detail pages when an event does not have its own background.
          </p>
        </div>
      </template>

      <div class="space-y-5">
        <div class="overflow-hidden rounded-lg border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]">
          <img
            v-if="defaultBackgroundImageUrl"
            :src="defaultBackgroundImageUrl"
            alt="Default event background preview"
            class="h-64 w-full object-cover"
          >
          <div
            v-else
            class="flex h-64 items-center justify-center px-4 text-center text-sm text-muted"
          >
            No default background image uploaded yet.
          </div>
        </div>

        <AppAlert
          v-if="!defaultBackgroundImageUrl"
          color="neutral"
          variant="soft"
          title="No default event background"
          description="Events without their own background use their banner image when one is available."
        />

        <AppAlert
          v-if="mutation.error"
          color="error"
          variant="soft"
          title="Default background update failed"
          :description="mutation.error"
        />

        <div class="flex flex-wrap items-center gap-2">
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png"
            class="sr-only"
            :disabled="mutation.pending"
            @change="uploadDefaultBackgroundImage"
          >
          <AppButton
            type="button"
            color="primary"
            :loading="mutation.pending"
            :disabled="mutation.pending"
            @click="promptUpload"
          >
            {{ mutationLabel }}
          </AppButton>
          <AppButton
            v-if="defaultBackgroundImageUrl"
            type="button"
            color="neutral"
            variant="soft"
            :disabled="mutation.pending"
            @click="removeDefaultBackgroundImage"
          >
            Remove default background
          </AppButton>
          <p
            v-if="mutation.pending"
            class="text-xs text-muted"
            role="status"
            aria-live="polite"
          >
            Updating default background...
          </p>
        </div>
      </div>
    </AppCard>
  </div>
</template>
