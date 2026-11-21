<script setup lang="ts">
import { normalizeApiError } from '~/lib/api'
import type { McpAccessToken } from '~/domains/accounts/mcp-tokens'
import { copyMcpCredential, createAccountMcpToken, listAllActiveAccountMcpTokens, revokeAccountMcpToken } from '~/domains/accounts/mcp-tokens'
import { useApiClient } from '~/composables/useApiClient'
import { useApiData } from '~/composables/useApiData'

const name = ref('')
const credential = ref('')
const createdTokenName = ref('')
const pending = ref(false)
const actionErrorMessage = shallowRef('')
const copied = ref(false)
const serverUrlCopied = ref(false)
const revokingId = ref<string | null>(null)
const apiFetch = useApiClient()
const serverUrl = new URL('/mcp', useRequestURL()).toString()
const { data: tokens, error: loadError, refresh } = useApiData(
  'account-mcp-tokens',
  ({ apiFetch, signal }) => listAllActiveAccountMcpTokens(apiFetch, signal),
  { server: false, default: () => [] }
)
const errorMessage = computed(() => actionErrorMessage.value
  || (loadError.value ? normalizeApiError(loadError.value).message : ''))

async function createToken() {
  pending.value = true
  actionErrorMessage.value = ''
  copied.value = false
  credential.value = ''

  try {
    const created = await createAccountMcpToken(apiFetch, name.value)
    credential.value = created.credential
    createdTokenName.value = created.token.name
    name.value = ''
    await refresh()
  } catch (error) {
    actionErrorMessage.value = normalizeApiError(error).message
  } finally {
    pending.value = false
  }
}

async function copyServerUrl() {
  if (!import.meta.client || !window.isSecureContext || !navigator.clipboard) return
  await copyMcpCredential(navigator.clipboard, serverUrl)
  serverUrlCopied.value = true
}

function finishTokenCreation() {
  credential.value = ''
  createdTokenName.value = ''
  copied.value = false
}

async function copyCredential() {
  if (!credential.value || !import.meta.client || !window.isSecureContext || !navigator.clipboard) {
    return
  }
  await copyMcpCredential(navigator.clipboard, credential.value)
  copied.value = true
}

async function revokeToken(token: McpAccessToken) {
  if (!window.confirm(`Revoke “${token.name}”? Clients using it will lose access immediately.`)) {
    return
  }

  revokingId.value = token.id
  actionErrorMessage.value = ''
  try {
    await revokeAccountMcpToken(apiFetch, token.id)
    await refresh()
  } catch (error) {
    actionErrorMessage.value = normalizeApiError(error).message
  } finally {
    revokingId.value = null
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: true
  }).format(new Date(value))
}
</script>

<template>
  <section class="space-y-5 border-t border-black/8 pt-8 dark:border-white/[0.08]">
    <h2 class="text-[20px] font-medium text-highlighted dark:text-white">
      MCP connections
    </h2>

    <AppAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />

    <AccountMcpTokenCreated
      v-if="credential"
      :token-name="createdTokenName"
      :credential="credential"
      :server-url="serverUrl"
      :copied="copied"
      @copy="copyCredential"
      @done="finishTokenCreation"
    />

    <template v-else>
      <AccountMcpOAuthConnection
        :server-url="serverUrl"
        :copied="serverUrlCopied"
        @copy="copyServerUrl"
      />

      <div class="border-t border-black/8 pt-5 dark:border-white/[0.08]">
        <h3 class="mb-4 text-base font-semibold text-highlighted">
          Manual access tokens
        </h3>
        <form
          class="flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="createToken"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <label
              class="text-sm font-medium text-highlighted"
              for="mcp-token-name"
            >
              Token name
            </label>
            <AppInput
              id="mcp-token-name"
              v-model="name"
              required
              maxlength="80"
              placeholder="My MCP client"
            />
          </div>
          <AppButton
            type="submit"
            color="neutral"
            variant="solid"
            label="Create token"
            :loading="pending"
          />
        </form>
      </div>

      <div class="divide-y divide-black/8 border-y border-black/8 dark:divide-white/[0.08] dark:border-white/[0.08]">
        <div
          v-for="token in tokens"
          :key="token.id"
          class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 space-y-1">
            <p class="truncate text-sm font-semibold text-highlighted">
              {{ token.name }}
            </p>
            <p class="font-mono text-xs text-muted">
              {{ token.displayPrefix }}…
            </p>
            <p class="text-xs text-muted">
              Expires {{ formatDate(token.expiresAt) }} · Last used {{ formatDate(token.lastUsedAt) }}
            </p>
          </div>
          <AppButton
            color="error"
            variant="outline"
            label="Revoke"
            :loading="revokingId === token.id"
            @click="revokeToken(token)"
          />
        </div>
        <p
          v-if="tokens.length === 0"
          class="py-6 text-sm text-muted"
        >
          No access tokens.
        </p>
      </div>
    </template>
  </section>
</template>
