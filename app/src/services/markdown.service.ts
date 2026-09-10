import {
  parseDocument as parseYamlDocument,
  stringify as stringifyYaml,
} from 'yaml'

import {
  MarkdownError,
  type MarkdownFrontmatter,
  type MarkdownFrontmatterPatch,
  type MarkdownLineEnding,
  type MarkdownValue,
  type ParsedMarkdownDocument,
} from '@/domain/markdown'

export interface MarkdownApplicationService {
  parseDocument(source: string): ParsedMarkdownDocument
  parseFrontmatter(source: string): MarkdownFrontmatter
  serializeDocument(document: ParsedMarkdownDocument): string
  updateFrontmatter(source: string, patch: MarkdownFrontmatterPatch): string
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertMarkdownValue(
  value: unknown,
  path: string,
  ancestors = new WeakSet<object>(),
): asserts value is MarkdownValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return
    }

    throw new MarkdownError(
      'unsupported-frontmatter-value',
      `${path}에는 유한한 숫자만 사용할 수 있습니다.`,
    )
  }

  if (typeof value !== 'object') {
    throw new MarkdownError(
      'unsupported-frontmatter-value',
      `${path}에 지원하지 않는 Frontmatter 값이 있습니다.`,
    )
  }

  if (ancestors.has(value)) {
    throw new MarkdownError(
      'unsupported-frontmatter-value',
      `${path}에 순환 참조를 사용할 수 없습니다.`,
    )
  }

  ancestors.add(value)

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertMarkdownValue(item, `${path}[${index}]`, ancestors),
    )
    ancestors.delete(value)
    return
  }

  if (!isPlainRecord(value)) {
    throw new MarkdownError(
      'unsupported-frontmatter-value',
      `${path}에 지원하지 않는 객체 값이 있습니다.`,
    )
  }

  for (const [key, item] of Object.entries(value)) {
    assertMarkdownValue(item, `${path}.${key}`, ancestors)
  }
  ancestors.delete(value)
}

function detectLineEnding(source: string): MarkdownLineEnding {
  const firstLineFeed = source.indexOf('\n')
  return firstLineFeed > 0 && source[firstLineFeed - 1] === '\r' ? '\r\n' : '\n'
}

function comparableFrontmatter(value: MarkdownFrontmatter) {
  return JSON.stringify(value)
}

export class MarkdownService implements MarkdownApplicationService {
  parseDocument(source: string): ParsedMarkdownDocument {
    const byteOrderMark = source.startsWith('\uFEFF')
    const content = byteOrderMark ? source.slice(1) : source
    const lineEnding = detectLineEnding(content)
    const firstLineFeed = content.indexOf('\n')

    if (firstLineFeed < 0) {
      return {
        body: content,
        format: {
          byteOrderMark,
          closingLineEnding: '',
          frontmatterSource: null,
          lineEnding,
        },
        frontmatter: null,
      }
    }

    const firstLine = content.slice(0, firstLineFeed).replace(/\r$/, '')

    if (firstLine !== '---') {
      return {
        body: content,
        format: {
          byteOrderMark,
          closingLineEnding: '',
          frontmatterSource: null,
          lineEnding,
        },
        frontmatter: null,
      }
    }

    const frontmatterStart = firstLineFeed + 1
    let lineStart = frontmatterStart

    while (lineStart <= content.length) {
      const nextLineFeed = content.indexOf('\n', lineStart)
      const lineEnd = nextLineFeed === -1 ? content.length : nextLineFeed
      const contentEnd =
        lineEnd > lineStart && content[lineEnd - 1] === '\r'
          ? lineEnd - 1
          : lineEnd
      const line = content.slice(lineStart, contentEnd)

      if (line === '---') {
        const frontmatterSource = content.slice(frontmatterStart, lineStart)
        const closingLineEnding =
          nextLineFeed === -1
            ? ''
            : (content.slice(
                contentEnd,
                nextLineFeed + 1,
              ) as MarkdownLineEnding)
        const bodyStart =
          nextLineFeed === -1 ? content.length : nextLineFeed + 1

        return {
          body: content.slice(bodyStart),
          format: {
            byteOrderMark,
            closingLineEnding,
            frontmatterSource,
            lineEnding,
          },
          frontmatter: this.parseFrontmatter(frontmatterSource),
        }
      }

      if (nextLineFeed === -1) {
        break
      }
      lineStart = nextLineFeed + 1
    }

    return {
      body: content,
      format: {
        byteOrderMark,
        closingLineEnding: '',
        frontmatterSource: null,
        lineEnding,
      },
      frontmatter: null,
    }
  }

  parseFrontmatter(source: string) {
    const document = parseYamlDocument(source, {
      prettyErrors: true,
      strict: true,
      stringKeys: true,
      uniqueKeys: true,
      version: '1.2',
    })

    if (document.errors.length > 0) {
      const [error] = document.errors
      throw new MarkdownError(
        'invalid-frontmatter',
        `Frontmatter YAML이 올바르지 않습니다: ${error.message}`,
        { cause: error },
      )
    }

    let value: unknown
    try {
      value = document.toJS({ maxAliasCount: 100 })
    } catch (error) {
      throw new MarkdownError(
        'invalid-frontmatter',
        'Frontmatter YAML을 안전하게 변환할 수 없습니다.',
        { cause: error },
      )
    }

    if (value === null) {
      return {}
    }

    if (!isPlainRecord(value)) {
      throw new MarkdownError(
        'invalid-frontmatter-root',
        'Frontmatter 최상위 값은 Key-Value 객체여야 합니다.',
      )
    }

    assertMarkdownValue(value, 'frontmatter')
    return value
  }

  serializeDocument(document: ParsedMarkdownDocument) {
    const prefix = document.format.byteOrderMark ? '\uFEFF' : ''

    if (document.frontmatter === null) {
      return `${prefix}${document.body}`
    }

    assertMarkdownValue(document.frontmatter, 'frontmatter')
    const originalFrontmatter = document.format.frontmatterSource
    let frontmatterSource: string

    if (
      originalFrontmatter !== null &&
      comparableFrontmatter(this.parseFrontmatter(originalFrontmatter)) ===
        comparableFrontmatter(document.frontmatter)
    ) {
      frontmatterSource = originalFrontmatter
    } else {
      frontmatterSource = stringifyYaml(document.frontmatter, {
        aliasDuplicateObjects: false,
        lineWidth: 0,
        version: '1.2',
      }).replaceAll('\n', document.format.lineEnding)
    }

    const bodySeparator =
      originalFrontmatter === null
        ? document.body
          ? `${document.format.lineEnding}${document.format.lineEnding}`
          : ''
        : document.format.closingLineEnding

    return `${prefix}---${document.format.lineEnding}${frontmatterSource}---${bodySeparator}${document.body}`
  }

  updateFrontmatter(source: string, patch: MarkdownFrontmatterPatch) {
    const document = this.parseDocument(source)
    const frontmatter = Object.assign(
      Object.create(null) as MarkdownFrontmatter,
      document.frontmatter ?? {},
    )

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        delete frontmatter[key]
      } else {
        assertMarkdownValue(value, `frontmatter.${key}`)
        frontmatter[key] = value
      }
    }

    if (
      document.frontmatter === null &&
      Object.keys(frontmatter).length === 0
    ) {
      return source
    }

    return this.serializeDocument({ ...document, frontmatter })
  }
}

export const markdownService = new MarkdownService()
