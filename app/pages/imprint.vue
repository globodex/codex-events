<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'

import { cloneFormValues } from '~/utils/form-values'
import { imprintContactFormSchema } from '~/domains/platform/legal-contact'

const initialContactForm = {
  name: '',
  email: '',
  message: '',
  website: ''
}
const contactForm = reactive(cloneFormValues(initialContactForm))
const syncingFromForm = ref(false)

const contactState = reactive({
  pending: false,
  success: '',
  error: ''
})
const { polite, assertive } = useAnnouncer()
const { data: settings, status: settingsStatus } = await usePlatformLegalSettings()

const {
  errors,
  submitCount,
  setValues,
  values,
  resetForm,
  handleSubmit
} = useForm({
  validationSchema: toTypedSchema(imprintContactFormSchema),
  initialValues: { ...initialContactForm }
})

watch(contactForm, (nextForm) => {
  syncingFromForm.value = true
  setValues(cloneFormValues(nextForm), submitCount.value > 0)
  syncingFromForm.value = false
}, {
  deep: true,
  immediate: true
})

watch(values, (nextValues) => {
  if (syncingFromForm.value) {
    return
  }

  Object.assign(contactForm, cloneFormValues(nextValues))
}, {
  deep: true
})

function extractErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: { message?: string } } }).data
    const message = data?.error?.message?.trim()

    if (message) {
      return message
    }
  }

  return error instanceof Error ? error.message : fallback
}

function resetContactFormState() {
  Object.assign(contactForm, cloneFormValues(initialContactForm))
  resetForm({
    values: { ...initialContactForm }
  })
  contactState.error = ''
}

const submitContactForm = handleSubmit(async (contactForm) => {
  contactState.pending = true
  contactState.success = ''
  contactState.error = ''

  try {
    await $fetch('/api/public/imprint-contact', {
      method: 'POST',
      body: {
        name: contactForm.name,
        email: contactForm.email,
        message: contactForm.message,
        website: contactForm.website
      }
    })

    resetContactFormState()
    contactState.success = 'We will reply to the email address you provided.'
    polite('Message sent. We will reply to the email address you provided.')
  } catch (error) {
    contactState.error = extractErrorMessage(error, 'Unable to send your message right now.')
    assertive(contactState.error)
  } finally {
    contactState.pending = false
  }
})

function startAnotherContactMessage() {
  resetContactFormState()
  contactState.success = ''
}

function formatLegalDate(value: string | undefined) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value))
}

const lastUpdatedLabel = computed(() => formatLegalDate(settings.value?.updatedAt))

useSeoMeta({
  title: 'Legal Notice | Codex Events',
  description: 'Find operator details and contact information for Codex Events.'
})
</script>

<template>
  <div class="relative isolate pb-24">
    <section class="relative z-10 border-b border-black/8 bg-white/52 backdrop-blur-lg dark:border-white/[0.08] dark:bg-black/56">
      <AppContainer class="max-w-[68rem] pb-0 pt-2 sm:pt-3">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-[13px] font-medium text-neutral-600 transition-colors hover:text-highlighted dark:text-[#A3A3A3] dark:hover:text-white"
        >
          <AppIcon
            name="i-lucide-arrow-left"
            class="size-4"
          />
          Back to events
        </NuxtLink>

        <div class="mt-3 border-b border-black/8 pb-4 dark:border-white/[0.08]">
          <div class="space-y-3">
            <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Imprint
            </h1>
            <p class="text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
              Legal notice, operator details, and direct contact options for Codex Events.
            </p>
            <div class="flex flex-wrap items-center gap-3 text-[13px] text-neutral-600 dark:text-[#A3A3A3]">
              <span v-if="lastUpdatedLabel">Last updated {{ lastUpdatedLabel }}</span>
              <span
                v-if="lastUpdatedLabel && settings?.supportEmail"
                class="hidden sm:inline"
              >•</span>
              <a
                v-if="settings?.supportEmail"
                :href="`mailto:${settings.supportEmail}`"
                class="transition-colors hover:text-highlighted dark:hover:text-white"
              >
                {{ settings.supportEmail }}
              </a>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="relative z-10 grid max-w-[68rem] gap-6 pb-10 pt-6 sm:pb-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <AppAlert
        v-if="settingsStatus === 'error'"
        title="Unable to load legal notice"
        color="error"
        class="lg:col-span-2"
      />

      <AppAlert
        v-else-if="settingsStatus !== 'success'"
        color="neutral"
        variant="soft"
        title="Loading legal notice"
        description="Fetching the configured legal notice."
        class="lg:col-span-2"
      />

      <AppAlert
        v-else-if="!settings"
        color="warning"
        variant="soft"
        title="Legal notice unavailable"
        description="The platform operator has not configured legal notice content for this deployment."
        class="lg:col-span-2"
      />

      <div class="space-y-6">
        <section
          v-if="settings"
          class="rounded-xl border border-black/8 bg-[#F7F7F8]/80 p-6 dark:border-white/[0.08] dark:bg-[#111111]/80"
        >
          <AppMarkdownRenderer
            :source="settings.imprintContent"
            normalize-escaped-newlines
          />
        </section>

        <section class="rounded-xl border border-black/8 bg-[#F7F7F8]/80 p-6 dark:border-white/[0.08] dark:bg-[#111111]/80">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Open-source notices
            </h2>
            <p class="text-sm text-neutral-700 dark:text-[#A3A3A3]">
              Runtime third-party dependency notices and bundled license texts are published on a separate page.
            </p>
            <NuxtLink
              to="/third-party-notices"
              class="inline-flex items-center gap-2 text-sm font-medium text-highlighted transition-colors hover:text-highlighted/80 dark:text-white dark:hover:text-[#D7D7D7]"
            >
              Review third-party notices
              <AppIcon
                name="i-lucide-arrow-right"
                class="size-4"
              />
            </NuxtLink>
          </div>
        </section>
      </div>

      <section
        v-if="settingsStatus === 'success'"
        class="rounded-xl border border-black/8 bg-[#F7F7F8]/80 p-6 dark:border-white/[0.08] dark:bg-[#111111]/92"
      >
        <div class="space-y-4">
          <div class="space-y-2">
            <h2 class="text-lg font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
              Contact us
            </h2>
            <p class="text-sm text-neutral-700 dark:text-[#A3A3A3]">
              Use this form for legal, support, and general platform questions. We use the information you provide to handle and reply to your message, as described in the Privacy Policy.
            </p>
          </div>

          <AppAlert
            v-if="!settings"
            color="warning"
            variant="soft"
            title="Contact unavailable"
            description="The platform operator has not configured legal contact details for this deployment."
          />

          <div
            v-else-if="contactState.success"
            class="space-y-4"
          >
            <AppAlert
              color="success"
              variant="subtle"
              title="Message sent"
              :description="contactState.success"
            />

            <div class="flex justify-end">
              <AppButton
                color="neutral"
                variant="outline"
                @click="startAnotherContactMessage"
              >
                Send another message
              </AppButton>
            </div>
          </div>

          <form
            v-else
            class="space-y-4"
            novalidate
            @submit.prevent="submitContactForm"
          >
            <AppFormField
              name="imprint-contact-name"
              label="Name"
            >
              <AppInput
                id="imprint-contact-name"
                v-model="contactForm.name"
                type="text"
                maxlength="120"
                autocomplete="name"
                :class="submitCount > 0 && errors.name ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-highlighted'"
              />
              <p
                v-if="submitCount > 0 && errors.name"
                class="text-xs text-error"
              >
                {{ errors.name }}
              </p>
            </AppFormField>

            <AppFormField
              name="imprint-contact-email"
              label="Email"
            >
              <AppInput
                id="imprint-contact-email"
                v-model="contactForm.email"
                type="email"
                autocomplete="email"
                :class="submitCount > 0 && errors.email ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-highlighted'"
              />
              <p
                v-if="submitCount > 0 && errors.email"
                class="text-xs text-error"
              >
                {{ errors.email }}
              </p>
            </AppFormField>

            <div
              aria-hidden="true"
              class="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
            >
              <label for="imprint-contact-website">Website</label>
              <input
                id="imprint-contact-website"
                v-model="contactForm.website"
                type="text"
                tabindex="-1"
                autocomplete="off"
              >
            </div>

            <AppFormField
              name="imprint-contact-message"
              label="Message"
            >
              <AppTextarea
                id="imprint-contact-message"
                v-model="contactForm.message"
                maxlength="4000"
                rows="7"
                :class="submitCount > 0 && errors.message ? 'border-error/45 focus:border-error dark:border-error/50' : 'focus:border-highlighted'"
              />
              <p
                v-if="submitCount > 0 && errors.message"
                class="text-xs text-error"
              >
                {{ errors.message }}
              </p>
            </AppFormField>

            <AppAlert
              v-if="contactState.error"
              color="error"
              variant="subtle"
              :description="contactState.error"
            />

            <div class="flex justify-end">
              <AppButton
                type="submit"
                color="primary"
                :loading="contactState.pending"
              >
                Send
              </AppButton>
            </div>

            <div class="rounded-xl border border-black/8 bg-white/70 px-4 py-3 text-sm text-neutral-700 dark:border-white/[0.08] dark:bg-[#181818] dark:text-[#A3A3A3]">
              <span class="font-medium text-highlighted dark:text-white">Prefer email?</span>
              Write directly to
              <a
                :href="`mailto:${settings.supportEmail}`"
                class="font-medium underline underline-offset-2 transition-colors hover:text-highlighted dark:hover:text-white"
              >
                {{ settings.supportEmail }}
              </a>.
            </div>
          </form>
        </div>
      </section>
    </AppContainer>
  </div>
</template>
