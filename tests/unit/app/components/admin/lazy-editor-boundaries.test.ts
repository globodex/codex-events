import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const editorFieldSource = readFileSync(
  new URL('../../../../../app/components/admin/AdminMarkdownEditorField.vue', import.meta.url),
  'utf8'
)
const editorClientSource = readFileSync(
  new URL('../../../../../app/components/admin/AdminMarkdownEditorClient.client.vue', import.meta.url),
  'utf8'
)
const settingsPanelSource = readFileSync(
  new URL('../../../../../app/components/account/events/AccountEventAdminSettingsPanel.vue', import.meta.url),
  'utf8'
)
const builderPageSource = readFileSync(
  new URL('../../../../../app/pages/admin/events/builder/[eventId].vue', import.meta.url),
  'utf8'
)

describe('local editor and sortable loading boundaries', () => {
  test('keeps the markdown editor local and behind ClientOnly/lazy loading', () => {
    expect(editorFieldSource).toContain('<ClientOnly>')
    expect(editorFieldSource).toContain('<LazyAdminMarkdownEditorClient')
    expect(editorClientSource).toContain('from \'md-editor-v3\'')
    expect(editorClientSource).toContain('\'md-editor-v3/lib/style.css\'')
    expect(editorClientSource).toContain('from \'highlight.js/lib/common\'')
    expect(editorClientSource).toContain('\'highlight.js/styles/github.css\'')
    expect(editorClientSource).toContain('\'highlight.js/styles/github-dark.css\'')
    expect(editorClientSource).toContain('from \'prettier/plugins/markdown\'')
    expect(editorClientSource).toContain('from \'prettier/standalone\'')
    expect(editorClientSource).toContain('from \'screenfull\'')
    expect(editorClientSource).toContain('instance: hljs')
    expect(editorClientSource).toContain('parserMarkdownInstance: parserMarkdown')
    expect(editorClientSource).toContain('prettierInstance: prettier')
    expect(editorClientSource).toContain('instance: screenfull')
    expect(editorClientSource).not.toContain('standaloneJs:')
    expect(editorClientSource).not.toContain('parserMarkdownJs:')
    expect(editorFieldSource).not.toContain('unpkg')
    expect(editorClientSource).not.toContain('unpkg')
  })

  test('loads sortable only through the local interaction boundary', () => {
    expect(settingsPanelSource).toContain('await import(\'sortablejs\')')
    expect(settingsPanelSource).toContain('onBeforeUnmount')
    expect(settingsPanelSource).toContain('page?: AccountEventSettingsPage | null')
    expect(settingsPanelSource).toContain('emit(\'updated\')')
    expect(settingsPanelSource).not.toContain('settingsRequest.abort()')
    expect(settingsPanelSource).not.toContain('useAccountEventPageRequest')
    expect(settingsPanelSource).not.toContain('useAdminEventSettingsWorkspace')
    expect(settingsPanelSource).not.toContain('workspace.refreshWorkspace')
    expect(builderPageSource).toContain('useAccountEventPageRequest<AccountEventSettingsPage>')
    expect(builderPageSource).not.toContain('useApiResponse')
    expect(builderPageSource).not.toContain('/terms/current')
    expect(builderPageSource).not.toContain('settingsRequest.abort()')
    expect(settingsPanelSource).not.toContain('unpkg')
  })
})
