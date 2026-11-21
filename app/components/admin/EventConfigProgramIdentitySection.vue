<script setup lang="ts">
import type { EventFormState } from '~/domains/events/admin-event'

import {
  buildVersionedEventImageUrl,
  resolveEventImageVersion,
  type EventImageVersions
} from '~/domains/events/presentation'
import { getCountryOptions } from '~/utils/country-options'

const form = defineModel<EventFormState>('form', {
  required: true
})

const props = defineProps<{
  description: string
  canUploadManagedImages?: boolean
  backgroundImageUploadPending?: boolean
  backgroundImageUploadError?: string
  bannerImageUploadPending?: boolean
  bannerImageUploadError?: string
  imageVersion?: string | number | EventImageVersions | null
}>()

const emit = defineEmits<{
  uploadBackgroundImage: [file: File]
  removeBackgroundImage: []
  uploadBannerImage: [file: File]
  removeBannerImage: []
}>()

const countryOptions = computed(() => getCountryOptions(form.value.country))
const backgroundImageInput = ref<HTMLInputElement | null>(null)
const bannerImageInput = ref<HTMLInputElement | null>(null)
const managedBackgroundImageUrl = computed(() => form.value.backgroundImageUrl.trim())
const managedBannerImageUrl = computed(() => form.value.bannerImageUrl.trim())
const managedBackgroundImagePreviewUrl = computed(() =>
  buildVersionedEventImageUrl(
    managedBackgroundImageUrl.value,
    resolveEventImageVersion(props.imageVersion, 'background'),
    'background'
  )
)
const managedBannerImagePreviewUrl = computed(() =>
  buildVersionedEventImageUrl(
    managedBannerImageUrl.value,
    resolveEventImageVersion(props.imageVersion, 'banner'),
    'banner'
  )
)
const showBackgroundImageSection = computed(() =>
  Boolean(props.canUploadManagedImages || managedBackgroundImageUrl.value)
)
const showBannerImageSection = computed(() =>
  Boolean(props.canUploadManagedImages || managedBannerImageUrl.value)
)

function uploadBackgroundImage(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.item(0) ?? null

  if (!file) {
    return
  }

  emit('uploadBackgroundImage', file)

  if (target) {
    target.value = ''
  }
}

function uploadBannerImage(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.item(0) ?? null

  if (!file) {
    return
  }

  emit('uploadBannerImage', file)

  if (target) {
    target.value = ''
  }
}

function promptBackgroundImageUpload() {
  backgroundImageInput.value?.click()
}

function promptBannerImageUpload() {
  bannerImageInput.value?.click()
}
</script>

<template>
  <AppCard
    id="admin-config-identity"
    class="scroll-mt-28 rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60"
  >
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          Program Identity
        </h2>
        <p class="text-sm text-muted">
          {{ description }}
        </p>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-5">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
        <label class="grid gap-2">
          <span class="text-sm font-medium text-toned">City</span>
          <AppInput
            v-model="form.city"
            type="text"
            placeholder="Vienna"
            required
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-toned">Country</span>
          <div>
            <AppSelect
              v-model="form.country"
              required
            >
              <option
                disabled
                value=""
              >
                Select a country
              </option>
              <option
                v-for="option in countryOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </AppSelect>
          </div>
        </label>

        <label class="grid gap-2">
          <span class="text-sm font-medium text-toned">Address</span>
          <AppInput
            v-model="form.address"
            type="text"
            placeholder="Operngasse 20, 1040 Vienna"
            required
          />
        </label>
      </div>

      <section
        v-if="showBackgroundImageSection"
        class="grid grid-cols-1 gap-3"
      >
        <div class="space-y-1">
          <h3 class="text-sm font-medium text-toned">
            Background image
          </h3>
          <p class="text-xs text-muted">
            Managed image upload only. JPG/PNG up to 5MB.
          </p>
        </div>

        <div class="group relative overflow-hidden rounded-lg border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]">
          <img
            v-if="managedBackgroundImageUrl"
            :src="managedBackgroundImagePreviewUrl"
            alt="Event background preview"
            class="h-36 w-full object-cover"
          >
          <div
            v-else
            class="flex h-36 items-center justify-center px-4 text-center text-sm text-muted"
          >
            No background image uploaded yet.
          </div>
          <div
            v-if="props.canUploadManagedImages"
            class="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 transition-opacity"
            :class="props.backgroundImageUploadPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'"
          >
            <AppButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              :loading="props.backgroundImageUploadPending"
              :aria-label="managedBackgroundImageUrl ? 'Replace background image' : 'Upload background image'"
              class="w-9 rounded-full bg-white/15 px-0 text-white hover:bg-white/25 hover:text-white focus-visible:ring-white/80"
              @click="promptBackgroundImageUpload"
            />
            <AppButton
              v-if="managedBackgroundImageUrl"
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              :disabled="props.backgroundImageUploadPending"
              aria-label="Remove uploaded background"
              class="w-9 rounded-full bg-white/15 px-0 text-white hover:bg-error/80 hover:text-white focus-visible:ring-white/80"
              @click="emit('removeBackgroundImage')"
            />
          </div>
        </div>

        <template v-if="props.canUploadManagedImages">
          <input
            ref="backgroundImageInput"
            type="file"
            accept="image/jpeg,image/png"
            class="sr-only"
            :disabled="props.backgroundImageUploadPending"
            @change="uploadBackgroundImage"
          >
          <p
            v-if="props.backgroundImageUploadPending"
            class="text-xs text-muted"
            role="status"
            aria-live="polite"
          >
            Updating background image...
          </p>
        </template>
        <p
          v-else
          class="text-xs text-muted"
        >
          Save the draft first to enable managed background uploads.
        </p>

        <p
          v-if="props.backgroundImageUploadError"
          class="text-xs text-error"
        >
          {{ props.backgroundImageUploadError }}
        </p>
      </section>

      <section
        v-if="showBannerImageSection"
        class="grid grid-cols-1 gap-3"
      >
        <div class="space-y-1">
          <h3 class="text-sm font-medium text-toned">
            Banner image
          </h3>
          <p class="text-xs text-muted">
            Managed image upload only. JPG/PNG up to 5MB.
          </p>
        </div>

        <div class="group relative overflow-hidden rounded-lg border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]">
          <img
            v-if="managedBannerImageUrl"
            :src="managedBannerImagePreviewUrl"
            alt="Event banner preview"
            class="h-36 w-full object-cover"
          >
          <div
            v-else
            class="flex h-36 items-center justify-center px-4 text-center text-sm text-muted"
          >
            No banner image uploaded yet.
          </div>
          <div
            v-if="props.canUploadManagedImages"
            class="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 transition-opacity"
            :class="props.bannerImageUploadPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'"
          >
            <AppButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              :loading="props.bannerImageUploadPending"
              :aria-label="managedBannerImageUrl ? 'Replace banner image' : 'Upload banner image'"
              class="w-9 rounded-full bg-white/15 px-0 text-white hover:bg-white/25 hover:text-white focus-visible:ring-white/80"
              @click="promptBannerImageUpload"
            />
            <AppButton
              v-if="managedBannerImageUrl"
              color="neutral"
              variant="ghost"
              icon="i-lucide-trash-2"
              :disabled="props.bannerImageUploadPending"
              aria-label="Remove uploaded banner"
              class="w-9 rounded-full bg-white/15 px-0 text-white hover:bg-error/80 hover:text-white focus-visible:ring-white/80"
              @click="emit('removeBannerImage')"
            />
          </div>
        </div>

        <template v-if="props.canUploadManagedImages">
          <input
            ref="bannerImageInput"
            type="file"
            accept="image/jpeg,image/png"
            class="sr-only"
            :disabled="props.bannerImageUploadPending"
            @change="uploadBannerImage"
          >
          <p
            v-if="props.bannerImageUploadPending"
            class="text-xs text-muted"
            role="status"
            aria-live="polite"
          >
            Updating banner image...
          </p>
        </template>
        <p
          v-else
          class="text-xs text-muted"
        >
          Save the draft first to enable managed banner uploads.
        </p>

        <p
          v-if="props.bannerImageUploadError"
          class="text-xs text-error"
        >
          {{ props.bannerImageUploadError }}
        </p>
      </section>
    </div>
  </AppCard>
</template>
