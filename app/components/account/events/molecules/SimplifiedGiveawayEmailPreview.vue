<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui'
import type { AccountEventSimplifiedClaimingStatus } from '#shared/domains/events/account-event-settings-page'

defineProps<{ offers: AccountEventSimplifiedClaimingStatus['offers'], eventName: string }>()
</script>

<template>
  <DialogRoot>
    <DialogTrigger as-child>
      <AppButton
        type="button"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="offers.length === 0"
      >
        Preview email
      </AppButton>
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent class="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-[#161616]">
        <div class="flex items-start justify-between gap-4">
          <DialogTitle class="text-lg font-semibold">
            Email preview
          </DialogTitle>
          <DialogClose as-child>
            <AppButton
              type="button"
              color="neutral"
              variant="ghost"
              aria-label="Close email preview"
              icon="i-lucide-x"
            />
          </DialogClose>
        </div>
        <DialogDescription class="mt-1 text-sm text-muted">
          Sample values. Each participant receives their assigned credits at their account email.
        </DialogDescription>
        <p class="my-5 border-y border-black/10 py-3 font-medium dark:border-white/10">
          Your credits for {{ eventName }}
        </p>
        <p class="mb-3">
          Hi Alex,
        </p>
        <p>Thanks for joining {{ eventName }}. Here are your credits.</p>
        <div
          v-for="offer in offers"
          :key="offer.id"
          class="space-y-2 border-b border-black/10 py-5 dark:border-white/10"
        >
          <h3 class="font-semibold">
            {{ offer.name }}
          </h3>
          <span
            v-if="offer.linkCount"
            class="block text-sm underline"
          >Claim {{ offer.name }}</span>
          <code
            v-if="offer.codeCount"
            class="block select-text text-sm"
          >DEMO-ABCD-1234</code>
          <p
            v-if="offer.linkCount && offer.codeCount"
            class="text-xs text-muted"
          >
            Each participant receives one link or code.
          </p>
          <p class="whitespace-pre-wrap text-sm">
            {{ offer.description }}
          </p>
        </div>
        <p class="mt-5 text-sm">
          Keep this email to access your personal links and codes.
        </p>
        <p class="mt-3 text-sm">
          Codex Community Events
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
