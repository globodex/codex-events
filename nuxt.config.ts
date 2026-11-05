import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { certificateHarfBuzzPlugin } from './tools/build/certificate-harfbuzz'
import { shouldUseLocalCodexAuth } from './tools/local-auth/mode'

const nuxtTemporaryDirectory = process.platform === 'win32'
  ? join(tmpdir(), 'codex-events-nuxt')
  : '/tmp/codex-events-nuxt'

mkdirSync(nuxtTemporaryDirectory, { recursive: true })
process.env.TMPDIR = nuxtTemporaryDirectory
process.env.TMP = nuxtTemporaryDirectory
process.env.TEMP = nuxtTemporaryDirectory

const localCodexAuth = shouldUseLocalCodexAuth(
  process.env.NODE_ENV !== 'production',
  process.env
)

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    ['@auth0/auth0-nuxt', {
      routes: {
        login: '/auth/sdk/login',
        logout: '/auth/sdk/logout'
      }
    }],
    '@nuxt/icon',
    'shadcn-nuxt'
  ],

  devtools: {
    enabled: process.env.NODE_ENV !== 'production'
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    firstPlatformAdminEmail: '',
    localCodexAuth,
    auth0: {
      domain: localCodexAuth ? 'local.invalid' : '',
      clientId: localCodexAuth ? 'local-client' : '',
      clientSecret: localCodexAuth ? 'local-client-secret' : '',
      managementDomain: '',
      managementClientId: '',
      managementClientSecret: '',
      sessionSecret: localCodexAuth ? 'local-session-secret' : '',
      appBaseUrl: 'http://localhost:3000',
      databaseConnectionName: '',
      accountLinkChallengeSecret: ''
    },
    outboundEmail: {
      binding: 'EMAIL',
      fromEmail: '',
      fromName: 'Codex Events',
      replyTo: ''
    },
    applicationReviewEmails: {
      queueBinding: 'APPLICATION_REVIEW_EMAIL_QUEUE',
      queueName: 'codex-events-dev-application-review-email-delivery',
      retryDelaySeconds: 120
    },
    talkProposalDecisionEmails: {
      queueBinding: 'TALK_PROPOSAL_DECISION_EMAIL_QUEUE',
      queueName: 'codex-events-dev-talk-proposal-decision-email-delivery',
      retryDelaySeconds: 120
    },
    eventOutcomeEmails: {
      queueBinding: 'EVENT_OUTCOME_EMAIL_QUEUE',
      queueName: 'codex-events-dev-event-outcome-email-delivery',
      retryDelaySeconds: 120
    },
    luma: {
      apiBaseUrl: 'https://public-api.luma.com',
      profileBaseUrl: 'https://luma.com',
      queueBinding: 'APPLICATION_LUMA_SYNC_QUEUE',
      queueName: 'codex-events-dev-application-luma-sync',
      retryDelaySeconds: 120
    },
    mediaCleanup: {
      queueBinding: 'MEDIA_CLEANUP_QUEUE',
      queueName: 'codex-events-dev-media-cleanup',
      retryDelaySeconds: 120
    },
    database: {
      binding: 'DB'
    },
    profileIcons: {
      binding: 'PROFILE_ICONS'
    },
    eventImages: {
      binding: 'EVENT_IMAGES'
    },
    mcp: {
      allowedHostnames: 'localhost',
      allowedOriginHostnames: 'localhost',
      resourceUrl: 'http://localhost:3000/mcp'
    }
  },
  alias: {
    '#ai-knowledge': fileURLToPath(new URL('./shared/domains/applications/ai-knowledge.ts', import.meta.url)),
    '#proof-of-execution-links': fileURLToPath(new URL('./shared/domains/applications/proof-of-execution-links.ts', import.meta.url))
  },

  routeRules: {
    '/account': { appLayout: 'profile', ssr: false },
    '/account/**': { appLayout: 'profile', ssr: false },
    '/admin/**': { appLayout: 'profile', ssr: false },
    '/prize-redemptions': { appLayout: 'profile', ssr: false },
    '/prize-redemptions/**': { appLayout: 'profile', ssr: false }
  },

  sourcemap: {
    client: process.env.NODE_ENV !== 'production',
    server: process.env.NODE_ENV !== 'production'
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    rollupConfig: {
      plugins: [certificateHarfBuzzPlugin()]
    },
    experimental: {
      wasm: true
    }
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'lucide-vue-next',
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        'vue-sonner',
        'reka-ui',
        '@vueuse/core',
        'vee-validate',
        '@vee-validate/zod',
        'zod',
        'markdown-it'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  shadcn: {
    prefix: '',
    componentDir: '~/components/ui'
  }
})
