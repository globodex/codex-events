import type { Preview } from '@storybook-vue/nuxt'

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    theme: {
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: ['light', 'dark']
      }
    }
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (story, { globals }) => {
      const theme = globals.theme === 'dark' ? 'dark' : 'light'
      const root = document.documentElement
      root.classList.toggle('dark', theme === 'dark')
      root.style.colorScheme = theme
      return story()
    }
  ],
  parameters: {
    backgrounds: { disable: true }
  }
}

export default preview
