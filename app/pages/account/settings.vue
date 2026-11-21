<script setup lang="ts">
import AccountSettingsProfileForm from '~/components/account/AccountSettingsProfileForm.vue'
import AccountMcpTokensPanel from '~/components/account/AccountMcpTokensPanel.vue'
import { authLogoutHref } from '#shared/domains/accounts/auth-navigation'
import { normalizeApiError } from '~/lib/api'
import { buildProfileIconHref } from '~/domains/accounts/profile-icon'
import { useApiClient } from '~/composables/useApiClient'

definePageMeta({
  middleware: ['require-auth']
})

const apiFetch = useApiClient()
const { actor, status, refresh } = await useAccountLifecycleActor()

const profileForm = reactive({
  firstName: '',
  familyName: '',
  company: '',
  bio: '',
  xProfileUrl: '',
  linkedinProfileUrl: '',
  githubProfileUrl: '',
  chatgptEmail: '',
  openaiOrgId: '',
  lumaEmail: ''
})

const saveState = reactive({
  pending: false,
  success: '',
  error: ''
})

const profileIconState = reactive({
  uploadPending: false,
  success: '',
  error: ''
})
const profileIconInput = ref<HTMLInputElement | null>(null)

const deletionState = reactive({
  confirmationText: '',
  pending: false,
  error: ''
})
const isDangerZoneExpanded = ref(false)

watch(
  actor,
  (nextActor) => {
    if (!nextActor?.hasPlatformAccount) {
      return
    }

    profileForm.firstName = nextActor.platformUser.firstName
    profileForm.familyName = nextActor.platformUser.familyName
    profileForm.company = nextActor.platformUser.company ?? ''
    profileForm.bio = nextActor.platformUser.bio ?? ''
    profileForm.xProfileUrl = nextActor.platformUser.xProfileUrl ?? ''
    profileForm.linkedinProfileUrl = nextActor.platformUser.linkedinProfileUrl ?? ''
    profileForm.githubProfileUrl = nextActor.platformUser.githubProfileUrl
      ?? nextActor.sessionUser.githubProfileUrl
      ?? ''
    profileForm.chatgptEmail = nextActor.platformUser.chatgptEmail ?? ''
    profileForm.openaiOrgId = nextActor.platformUser.openaiOrgId ?? ''
    profileForm.lumaEmail = nextActor.platformUser.lumaEmail ?? ''
  },
  { immediate: true }
)

async function saveProfile() {
  saveState.pending = true
  saveState.error = ''
  saveState.success = ''

  try {
    await apiFetch('/api/account', {
      method: 'PATCH',
      body: {
        firstName: profileForm.firstName,
        familyName: profileForm.familyName,
        company: profileForm.company,
        bio: profileForm.bio,
        xProfileUrl: profileForm.xProfileUrl,
        linkedinProfileUrl: profileForm.linkedinProfileUrl,
        githubProfileUrl: profileForm.githubProfileUrl,
        chatgptEmail: profileForm.chatgptEmail,
        openaiOrgId: profileForm.openaiOrgId,
        lumaEmail: profileForm.lumaEmail
      }
    })

    await refresh()
    saveState.success = 'Profile saved.'
  } catch (error) {
    saveState.error = error instanceof Error
      ? error.message
      : 'Unable to save the profile.'
  } finally {
    saveState.pending = false
  }
}

const profileIconSrc = computed(() => {
  if (actor.value?.kind !== 'platform_user') {
    return undefined
  }

  const version = actor.value.platformUser.profileIconRevision

  if (!version) {
    return undefined
  }

  return buildProfileIconHref(actor.value.platformUser.id, version)
})

const profileIconAlt = computed(() => {
  if (actor.value?.kind === 'platform_user') {
    const fullName = `${actor.value.platformUser.firstName} ${actor.value.platformUser.familyName}`.trim()
    return fullName || actor.value.platformUser.displayName
  }

  return actor.value.sessionUser?.name ?? 'User'
})

async function uploadProfileIcon(event: Event) {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.item(0) ?? null

  if (!file) {
    return
  }

  profileIconState.uploadPending = true
  profileIconState.success = ''
  profileIconState.error = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    await apiFetch('/api/account/profile-icon', {
      method: 'POST',
      body: formData
    })

    await refresh()
    profileIconState.success = 'Profile icon updated.'
  } catch (error) {
    profileIconState.error = normalizeApiError(error).message
  } finally {
    if (target) {
      target.value = ''
    }

    profileIconState.uploadPending = false
  }
}

function promptProfileIconUpload() {
  if (profileIconState.uploadPending) {
    return
  }

  profileIconInput.value?.click()
}

async function deleteAccount() {
  deletionState.error = ''

  if (deletionState.confirmationText !== 'delete my account') {
    deletionState.error = 'Type "delete my account" to continue.'
    return
  }

  deletionState.pending = true

  try {
    await apiFetch('/api/account', {
      method: 'DELETE'
    })

    await refresh()
    await navigateTo(authLogoutHref, { external: true })
  } catch (error) {
    deletionState.error = error instanceof Error
      ? error.message
      : 'Unable to delete account.'
  } finally {
    deletionState.pending = false
  }
}

const accountEmail = computed(() => {
  if (actor.value?.kind === 'platform_user') {
    return actor.value.platformUser.email
  }

  return actor.value.isAuthenticated ? actor.value.sessionUser.email ?? '' : ''
})

const isPlatformAccountUnavailable = computed(() =>
  status.value !== 'pending' && actor.value?.kind !== 'platform_user'
)
const profileSubmitLabel = computed(() => 'Save')

useSeoMeta({
  title: 'Profile Settings | Codex Events',
  description: 'Update the profile details you use across events.'
})
</script>

<template>
  <div class="pb-14">
    <section class="border-b border-black/8 dark:border-white/[0.08]">
      <AppContainer class="max-w-none pb-0 pt-2 sm:pt-3">
        <div class="space-y-2 pb-4">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="space-y-2">
              <h1 class="text-[28px] font-semibold tracking-[-0.02em] text-highlighted dark:text-white">
                Profile settings
              </h1>
              <p class="max-w-3xl text-[15px] text-neutral-700 dark:text-[#A3A3A3]">
                Update the profile details used across your event participation and keep your account information current.
              </p>
            </div>
            <div class="flex max-w-full items-center gap-2 rounded-lg border border-black/8 bg-[#F7F7F8] px-4 py-3 dark:border-white/[0.08] dark:bg-[#171717]">
              <AppIcon
                name="i-lucide-mail"
                class="size-4 text-dimmed"
              />
              <p class="text-[14px] font-medium text-highlighted dark:text-white">
                {{ accountEmail }}
              </p>
            </div>
          </div>
        </div>
      </AppContainer>
    </section>

    <AppContainer class="max-w-none space-y-8 pt-6">
      <div
        v-if="status === 'pending'"
        class="space-y-6"
      >
        <div class="h-64 rounded-xl border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]" />
        <div class="h-64 rounded-xl border border-black/8 bg-white dark:border-white/[0.08] dark:bg-[#111111]" />
      </div>

      <div
        v-else
        class="space-y-8"
      >
        <AppAlert
          v-if="isPlatformAccountUnavailable"
          color="warning"
          variant="subtle"
          title="Account provisioning is not complete"
          description="Finish account registration on the dedicated account-registration screen before editing profile settings."
        />

        <section class="space-y-5">
          <AppAlert
            v-if="saveState.success"
            color="success"
            variant="subtle"
            :description="saveState.success"
          />

          <AppAlert
            v-if="profileIconState.success"
            color="success"
            variant="subtle"
            :description="profileIconState.success"
          />

          <AppAlert
            v-if="profileIconState.error"
            color="error"
            variant="subtle"
            :description="profileIconState.error"
          />

          <div
            v-if="!isPlatformAccountUnavailable"
            class="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]"
          >
            <div
              class="rounded-xl border border-default/70 bg-default/45 p-5"
            >
              <div class="mb-4 flex items-center gap-2">
                <AppIcon
                  name="i-lucide-image"
                  class="size-4 text-dimmed"
                />
                <p class="text-sm font-semibold text-highlighted">
                  Profile icon
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-4">
                <AppButton
                  color="neutral"
                  variant="ghost"
                  class="group relative h-auto rounded-full p-0 transition-opacity hover:bg-transparent hover:opacity-95 disabled:opacity-100 dark:hover:bg-transparent"
                  :disabled="profileIconState.uploadPending"
                  aria-label="Edit profile icon"
                  @click="promptProfileIconUpload"
                >
                  <AppAvatar
                    :src="profileIconSrc"
                    :alt="profileIconAlt"
                    size="3xl"
                    fallback="icon"
                  />
                  <span
                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 transition-opacity"
                    :class="profileIconState.uploadPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'"
                  >
                    <AppIcon
                      :name="profileIconState.uploadPending ? 'i-lucide-loader-circle' : 'i-lucide-pencil'"
                      class="size-4 text-white"
                      :class="profileIconState.uploadPending ? 'animate-spin' : ''"
                    />
                  </span>
                </AppButton>

                <div class="space-y-3">
                  <input
                    ref="profileIconInput"
                    class="sr-only"
                    type="file"
                    accept="image/jpeg,image/png"
                    :disabled="profileIconState.uploadPending"
                    @change="uploadProfileIcon"
                  >
                  <p class="text-xs text-muted">
                    JPG/PNG up to 1mb
                  </p>
                  <p
                    v-if="profileIconState.uploadPending"
                    class="text-xs text-muted"
                    role="status"
                    aria-live="polite"
                  >
                    Uploading profile icon...
                  </p>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-default/70 bg-default/45 p-5">
              <div class="mb-4 flex items-center gap-2">
                <AppIcon
                  name="i-lucide-user"
                  class="size-4 text-dimmed"
                />
                <p class="text-sm font-semibold text-highlighted">
                  Profile information
                </p>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-highlighted"
                    for="account-first-name-inline"
                  >
                    First name
                  </label>
                  <AppInput
                    id="account-first-name-inline"
                    v-model="profileForm.firstName"
                    type="text"
                    required
                  />
                </div>

                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-highlighted"
                    for="account-family-name-inline"
                  >
                    Family name
                  </label>
                  <AppInput
                    id="account-family-name-inline"
                    v-model="profileForm.familyName"
                    type="text"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <AccountSettingsProfileForm
            v-if="!isPlatformAccountUnavailable"
            v-model="profileForm"
            :pending="saveState.pending"
            :error="saveState.error"
            :submit-label="profileSubmitLabel"
            :hide-profile-information="true"
            @submit="saveProfile"
          />
        </section>

        <AccountMcpTokensPanel v-if="!isPlatformAccountUnavailable" />

        <section
          v-if="!isPlatformAccountUnavailable"
          class="space-y-4"
        >
          <AppButton
            color="error"
            variant="ghost"
            class="h-auto w-full justify-start rounded-none border-b border-error/20 px-0 pt-0 pb-3 text-left hover:bg-transparent dark:hover:bg-transparent"
            :aria-expanded="isDangerZoneExpanded"
            @click="isDangerZoneExpanded = !isDangerZoneExpanded"
          >
            <span class="inline-flex items-center gap-2 text-[20px] font-medium text-error">
              Danger zone
              <AppIcon
                name="i-lucide-chevron-down"
                class="size-4 text-error transition-transform duration-200"
                :class="isDangerZoneExpanded ? 'rotate-180' : ''"
              />
            </span>
          </AppButton>

          <div
            v-if="isDangerZoneExpanded"
            class="rounded-xl border border-error/20 bg-error/5 p-6"
          >
            <div class="space-y-5">
              <div class="space-y-2">
                <p class="text-sm font-semibold text-highlighted dark:text-white">
                  Delete account
                </p>
                <p class="text-sm text-muted">
                  This action is permanent. Your account will be deleted and you will be signed out.
                </p>
              </div>

              <div class="space-y-2">
                <label
                  class="text-sm font-medium text-highlighted dark:text-white"
                  for="account-delete-confirmation"
                >
                  Type "delete my account" to continue
                </label>
                <AppInput
                  id="account-delete-confirmation"
                  v-model="deletionState.confirmationText"
                  type="text"
                  class="border-error/30 focus:border-error dark:border-error/40"
                />
              </div>

              <AppAlert
                v-if="deletionState.error"
                color="error"
                variant="subtle"
                :description="deletionState.error"
              />

              <div class="flex justify-end">
                <AppButton
                  color="error"
                  variant="solid"
                  label="Delete account permanently"
                  :loading="deletionState.pending"
                  @click="deleteAccount"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppContainer>
  </div>
</template>
