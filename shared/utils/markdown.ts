import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

function stripLeadingMarkdownHeading(markdownSource: string) {
  return markdownSource.replace(/^\uFEFF?(?:[ \t]*\r?\n)*# [^\n]+\r?\n(?:[ \t]*\r?\n)*/, '')
}

export function renderMarkdown(
  markdownSource: string,
  options?: {
    stripLeadingHeading?: boolean
  }
) {
  const normalizedSource = options?.stripLeadingHeading
    ? stripLeadingMarkdownHeading(markdownSource)
    : markdownSource

  return markdown.render(normalizedSource)
}
