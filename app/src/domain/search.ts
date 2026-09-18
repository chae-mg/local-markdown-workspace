export const currentSearchIndexVersion = 1

export interface SearchIndexEntry {
  path: string
  name: string
  title: string | null
  properties: Record<string, string>
  lastModified: number | null
  size: number | null
}

export interface SearchIndex {
  version: number
  generatedAt: string
  entries: SearchIndexEntry[]
}

export type SearchMatchKind = 'filename' | 'title' | 'property' | 'body'

export interface SearchResult {
  path: string
  name: string
  title: string | null
  matchKind: SearchMatchKind
  snippet: string | null
}
