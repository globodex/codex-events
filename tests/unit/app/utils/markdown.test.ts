import { describe, expect, test } from 'vitest'

import { renderMarkdown } from '../../../../shared/utils/markdown'

describe('markdown utils', () => {
  test('can strip the leading top-level heading before rendering', () => {
    const html = renderMarkdown('# Title\n\nBody copy', {
      stripLeadingHeading: true
    })

    expect(html).not.toContain('<h1>Title</h1>')
    expect(html).toContain('<p>Body copy</p>')
  })
})
