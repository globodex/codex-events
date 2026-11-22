<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app'
import type { Ref } from 'vue'
import type { ApiDataResponse } from '~/lib/api'
import type { PlatformDocumentRecord } from '~/composables/useCurrentPlatformDocuments'

import { normalizeApiError } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'

const toast = useToast()
const apiFetch = useApiClient()
const {
  data: settings,
  status: settingsStatus,
  error: settingsError,
  refresh: refreshSettings
} = usePlatformLegalSettings()
const {
  privacyPolicyDocument,
  platformTermsDocument,
  status: documentsStatus,
  error: documentsError,
  refresh: refreshDocuments
} = useCurrentPlatformDocuments()

function useTextDraft(status: Ref<AsyncDataRequestStatus>, saved: () => string | undefined) {
  const edit = shallowRef<string>()
  watch([status, saved], ([state, text]) => {
    if (state === 'success' && text === edit.value) {
      edit.value = undefined
    }
  })
  return computed({
    get: () => edit.value ?? saved() ?? '',
    set: (value: string) => { edit.value = value }
  })
}

const supportEmail = useTextDraft(settingsStatus, () => settings.value?.supportEmail)
const imprintContent = useTextDraft(settingsStatus, () => settings.value?.imprintContent)
const privacyPolicyDraft = useTextDraft(documentsStatus, () => privacyPolicyDocument.value?.content)
const platformTermsDraft = useTextDraft(documentsStatus, () => platformTermsDocument.value?.content)
const privacyPolicyTitle = ref('')
const platformTermsTitle = ref('')
const settingsMutation = reactive({
  pending: false,
  error: ''
})
const publishingDocumentType = ref<PlatformDocumentRecord['documentType'] | null>(null)
const publishError = ref('')

function formatTitle(documentType: PlatformDocumentRecord['documentType']) {
  const currentDocument = documentType === 'privacy_policy'
    ? privacyPolicyDocument.value
    : platformTermsDocument.value
  const label = documentType === 'privacy_policy' ? 'Privacy Policy' : 'Platform Terms'
  const nextVersion = (currentDocument?.version ?? 0) + 1
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  return `${label} v${nextVersion} (${date})`
}

function getDocumentDraft(documentType: PlatformDocumentRecord['documentType']) {
  return documentType === 'privacy_policy'
    ? privacyPolicyDraft.value
    : platformTermsDraft.value
}

async function saveLegalSettings() {
  settingsMutation.pending = true
  settingsMutation.error = ''

  try {
    await apiFetch('/api/platform-legal-settings/current', {
      method: 'PATCH',
      body: { supportEmail: supportEmail.value, imprintContent: imprintContent.value }
    })

    await refreshSettings()
    toast.add({
      title: 'Legal settings saved',
      description: 'The public imprint and contact form now use the latest settings.',
      color: 'success'
    })
  } catch (error) {
    settingsMutation.error = normalizeApiError(error).message
  } finally {
    settingsMutation.pending = false
  }
}

async function publishPlatformDocument(documentType: PlatformDocumentRecord['documentType']) {
  const content = getDocumentDraft(documentType).trim()

  publishError.value = ''

  if (!content) {
    publishError.value = documentType === 'privacy_policy'
      ? 'Enter Privacy Policy content before publishing.'
      : 'Enter Platform Terms content before publishing.'
    return
  }

  const title = documentType === 'privacy_policy' ? privacyPolicyTitle : platformTermsTitle
  const submittedTitle = title.value
  publishingDocumentType.value = documentType

  try {
    await apiFetch<ApiDataResponse<PlatformDocumentRecord>>(`/api/platform-documents/${documentType}/versions`, {
      method: 'POST',
      body: {
        title: submittedTitle.trim() || formatTitle(documentType),
        content
      }
    })

    if (title.value === submittedTitle) {
      title.value = ''
    }

    await refreshDocuments()
    toast.add({
      title: documentType === 'privacy_policy' ? 'Privacy Policy published' : 'Platform Terms published',
      description: 'A new current platform document version is now available for public pages and consent flows.',
      color: 'success'
    })
  } catch (error) {
    publishError.value = normalizeApiError(error).message
  } finally {
    publishingDocumentType.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
      <template #header>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">
            Imprint and contact
          </h2>
          <p class="text-sm text-muted">
            Set the email that receives messages from the public imprint form and the legal notice shown on the imprint page. Saving this does not create a new consent version.
          </p>
        </div>
      </template>

      <AppAlert
        v-if="settingsError"
        color="error"
        title="Unable to load legal settings"
        :description="settingsError.message"
      />
      <AppAlert
        v-else-if="settingsStatus !== 'success'"
        title="Loading legal settings"
      />
      <form
        v-else
        class="space-y-5"
        @submit.prevent="saveLegalSettings"
      >
        <AppAlert
          v-if="!settings"
          color="warning"
          title="Legal settings are not configured"
          description="The public imprint and contact form remain unavailable until these settings are saved."
        />
        <AppFormField
          name="platform-support-email"
          label="Support email"
          description="Receives messages from the public imprint contact form. Use an inbox monitored by the platform operator."
        >
          <AppInput
            v-model="supportEmail"
            type="email"
            required
          />
        </AppFormField>

        <LazyAdminMarkdownEditorField
          v-model="imprintContent"
          name="platform-imprint-content"
          editor-id="platform-imprint-content"
          label="Imprint content"
          description="Public legal notice shown on the imprint page. Include operator details, address, legal and privacy contact details, DSA contact points, platform purpose, editorial focus, and jurisdiction-specific disclosures."
          placeholder="Enter the public legal notice for this deployment."
          required
        />

        <AppAlert
          v-if="settingsMutation.error"
          color="error"
          variant="soft"
          title="Legal settings update failed"
          :description="settingsMutation.error"
        />

        <div class="flex justify-end">
          <AppButton
            type="submit"
            color="primary"
            :loading="settingsMutation.pending"
          >
            Save legal settings
          </AppButton>
        </div>
      </form>
    </AppCard>

    <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
      <template #header>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-highlighted">
            Platform consent documents
          </h2>
          <p class="text-sm text-muted">
            Publishing creates a new current version. Existing accepted versions are retained unchanged.
          </p>
        </div>
      </template>

      <AppAlert
        v-if="documentsError"
        color="error"
        title="Unable to load platform documents"
        :description="documentsError.message"
      />
      <AppAlert
        v-else-if="documentsStatus !== 'success'"
        title="Loading platform documents"
      />
      <div
        v-else
        class="space-y-6"
      >
        <AppAlert
          v-if="!privacyPolicyDocument || !platformTermsDocument"
          color="warning"
          title="Platform consent documents are incomplete"
          description="Account registration and re-consent require current Privacy Policy and Platform Terms versions."
        />
        <AppAlert
          v-if="publishError"
          color="error"
          variant="soft"
          title="Publish failed"
          :description="publishError"
        />

        <section class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-highlighted">
              Privacy Policy
            </h3>
            <p class="text-xs text-muted">
              {{ privacyPolicyDocument ? `Current v${privacyPolicyDocument.version}` : 'No published version' }}
            </p>
          </div>

          <AppFormField
            name="privacy-policy-title"
            label="Version title"
            description="Leave blank to use the next version number and today's date."
          >
            <AppInput
              v-model="privacyPolicyTitle"
              type="text"
              :placeholder="formatTitle('privacy_policy')"
            />
          </AppFormField>

          <LazyAdminMarkdownEditorField
            v-model="privacyPolicyDraft"
            name="privacy-policy-content"
            editor-id="privacy-policy-content"
            label="Content"
            placeholder="Enter the Privacy Policy content."
            required
          />

          <div class="flex justify-end">
            <AppButton
              color="primary"
              :loading="publishingDocumentType === 'privacy_policy'"
              :disabled="publishingDocumentType !== null"
              @click="publishPlatformDocument('privacy_policy')"
            >
              Publish Privacy Policy
            </AppButton>
          </div>
        </section>

        <section class="space-y-4 border-t border-black/8 pt-6 dark:border-white/[0.08]">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-base font-semibold text-highlighted">
              Platform Terms
            </h3>
            <p class="text-xs text-muted">
              {{ platformTermsDocument ? `Current v${platformTermsDocument.version}` : 'No published version' }}
            </p>
          </div>

          <AppFormField
            name="platform-terms-title"
            label="Version title"
            description="Leave blank to use the next version number and today's date."
          >
            <AppInput
              v-model="platformTermsTitle"
              type="text"
              :placeholder="formatTitle('platform_terms')"
            />
          </AppFormField>

          <LazyAdminMarkdownEditorField
            v-model="platformTermsDraft"
            name="platform-terms-content"
            editor-id="platform-terms-content"
            label="Content"
            placeholder="Enter the Platform Terms content."
            required
          />

          <div class="flex justify-end">
            <AppButton
              color="primary"
              :loading="publishingDocumentType === 'platform_terms'"
              :disabled="publishingDocumentType !== null"
              @click="publishPlatformDocument('platform_terms')"
            >
              Publish Platform Terms
            </AppButton>
          </div>
        </section>
      </div>
    </AppCard>
  </div>
</template>
