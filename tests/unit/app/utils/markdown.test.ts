import { describe, expect, test } from 'vitest'

import { renderMarkdown } from '../../../../shared/utils/markdown'

describe('markdown utils', () => {
  test('renders markdown without stripping headings by default', () => {
    expect(renderMarkdown('# Title\n\nBody copy')).toContain('<h1>Title</h1>')
  })

  test('renders markdown links using anchor tags', () => {
    expect(renderMarkdown('Redeem at [provider](https://redeem.example)')).toContain(
      '<a href="https://redeem.example">provider</a>'
    )
  })

  test('renders emphasis and lists for project-style markdown descriptions', () => {
    const html = renderMarkdown('**Highlights**\n\n- Fast setup\n- Live demo')

    expect(html).toContain('<strong>Highlights</strong>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Fast setup</li>')
    expect(html).toContain('<li>Live demo</li>')
  })

  test('can strip the leading top-level heading before rendering', () => {
    const html = renderMarkdown('# Title\n\nBody copy', {
      stripLeadingHeading: true
    })

    expect(html).not.toContain('<h1>Title</h1>')
    expect(html).toContain('<p>Body copy</p>')
  })
})
