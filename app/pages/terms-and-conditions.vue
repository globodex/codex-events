<script setup lang="ts">
import PublicLegalDocument from '~/components/public/legal/PublicLegalDocument.vue'

const { platformTermsDocument, status } = useCurrentPlatformDocuments()

useSeoMeta({
  title: 'Terms and Conditions | Codex Events',
  description: 'Read the rules for using Codex Events.'
})
</script>

<template>
  <PublicLegalDocument
    title="Terms and Conditions"
    description="These terms define the baseline rules for using the Codex Events platform and explain how platform-level rules interact with event-specific documents."
    document-name="Platform Terms"
    missing-description="The platform operator has not published current Platform Terms for this deployment."
    :document="platformTermsDocument"
    :status="status"
  />
</template>
