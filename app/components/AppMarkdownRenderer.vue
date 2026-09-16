<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '~/lib/utils'
import { renderMarkdown } from '#shared/utils/markdown'

const props = withDefaults(defineProps<{
  source?: string | null
  stripLeadingHeading?: boolean
  normalizeEscapedNewlines?: boolean
  class?: HTMLAttributes['class']
}>(), {
  source: '',
  stripLeadingHeading: false,
  normalizeEscapedNewlines: false
})

const normalizedSource = computed(() => {
  const source = props.source?.trim() ?? ''

  return props.normalizeEscapedNewlines
    ? source.replaceAll('\\n', '\n')
    : source
})

const renderedHtml = computed(() => normalizedSource.value
  ? renderMarkdown(normalizedSource.value, {
      stripLeadingHeading: props.stripLeadingHeading
    })
  : ''
)
const rootClass = computed(() => cn('app-markdown-renderer', props.class))
</script>

<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-if="renderedHtml"
    :class="rootClass"
    v-html="renderedHtml"
  />
  <!-- eslint-enable vue/no-v-html -->
</template>

<style scoped>
.app-markdown-renderer {
  font-size: 15px;
  line-height: 1.75rem;
  color: var(--color-neutral-700);
}

.dark .app-markdown-renderer {
  color: #d3d6df;
}

.app-markdown-renderer :deep(> * + *) {
  margin-top: 0.85rem;
}

.app-markdown-renderer :deep(:is(h1, h2, h3, h4)) {
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-highlighted);
}

.dark .app-markdown-renderer :deep(:is(h1, h2, h3, h4)) {
  color: #ffffff;
}

.app-markdown-renderer :deep(h1) {
  font-size: 1.3rem;
  line-height: 1.25;
}

.app-markdown-renderer :deep(h2) {
  margin-top: 1.5rem;
  font-size: 1.08rem;
  line-height: 1.25;
}

.app-markdown-renderer :deep(h3) {
  margin-top: 1.25rem;
  font-size: 1rem;
  line-height: 1.25;
}

.app-markdown-renderer :deep(:is(ul, ol)) {
  padding-left: 1.5rem;
}

.app-markdown-renderer :deep(:is(ul, ol) > * + *) {
  margin-top: 0.5rem;
}

.app-markdown-renderer :deep(ul) {
  list-style: disc;
}

.app-markdown-renderer :deep(ol) {
  list-style: decimal;
}

.app-markdown-renderer :deep(a) {
  text-decoration-line: underline;
  text-decoration-color: rgb(153 160 173 / 0.7);
  text-underline-offset: 2px;
  transition: color 150ms ease, text-decoration-color 150ms ease;
}

.app-markdown-renderer :deep(a:hover) {
  color: var(--text-highlighted);
}

.dark .app-markdown-renderer :deep(a) {
  text-decoration-color: rgb(255 255 255 / 0.45);
}

.dark .app-markdown-renderer :deep(a:hover) {
  color: #ffffff;
}

.app-markdown-renderer :deep(code) {
  border-radius: 0.25rem;
  background: rgb(0 0 0 / 0.06);
  padding: 0.125rem 0.25rem;
  font-size: 0.875em;
  color: var(--text-highlighted);
}

.dark .app-markdown-renderer :deep(code) {
  background: rgb(255 255 255 / 0.08);
  color: #ffffff;
}

.app-markdown-renderer :deep(blockquote) {
  border-left: 2px solid rgb(0 0 0 / 0.2);
  padding-left: 1rem;
  font-style: italic;
  color: var(--color-neutral-600);
}

.dark .app-markdown-renderer :deep(blockquote) {
  border-left-color: rgb(255 255 255 / 0.25);
  color: #b3b7c2;
}
</style>
