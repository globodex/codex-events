import type { StorybookConfig } from '@storybook-vue/nuxt'

import { fileURLToPath } from 'node:url'

process.env.CODEX_EVENTS_STORYBOOK = process.env.NODE_ENV === 'production' ? 'build' : 'dev'

const config: StorybookConfig = {
  framework: {
    name: '@storybook-vue/nuxt',
    options: { docgen: 'vue-component-meta' }
  },
  stories: ['../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-docs'],
  staticDirs: ['../public'],
  viteFinal(config, { configType }) {
    if (configType === 'DEVELOPMENT') {
      // The Nuxt preset loads in production mode even when Vite serves previews.
      config.mode = 'development'
      config.define = { ...config.define, 'process.env.NODE_ENV': '"development"' }
    }

    config.envPrefix = 'STORYBOOK_'
    config.resolve ??= {}
    const aliases = config.resolve.alias ?? []
    const existingAliases = Array.isArray(aliases)
      ? aliases
      : Object.entries(aliases).map(([find, replacement]) => ({ find, replacement }))

    config.resolve.alias = [
      {
        find: /^(?:.*\/)?useApiClient(?:\.ts)?$/,
        replacement: fileURLToPath(new URL('./api-client.ts', import.meta.url))
      },
      ...existingAliases
    ]
    return config
  }
}

export default config
