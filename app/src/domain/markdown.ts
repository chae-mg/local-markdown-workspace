export type MarkdownScalar = string | number | boolean | null

export type MarkdownValue =
  MarkdownScalar | MarkdownValue[] | { [key: string]: MarkdownValue }

export type MarkdownFrontmatter = Record<string, MarkdownValue>

export type MarkdownLineEnding = '\n' | '\r\n'

export interface MarkdownSourceFormat {
  byteOrderMark: boolean
  closingLineEnding: '' | MarkdownLineEnding
  frontmatterSource: string | null
  lineEnding: MarkdownLineEnding
}

export interface ParsedMarkdownDocument {
  body: string
  format: MarkdownSourceFormat
  frontmatter: MarkdownFrontmatter | null
}

export type MarkdownFrontmatterPatch = Record<string, MarkdownValue | undefined>

export type MarkdownErrorCode =
  | 'invalid-frontmatter'
  | 'invalid-frontmatter-root'
  | 'unsupported-frontmatter-value'

export class MarkdownError extends Error {
  readonly code: MarkdownErrorCode

  constructor(
    code: MarkdownErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'MarkdownError'
    this.code = code
  }
}
