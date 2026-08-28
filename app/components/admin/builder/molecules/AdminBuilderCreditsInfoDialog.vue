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
</script>

<template>
  <DialogRoot>
    <DialogTrigger
      aria-label="How simplified claiming works"
      title="How simplified claiming works"
      data-testid="event-builder-credits-info-trigger"
      class="inline-flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-black/5 hover:text-highlighted dark:hover:bg-white/[0.06]"
    >
      <AppIcon
        name="i-lucide-info"
        class="size-4"
      />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent
        data-testid="event-builder-credits-info-dialog"
        class="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.5)] outline-none dark:border-white/[0.12] dark:bg-[#161616] sm:p-7"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-base font-semibold text-highlighted">
              How simplified claiming works
            </DialogTitle>
            <DialogDescription class="mt-1 text-xs text-muted">
              From organizer setup to attendee reward.
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Close"
            class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-black/5 hover:text-highlighted dark:hover:bg-white/[0.06]"
          >
            <AppIcon
              name="i-lucide-x"
              class="size-4"
            />
          </DialogClose>
        </div>

        <div class="overflow-x-auto rounded-xl border border-black/8 bg-black dark:border-white/[0.08]">
          <img
            src="/event-builder-simplified-credits-flow.png"
            alt="Four steps for simplified credits claiming: choose and upload, add attendees, scan and confirm, then verify and redeem."
            class="w-full min-w-[46rem] max-w-none object-contain sm:min-w-0"
          >
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
