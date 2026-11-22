<script setup lang="ts">
import PublicLegalDocument from '~/components/public/legal/PublicLegalDocument.vue'

const { privacyPolicyDocument, status } = useCurrentPlatformDocuments()

useSeoMeta({
  title: 'Privacy Policy | Codex Events',
  description: 'Read how Codex Events handles personal data.'
})
</script>

<template>
  <PublicLegalDocument
    title="Privacy Policy"
    description="This policy explains how Codex Events processes personal data across account creation, event participation, judging, prize workflows, and support requests."
    document-name="Privacy Policy"
    missing-description="The platform operator has not published a current Privacy Policy for this deployment."
    :document="privacyPolicyDocument"
    :status="status"
  />
</template>
