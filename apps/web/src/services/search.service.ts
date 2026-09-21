import type { WorkspaceEntry } from '@/domain/file-system'
import {
  currentSearchIndexVersion,
  type SearchIndex,
  type SearchIndexEntry,
  type SearchResult,
} from '@/domain/search'
import type { FileSystemService } from '@/services/file-system.service'
import type { MarkdownApplicationService } from '@/services/markdown.service'
import { markdownService } from '@/services/markdown.service'
import type { WorkspaceApplicationService } from '@/services/workspace.service'

const searchIndexDirectory = '.workspace/search'
const searchIndexPath = `${searchIndexDirectory}/index.json`

export interface SearchApplicationService {
  rebuild(): Promise<void>
  refresh(): Promise<void>
  search(query: string): Promise<SearchResult[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: string) {
  return value.normalize('NFC').toLocaleLowerCase('ko-KR')
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.map(valueToText).join(' ')
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${key} ${valueToText(item)}`)
      .join(' ')
  }
  return ''
}

function extractTitle(body: string) {
  const match = body.match(/^\s*#\s+(.+?)\s*#?\s*$/m)
  return match?.[1]?.trim() || null
}

function flattenProperties(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, valueToText(item)]),
  )
}

function isIndexEntry(value: unknown): value is SearchIndexEntry {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.title === 'string' || value.title === null) &&
    isRecord(value.properties) &&
    Object.values(value.properties).every((item) => typeof item === 'string') &&
    (typeof value.lastModified === 'number' || value.lastModified === null) &&
    (typeof value.size === 'number' || value.size === null)
  )
}

function isSearchIndex(value: unknown): value is SearchIndex {
  return (
    isRecord(value) &&
    value.version === currentSearchIndexVersion &&
    typeof value.generatedAt === 'string' &&
    Array.isArray(value.entries) &&
    value.entries.every(isIndexEntry)
  )
}

function createSnippet(body: string, normalizedQuery: string) {
  const normalizedBody = normalizeText(body)
  const index = normalizedBody.indexOf(normalizedQuery)
  if (index < 0) return null
  const start = Math.max(0, index - 60)
  const end = Math.min(body.length, index + normalizedQuery.length + 100)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < body.length ? '…' : ''
  return `${prefix}${body.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`
}

export class SearchService<
  DirectoryHandle,
> implements SearchApplicationService {
  private index: SearchIndex | null = null

  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly workspace: WorkspaceApplicationService,
    private readonly markdown: MarkdownApplicationService = markdownService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async rebuild() {
    const root = this.getRoot()
    const entries = await this.workspace.scanWorkspace()
    const files = entries.filter((entry) => entry.kind === 'file')
    const indexEntries = await Promise.all(
      files.map((entry) => this.createIndexEntry(root, entry)),
    )
    const index: SearchIndex = {
      version: currentSearchIndexVersion,
      generatedAt: this.now().toISOString(),
      entries: indexEntries,
    }
    this.index = index
    await this.persist(root, index)
  }

  async refresh() {
    const root = this.getRoot()
    if (!this.index) {
      try {
        const parsed = JSON.parse(
          await this.fileSystem.readTextFile(root, searchIndexPath),
        ) as unknown
        this.index = isSearchIndex(parsed) ? parsed : null
      } catch {
        this.index = null
      }
    }

    const entries = (await this.workspace.scanWorkspace()).filter(
      (entry) => entry.kind === 'file',
    )
    const metadata = await Promise.all(
      entries.map(async (entry) => {
        const file = await this.fileSystem.getFileMetadata(root, entry.path)
        return {
          path: entry.path,
          name: entry.name,
          lastModified: file.lastModified,
          size: file.size,
        }
      }),
    )

    if (!this.index) {
      await this.rebuild()
      return
    }

    const previousByPath = new Map(
      this.index.entries.map((entry) => [entry.path, entry]),
    )
    const metadataByPath = new Map(metadata.map((item) => [item.path, item]))
    const changedEntries = entries.filter((entry) => {
      const previous = previousByPath.get(entry.path)
      const current = metadataByPath.get(entry.path)
      return (
        !previous ||
        !current ||
        previous.name !== current.name ||
        previous.lastModified !== current.lastModified ||
        previous.size !== current.size
      )
    })

    if (changedEntries.length > 0 || previousByPath.size !== metadata.length) {
      const refreshedEntries = await Promise.all(
        changedEntries.map((entry) => this.createIndexEntry(root, entry)),
      )
      const refreshedByPath = new Map(
        refreshedEntries.map((entry) => [entry.path, entry]),
      )
      const nextEntries = metadata
        .map(
          (item) =>
            refreshedByPath.get(item.path) ?? previousByPath.get(item.path),
        )
        .filter((entry): entry is SearchIndexEntry => entry !== undefined)
      this.index = {
        version: currentSearchIndexVersion,
        generatedAt: this.now().toISOString(),
        entries: nextEntries,
      }
      await this.persist(root, this.index)
    }
  }

  async search(query: string) {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []
    await this.refresh()
    const root = this.getRoot()
    const normalizedQuery = normalizeText(trimmedQuery)
    const results: SearchResult[] = []

    for (const entry of this.index?.entries ?? []) {
      const filename = normalizeText(entry.name)
      const title = normalizeText(entry.title ?? '')
      const property = normalizeText(
        `${Object.keys(entry.properties).join(' ')} ${Object.values(entry.properties).join(' ')}`,
      )
      let matchKind: SearchResult['matchKind'] | null = null
      if (filename.includes(normalizedQuery)) matchKind = 'filename'
      else if (title.includes(normalizedQuery)) matchKind = 'title'
      else if (property.includes(normalizedQuery)) matchKind = 'property'

      let snippet: string | null = null
      if (!matchKind) {
        const source = await this.fileSystem.readTextFile(root, entry.path)
        let body = source
        try {
          body = this.markdown.parseDocument(source).body
        } catch {
          // Even malformed frontmatter should leave the Markdown body searchable.
        }
        snippet = createSnippet(body, normalizedQuery)
        if (snippet) matchKind = 'body'
      }

      if (matchKind) {
        results.push({
          path: entry.path,
          name: entry.name,
          title: entry.title,
          matchKind,
          snippet,
        })
      }
    }

    return results
      .sort((left, right) => {
        const priority = { filename: 0, title: 1, property: 2, body: 3 }
        return (
          priority[left.matchKind] - priority[right.matchKind] ||
          left.path.localeCompare(right.path, 'ko')
        )
      })
      .slice(0, 100)
  }

  private async createIndexEntry(root: DirectoryHandle, entry: WorkspaceEntry) {
    const metadata = await this.fileSystem.getFileMetadata(root, entry.path)
    const source = await this.fileSystem.readTextFile(root, entry.path)
    let title: string | null = extractTitle(source)
    let properties: Record<string, string> = {}
    try {
      const document = this.markdown.parseDocument(source)
      title = extractTitle(document.body)
      properties = flattenProperties(document.frontmatter ?? {})
    } catch {
      // Keep the title extracted from the raw source when frontmatter is malformed.
    }
    return {
      path: entry.path,
      name: entry.name,
      title,
      properties,
      lastModified: metadata.lastModified,
      size: metadata.size,
    } satisfies SearchIndexEntry
  }

  private async persist(root: DirectoryHandle, index: SearchIndex) {
    try {
      await this.fileSystem.createDirectory(root, searchIndexDirectory, {
        allowProtected: true,
      })
      await this.fileSystem.writeTextFile(
        root,
        searchIndexPath,
        `${JSON.stringify(index, null, 2)}\n`,
        { allowProtected: true },
      )
    } catch {
      // Search remains usable as an in-memory derived index when persistence is unavailable.
    }
  }
}
