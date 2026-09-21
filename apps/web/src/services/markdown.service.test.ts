import { describe, expect, it } from 'vitest'

import {
  MarkdownError,
  type MarkdownFrontmatter,
  type ParsedMarkdownDocument,
} from '@/domain/markdown'
import { MarkdownService } from '@/services/markdown.service'

const service = new MarkdownService()

describe('MarkdownService', () => {
  it('keeps plain Markdown and an unclosed delimiter as body content', () => {
    const plainSource = '# 제목\n\n본문입니다.\n'
    const unclosedSource = '---\n수평선 다음의 본문'

    expect(service.parseDocument(plainSource)).toMatchObject({
      body: plainSource,
      frontmatter: null,
    })
    expect(service.serializeDocument(service.parseDocument(plainSource))).toBe(
      plainSource,
    )
    expect(service.parseDocument(unclosedSource)).toMatchObject({
      body: unclosedSource,
      frontmatter: null,
    })
  })

  it('parses Korean, arrays, booleans, numbers, dates, and multiline text', () => {
    const parsed = service.parseDocument(`---
title: 회의록
count: 3
done: false
due: 2026-09-30
tags:
  - 업무
  - 중요
description: |-
  첫 번째 줄
  두 번째 줄
---

# 본문
`)

    expect(parsed.frontmatter).toEqual({
      title: '회의록',
      count: 3,
      done: false,
      due: '2026-09-30',
      tags: ['업무', '중요'],
      description: '첫 번째 줄\n두 번째 줄',
    })
    expect(parsed.body).toBe('\n# 본문\n')
  })

  it('round-trips unchanged source including BOM, comments, quotes, and CRLF', () => {
    const source =
      '\uFEFF---\r\n# Frontmatter 주석\r\ntitle: "회의록"\r\n---\r\n\r\n# 본문\r\n'

    expect(service.serializeDocument(service.parseDocument(source))).toBe(
      source,
    )
  })

  it('updates and removes frontmatter fields without changing the body', () => {
    const source = `---
title: 기존 제목
done: false
removeMe: value
---

# 본문

본문의  공백은 그대로 유지합니다.
`
    const originalBody = service.parseDocument(source).body
    const updated = service.updateFrontmatter(source, {
      done: true,
      removeMe: undefined,
      tags: ['업무', '완료'],
    })
    const parsed = service.parseDocument(updated)

    expect(parsed.frontmatter).toEqual({
      title: '기존 제목',
      done: true,
      tags: ['업무', '완료'],
    })
    expect(parsed.body).toBe(originalBody)
  })

  it('adds frontmatter to a document using its existing line endings', () => {
    const source = '# 새 문서\r\n\r\n본문\r\n'

    expect(service.updateFrontmatter(source, { title: '새 문서' })).toBe(
      '---\r\ntitle: 새 문서\r\n---\r\n\r\n# 새 문서\r\n\r\n본문\r\n',
    )
  })

  it('parses empty frontmatter as an empty object', () => {
    const source = '---\n---\n본문'
    const parsed = service.parseDocument(source)

    expect(parsed.frontmatter).toEqual({})
    expect(parsed.body).toBe('본문')
    expect(service.serializeDocument(parsed)).toBe(source)
  })

  it('rejects malformed YAML and duplicate keys', () => {
    expect(() =>
      service.parseDocument('---\ntitle: [열림\n---\n본문'),
    ).toThrowError(MarkdownError)
    expect(() =>
      service.parseFrontmatter('title: 하나\ntitle: 둘\n'),
    ).toThrowError(expect.objectContaining({ code: 'invalid-frontmatter' }))
  })

  it('requires a key-value object at the frontmatter root', () => {
    expect(() =>
      service.parseFrontmatter('- 첫 번째\n- 두 번째\n'),
    ).toThrowError(
      expect.objectContaining({ code: 'invalid-frontmatter-root' }),
    )
  })

  it('treats special object property names as frontmatter data', () => {
    const updated = service.updateFrontmatter('# 본문', {
      ['__proto__']: { safe: true },
    })

    expect(service.parseDocument(updated).frontmatter).toEqual({
      ['__proto__']: { safe: true },
    })
  })

  it('rejects non-finite numbers and circular values before serialization', () => {
    const base: ParsedMarkdownDocument = {
      body: '',
      format: {
        byteOrderMark: false,
        closingLineEnding: '',
        frontmatterSource: null,
        lineEnding: '\n',
      },
      frontmatter: { value: Number.NaN },
    }
    expect(() => service.serializeDocument(base)).toThrowError(
      expect.objectContaining({ code: 'unsupported-frontmatter-value' }),
    )

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() =>
      service.serializeDocument({
        ...base,
        frontmatter: circular as MarkdownFrontmatter,
      }),
    ).toThrowError(
      expect.objectContaining({ code: 'unsupported-frontmatter-value' }),
    )
  })
})
