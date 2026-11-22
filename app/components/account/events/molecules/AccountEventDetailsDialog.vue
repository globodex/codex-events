<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger
} from 'reka-ui'

import AppButton from '~/components/AppButton.vue'

// The "Details" button of a card on the Agenda tab, and the popup it opens.
// The button sits in the bottom right corner of the card. So the card needs `relative`, and it
// keeps that corner free.
defineProps<{
  title: string
  /** One line under the title, for example the time and the room. */
  summary?: string
}>()
</script>

<template>
  <DialogRoot>
    <DialogTrigger as-child>
      <AppButton
        label="Details"
        variant="soft"
        size="xs"
        class="absolute right-2 bottom-2 h-6"
      />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <!-- A popup without a summary has no describing line, and says so to screen readers. -->
      <DialogContent
        :aria-describedby="summary ? undefined : ''"
        class="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2
          overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground shadow-lg outline-none
          data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <DialogTitle class="break-words text-base font-semibold text-highlighted">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              v-if="summary"
              class="mt-1 text-sm text-muted"
            >
              {{ summary }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <AppButton
              icon="i-lucide-x"
              aria-label="Close"
              color="neutral"
              variant="ghost"
              size="xs"
              class="shrink-0 px-1.5"
            />
          </DialogClose>
        </div>
        <div class="mt-4">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
