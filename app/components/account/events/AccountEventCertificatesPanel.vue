<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'
import { normalizeApiError } from '~/lib/api'
import type { AccountEventCertificatesPage } from '#shared/domains/events/account-event-certificates-page'
import type { AdminApplicationRecord } from '~/domains/applications/admin-application-record'
import {
  formatApplicationAttendanceSource,
  formatApplicationAttendanceStatus,
  getApplicationAttendanceStatusColor,
  isApplicationCheckedIn,
  listParticipantRosterApplications
} from '~/domains/applications/admin-application-record'
import { buildProfileIconHref } from '~/domains/accounts/profile-icon'
import { formatTimestamp } from '~/lib/date-formatting'
import type { ApplicationCheckInOverrideStatus } from '#shared/domains/applications/check-in'
import { buildEventCertificatePath } from '#shared/domains/events/certificates'
import { useApiClient } from '~/composables/useApiClient'

const props = withDefaults(defineProps<{
  eventId: string
  eventSlug: string
  page: AccountEventCertificatesPage | null
  refreshPage: (eventSlug: string) => Promise<void>
  isLoading?: boolean
  loadErrorMessage?: string
}>(), {
  isLoading: false,
  loadErrorMessage: ''
})

const toast = useToast()
const apiFetch = useApiClient()
const eventId = computed(() => props.eventId.trim())

type CertificateEmailResponse = {
  enqueuedCount: number
  failedCount: number
}

const pendingActionKey = ref('')
const searchTerm = ref('')
const certificateEmailActionKey = 'certificate-emails:send'

const attendanceFilters = [
  { id: 'all', label: 'All' },
  { id: 'checked_in', label: 'Checked in' },
  { id: 'not_checked_in', label: 'Not checked in' }
] as const

const checkInDecisions = [
  { status: 'joined', label: 'Joined', icon: 'i-lucide-check', color: 'success' },
  { status: 'not_joined', label: 'Not joined', icon: 'i-lucide-x', color: 'error' }
] as const

type AttendanceFilter = (typeof attendanceFilters)[number]['id']

const activeAttendanceFilter = ref<AttendanceFilter>('all')

const approvedApplications = computed(() =>
  listParticipantRosterApplications(props.page?.applications ?? [])
    .filter(application => application.status === 'approved')
)

const visibleApplications = computed(() => {
  const normalizedSearch = searchTerm.value.trim().toLowerCase()

  return approvedApplications.value.filter((application) => {
    if (activeAttendanceFilter.value === 'checked_in' && !isApplicationCheckedIn(application)) {
      return false
    }

    if (activeAttendanceFilter.value === 'not_checked_in' && isApplicationCheckedIn(application)) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    return [application.user?.displayName, application.user?.email]
      .some(value => value?.toLowerCase().includes(normalizedSearch))
  })
})

const checkedInCount = computed(() => approvedApplications.value.filter(application => isApplicationCheckedIn(application)).length)
const notCheckedInCount = computed(() => approvedApplications.value.length - checkedInCount.value)
const certificateEmailReadyApplications = computed(() =>
  approvedApplications.value.filter(application => canSendCertificateEmail(application))
)
const certificateEmailReadyCount = computed(() => certificateEmailReadyApplications.value.length)
const certificateEmailSentCount = computed(() =>
  approvedApplications.value.filter(application => Boolean(application.certificateEmailSentAt)).length
)
const attendanceFilterTabs = computed(() =>
  attendanceFilters.map(filter => ({
    ...filter,
    count: filter.id === 'all'
      ? approvedApplications.value.length
      : filter.id === 'checked_in'
        ? checkedInCount.value
        : notCheckedInCount.value
  }))
)
const isCertificateEmailActionPending = computed(() => pendingActionKey.value === certificateEmailActionKey)
const isCertificateEmailActionDisabled = computed(() =>
  (pendingActionKey.value.length > 0 && !isCertificateEmailActionPending.value)
  || certificateEmailReadyCount.value === 0
)

async function overrideCheckIn(application: AdminApplicationRecord, status: ApplicationCheckInOverrideStatus) {
  if (pendingActionKey.value) {
    return
  }

  const eventSlug = props.eventSlug
  pendingActionKey.value = getCheckInActionKey(application, status)

  try {
    await apiFetch(
      `/api/events/${eventId.value}/applications/${application.id}/actions/override-check-in`,
      {
        method: 'POST',
        body: { status }
      }
    )

    await props.refreshPage(eventSlug)
  } catch (error) {
    toast.add({
      title: 'Attendance could not be updated',
      description: normalizeApiError(error).message,
      color: 'error'
    })
  } finally {
    pendingActionKey.value = ''
  }
}

async function setCertificateRevoked(application: AdminApplicationRecord, revoked: boolean) {
  if (pendingActionKey.value) {
    return
  }

  const eventSlug = props.eventSlug
  pendingActionKey.value = getCertificateRevocationActionKey(application, revoked)

  try {
    await apiFetch(
      `/api/events/${eventId.value}/applications/${application.id}/actions/set-certificate-revocation`,
      {
        method: 'POST',
        body: { revoked }
      }
    )

    await props.refreshPage(eventSlug)

    toast.add({
      title: revoked ? 'Certificate revoked' : 'Certificate restored',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: revoked ? 'Certificate could not be revoked' : 'Certificate could not be restored',
      description: normalizeApiError(error).message,
      color: 'error'
    })
  } finally {
    pendingActionKey.value = ''
  }
}

async function sendCertificateEmails() {
  if (pendingActionKey.value || certificateEmailReadyCount.value === 0) {
    return
  }

  const eventSlug = props.eventSlug
  pendingActionKey.value = certificateEmailActionKey

  try {
    const response = await apiFetch<ApiDataResponse<CertificateEmailResponse>>(
      `/api/events/${eventId.value}/applications/actions/send-certificate-emails`,
      {
        method: 'POST'
      }
    )

    await props.refreshPage(eventSlug)

    if (response.data.enqueuedCount > 0) {
      toast.add({
        title: 'Certificate emails queued',
        color: 'success'
      })
      return
    }

    toast.add({
      title: response.data.failedCount > 0
        ? 'Certificate emails could not be sent'
        : 'No certificate emails ready',
      color: response.data.failedCount > 0 ? 'error' : 'neutral'
    })
  } catch (error) {
    toast.add({
      title: 'Certificate emails could not be sent',
      description: normalizeApiError(error).message,
      color: 'error'
    })
  } finally {
    pendingActionKey.value = ''
  }
}

function certificateHref(application: AdminApplicationRecord) {
  return buildEventCertificatePath(props.eventSlug, application.userId)
}

function canViewCertificate(application: AdminApplicationRecord) {
  return isApplicationCheckedIn(application)
    && !application.certificateHiddenAt
    && !application.certificateRevokedAt
}

function canSendCertificateEmail(application: AdminApplicationRecord) {
  return canViewCertificate(application)
    && !application.certificateEmailQueuedAt
    && !application.certificateEmailSentAt
    && Boolean(application.user?.email?.trim())
}

function getCheckInActionKey(application: AdminApplicationRecord, status: ApplicationCheckInOverrideStatus) {
  return `${application.id}:check-in:${status}`
}

function isCheckInActionPending(application: AdminApplicationRecord, status: ApplicationCheckInOverrideStatus) {
  return pendingActionKey.value === getCheckInActionKey(application, status)
}

function isCheckInActionDisabled(application: AdminApplicationRecord, status: ApplicationCheckInOverrideStatus) {
  return pendingActionKey.value.length > 0 && !isCheckInActionPending(application, status)
}

function getCertificateRevocationActionKey(application: AdminApplicationRecord, revoked: boolean) {
  return `${application.id}:certificate:${revoked ? 'revoke' : 'restore'}`
}

function isCertificateRevocationActionPending(application: AdminApplicationRecord, revoked: boolean) {
  return pendingActionKey.value === getCertificateRevocationActionKey(application, revoked)
}

function isCertificateRevocationActionDisabled(application: AdminApplicationRecord, revoked: boolean) {
  return pendingActionKey.value.length > 0 && !isCertificateRevocationActionPending(application, revoked)
}

function getParticipantIdentityLabel(application: AdminApplicationRecord) {
  if (application.user?.displayName && application.user?.email && application.user.displayName !== application.user.email) {
    return `${application.user.displayName} - ${application.user.email}`
  }

  return application.user?.displayName ?? application.user?.email ?? application.userId
}

function getParticipantAvatarAlt(application: AdminApplicationRecord) {
  return application.user?.displayName ?? application.user?.email ?? application.userId
}

function getParticipantProfileIconHref(application: AdminApplicationRecord) {
  return buildProfileIconHref(
    application.userId,
    application.user?.profileIconRevision,
    eventId.value
  )
}

function formatCheckedInTimestamp(application: AdminApplicationRecord) {
  return application.checkedInAt
    ? `Checked in ${formatTimestamp(application.checkedInAt, 'recently')}`
    : null
}
</script>

<template>
  <AppCard class="rounded-xl !border !border-black/10 !bg-white/72 !shadow-[0_20px_40px_-24px_rgba(15,23,42,0.4)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#101010]/60">
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-highlighted">
          Certificates
        </h2>
        <p class="text-sm text-muted">
          Confirm who actually joined this event. Luma check-ins are the default, your decisions override them, and joined participants can generate certificates unless generation is disabled or revoked.
        </p>
      </div>
    </template>

    <AppAlert
      v-if="props.isLoading && !props.page"
      color="neutral"
      variant="soft"
      title="Loading participants"
      description="Participant records are still loading."
    />

    <AppAlert
      v-else-if="props.loadErrorMessage"
      color="error"
      variant="soft"
      title="Participants could not be loaded"
      :description="props.loadErrorMessage"
    />

    <template v-else>
      <section class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 flex flex-col gap-4 rounded-xl p-2">
        <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <AppFilterButton
              v-for="filter in attendanceFilterTabs"
              :key="filter.id"
              :pressed="activeAttendanceFilter === filter.id"
              :count="filter.count"
              :data-testid="`certificates-filter-${filter.id}`"
              @click="activeAttendanceFilter = filter.id"
            >
              {{ filter.label }}
            </AppFilterButton>
          </div>

          <div class="flex shrink-0 flex-col gap-2 sm:items-end">
            <AppButton
              color="neutral"
              variant="solid"
              icon="i-lucide-mail"
              class="justify-center rounded-lg"
              :loading="isCertificateEmailActionPending"
              :disabled="isCertificateEmailActionDisabled"
              data-testid="certificates-send-emails"
              @click="sendCertificateEmails"
            >
              Send certificate emails
            </AppButton>
            <div class="flex flex-wrap gap-2 text-xs text-muted sm:justify-end">
              <span class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]">
                {{ certificateEmailReadyCount }} ready to send
              </span>
              <span class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]">
                {{ certificateEmailSentCount }} already sent
              </span>
            </div>
          </div>
        </div>

        <div class="px-2 pb-2">
          <label
            for="certificates-search"
            class="sr-only"
          >
            Search participants
          </label>
          <AppInput
            id="certificates-search"
            v-model="searchTerm"
            type="search"
            name="certificates-search"
            autocomplete="off"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            placeholder="Search name or email"
            data-testid="certificates-search"
          />
          <p class="mt-2 text-[13px] text-neutral-500 dark:text-[#8C8C8C]">
            {{ checkedInCount }} of {{ approvedApplications.length }} checked in
          </p>
        </div>
      </section>

      <AppAlert
        v-if="visibleApplications.length === 0"
        class="mt-5"
        color="neutral"
        variant="soft"
        :title="approvedApplications.length === 0 ? 'No approved participants yet' : 'No participants match this view'"
        :description="approvedApplications.length === 0 ? 'Approved participants will appear here before certificates can be issued.' : 'Try a different attendance filter or search.'"
        data-testid="certificates-empty-state"
      />

      <div
        v-else
        class="mt-5 grid gap-5"
      >
        <section
          v-for="application in visibleApplications"
          :key="application.id"
          class="!border !border-black/8 !bg-white/78 !shadow-[0_12px_32px_-28px_rgba(15,23,42,0.5)] !backdrop-blur-xl dark:!border-white/[0.10] dark:!bg-[#151515]/64 overflow-hidden rounded-xl"
          :data-testid="`certificates-row-${application.userId}`"
        >
          <article class="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start xl:items-center">
            <div class="min-w-0 space-y-3">
              <div class="flex min-w-0 items-start gap-3">
                <AppAvatar
                  size="lg"
                  :src="getParticipantProfileIconHref(application)"
                  :alt="getParticipantAvatarAlt(application)"
                  class="shrink-0"
                />

                <div class="min-w-0 space-y-1">
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Participant
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-lg font-semibold text-highlighted">
                      {{ getParticipantIdentityLabel(application) }}
                    </h4>
                    <AppBadge
                      :color="getApplicationAttendanceStatusColor(application)"
                      variant="soft"
                    >
                      {{ formatApplicationAttendanceStatus(application) }}
                    </AppBadge>
                    <AppBadge
                      v-if="application.certificateHiddenAt"
                      color="neutral"
                      variant="outline"
                    >
                      Certificate generation disabled
                    </AppBadge>
                    <AppBadge
                      v-if="application.certificateRevokedAt"
                      color="error"
                      variant="soft"
                    >
                      Certificate revoked
                    </AppBadge>
                    <span
                      v-if="formatCheckedInTimestamp(application)"
                      class="rounded-full border border-black/10 px-3 py-1 text-xs text-highlighted dark:border-white/[0.12]"
                    >
                      {{ formatCheckedInTimestamp(application) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-2 text-xs text-muted">
                <span class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]">
                  {{ formatApplicationAttendanceSource(application) }}
                </span>
                <span
                  v-if="application.user?.email"
                  class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                >
                  Account: {{ application.user.email }}
                </span>
                <span
                  v-if="application.user?.lumaEmail"
                  class="rounded-full border border-black/10 px-3 py-1 text-highlighted dark:border-white/[0.12]"
                >
                  Luma: {{ application.user.lumaEmail }}
                </span>
              </div>
            </div>

            <div class="grid gap-2 self-center xl:pl-2">
              <AppButton
                v-for="decision in checkInDecisions"
                :key="decision.status"
                :color="application.checkInOverrideStatus === decision.status ? decision.color : 'neutral'"
                :variant="application.checkInOverrideStatus === decision.status ? 'soft' : 'outline'"
                :label="decision.label"
                :disabled="isCheckInActionDisabled(application, decision.status)"
                :aria-pressed="application.checkInOverrideStatus === decision.status"
                :data-testid="`certificates-mark-${decision.status.replace('_', '-')}-${application.userId}`"
                class="w-full justify-between px-3"
                @click="overrideCheckIn(application, decision.status)"
              >
                <template #trailing>
                  <AppIcon
                    v-if="isCheckInActionPending(application, decision.status)"
                    name="i-lucide-loader-circle"
                    class="animate-spin"
                  />
                  <AppIcon
                    v-else
                    :name="decision.icon"
                  />
                </template>
              </AppButton>
              <AppButton
                v-if="canViewCertificate(application)"
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-arrow-up-right"
                :to="certificateHref(application)"
                class="w-full justify-between rounded-xl"
                :data-testid="`certificates-view-${application.userId}`"
              >
                Certificate
              </AppButton>
              <AppButton
                v-if="canViewCertificate(application)"
                color="error"
                variant="outline"
                icon="i-lucide-ban"
                class="w-full justify-between rounded-xl"
                :loading="isCertificateRevocationActionPending(application, true)"
                :disabled="isCertificateRevocationActionDisabled(application, true)"
                :data-testid="`certificates-revoke-${application.userId}`"
                @click="setCertificateRevoked(application, true)"
              >
                Revoke certificate
              </AppButton>
              <AppButton
                v-else-if="application.certificateRevokedAt"
                color="neutral"
                variant="outline"
                icon="i-lucide-rotate-ccw"
                class="w-full justify-between rounded-xl"
                :loading="isCertificateRevocationActionPending(application, false)"
                :disabled="isCertificateRevocationActionDisabled(application, false)"
                :data-testid="`certificates-restore-${application.userId}`"
                @click="setCertificateRevoked(application, false)"
              >
                Restore certificate
              </AppButton>
            </div>
          </article>
        </section>
      </div>
    </template>
  </AppCard>
</template>
