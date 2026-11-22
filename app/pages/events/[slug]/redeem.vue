<script setup lang="ts">
import type { ApiDataResponse } from '~/lib/api'

import { normalizeApiError } from '~/lib/api'
import { useApiClient } from '~/composables/useApiClient'
import { useApiResponse } from '~/composables/useApiData'

type SimplifiedClaimState = {
  status: 'claimed'
  eventName: string
  redirectUrl: string | null
  claimedAt: string | null
} | {
  status: 'ready'
  eventName: string
  lumaEmail: string | null
} | {
  status: 'unavailable'
  eventName: string
} | {
  status: 'closed'
  eventName: string
} | {
  status: 'sold_out'
  eventName: string
}

definePageMeta({
  middleware: ['require-auth'],
  layout: 'event-detail'
})

useHead({
  title: 'Event redemption',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' }
  ]
})
if (import.meta.server) {
  useResponseHeader('Referrer-Policy').value = 'no-referrer'
}

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? '').trim())
const apiFetch = useApiClient()

if (!slug.value) {
  throw createError({ statusCode: 404, statusMessage: 'Event not found.' })
}

const { data: claimState, error, status } = await useApiResponse<SimplifiedClaimState>(
  () => `simplified-claim:${slug.value}`,
  () => `/api/events/slug/${slug.value}/simplified-claim`
)
const lumaEmail = shallowRef('')
const isInteractive = shallowRef(false)
const isRedeeming = shallowRef(false)
const redeemError = shallowRef('')
const showEmailForm = computed(() => claimState.value?.status === 'ready')

watch(claimState, (nextState) => {
  if (nextState?.status === 'ready' && !lumaEmail.value) {
    lumaEmail.value = nextState.lumaEmail?.trim() ?? ''
  }
}, { immediate: true })

const couponUrl = computed(() => claimState.value?.status === 'claimed' ? claimState.value.redirectUrl : null)
if (import.meta.server && couponUrl.value) {
  await navigateTo(couponUrl.value, { external: true, replace: true })
}

onMounted(() => {
  isInteractive.value = true
  watch(couponUrl, (url) => {
    if (url) window.location.replace(url)
  }, { immediate: true })
})

async function redeem() {
  const email = lumaEmail.value.trim()
  const currentClaim = claimState.value
  if (!email || isRedeeming.value || currentClaim?.status !== 'ready') {
    return
  }

  isRedeeming.value = true
  redeemError.value = ''
  try {
    const response = await apiFetch<ApiDataResponse<{
      status: 'claimed'
      redirectUrl: string | null
      claimedAt: string | null
    }>>(`/api/events/slug/${slug.value}/simplified-claim/actions/redeem`, {
      method: 'POST',
      body: { lumaEmail: email }
    })
    claimState.value = { ...response.data, eventName: currentClaim.eventName }
  } catch (caught) {
    redeemError.value = normalizeApiError(caught).message
  } finally {
    isRedeeming.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-5 py-12 sm:px-8">
    <AppCard class="w-full">
      <template #header>
        <div class="space-y-1">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Event attendee
          </p>
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ claimState?.eventName ?? 'Redeem your event credit' }}
          </h1>
        </div>
      </template>

      <div class="grid gap-5">
        <AppAlert
          v-if="error"
          color="error"
          variant="soft"
          title="Redemption unavailable"
          :description="normalizeApiError(error).message"
        />
        <div
          v-else-if="status === 'idle' || status === 'pending' || isRedeeming"
          class="grid justify-items-center gap-3 py-8 text-center"
        >
          <AppIcon
            name="i-lucide-loader-circle"
            class="size-7 animate-spin text-muted"
          />
          <p class="text-sm text-muted">
            Checking your attendee details…
          </p>
        </div>
        <AppAlert
          v-else-if="claimState?.status === 'sold_out'"
          color="warning"
          variant="soft"
          title="All credits have been claimed"
          description="There are no credits left for this event."
        />
        <AppAlert
          v-else-if="claimState?.status === 'closed'"
          color="warning"
          variant="soft"
          title="Redemption has closed"
          description="Credits can no longer be claimed for this event."
        />
        <AppAlert
          v-else-if="claimState?.status === 'unavailable'"
          color="warning"
          variant="soft"
          title="Redemption unavailable"
          description="This redemption page is not available right now."
        />
        <AppAlert
          v-else-if="claimState?.status === 'claimed'"
          color="success"
          title="Your credits are claimed"
          description="Check your account email for your personal links and codes."
        />
        <form
          v-else-if="showEmailForm"
          class="grid gap-4"
          @submit.prevent="redeem"
        >
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              Confirm your Luma email
            </h2>
            <p class="text-sm text-muted">
              Use the email address you used to join this Meetup.
            </p>
          </div>
          <AppFormField
            label="Luma email"
            name="luma-email"
          >
            <AppInput
              id="luma-email"
              v-model="lumaEmail"
              type="email"
              autocomplete="email"
              required
              :disabled="!isInteractive || isRedeeming"
            />
          </AppFormField>
          <AppAlert
            v-if="redeemError"
            color="error"
            variant="soft"
            title="Could not continue"
            :description="redeemError"
          />
          <div class="flex justify-end">
            <AppButton
              type="submit"
              color="primary"
              :loading="isRedeeming"
              :disabled="!isInteractive"
            >
              Claim credits
            </AppButton>
          </div>
        </form>
      </div>
    </AppCard>
  </main>
</template>
