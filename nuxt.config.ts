import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { certificateHarfBuzzPlugin } from './tools/build/certificate-harfbuzz.ts'
import { shouldUseLocalCodexAuth } from './tools/local-auth/mode.ts'

const nuxtTemporaryDirectory = process.platform === 'win32'
  ? join(tmpdir(), 'codex-events-nuxt')
  : '/tmp/codex-events-nuxt'

mkdirSync(nuxtTemporaryDirectory, { recursive: true })
process.env.TMPDIR = nuxtTemporaryDirectory
process.env.TMP = nuxtTemporaryDirectory
process.env.TEMP = nuxtTemporaryDirectory

const storybook = process.env.CODEX_EVENTS_STORYBOOK
const localAuthFixtures = !storybook && process.env.NODE_ENV === 'development' && process.env.CODEX_EVENTS_BDD === '1'
const localCodexAuth = localAuthFixtures || (!storybook && shouldUseLocalCodexAuth(
  process.env.NODE_ENV !== 'production',
  process.env
))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    ['@auth0/auth0-nuxt', {
      mountRoutes: !localAuthFixtures && !storybook,
      hydrateUser: false,
      ssrUser: false,
      routes: {
        login: '/auth/sdk/login',
        logout: '/auth/sdk/logout'
      }
    }],
    '@nuxt/icon',
    'shadcn-nuxt'
  ],

  devtools: {
    enabled: !storybook && process.env.NODE_ENV !== 'production'
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    firstPlatformAdminEmail: '',
    localCodexAuth,
    localAuthFixtures,
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
  buildDir: storybook
    ? `node_modules/.cache/codex-events-storybook-${storybook === 'dev' ? 'dev' : 'build'}`
    : localAuthFixtures ? join(process.env.CODEX_EVENTS_BDD_RUN_DIR!, 'nuxt') : undefined,
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
    ignore: localAuthFixtures ? ['routes/auth/link/**'] : [],
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
        '@internationalized/date',
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
        'markdown-it',
        'qrcode-generator',
        'sortablejs',
        'highlight.js/lib/common',
        'md-editor-v3',
        'prettier/plugins/markdown',
        'prettier/standalone',
        'screenfull',
        'photoswipe',
        'photoswipe/lightbox'
      ]
    }
  },

  typescript: {
    appTsConfig: {
      include: ['../stories/**/*', '../.storybook/preview.ts']
    },
    nodeTsConfig: {
      include: ['../.storybook/main.ts']
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

  icon: storybook
    ? {
        provider: 'none',
        clientBundle: {
          scan: { globInclude: ['app/**/*.{vue,ts}', 'stories/**/*.{vue,ts}'] }
        }
      }
    : undefined,

  shadcn: {
    prefix: '',
    componentDir: '~/components/ui'
  }
})
