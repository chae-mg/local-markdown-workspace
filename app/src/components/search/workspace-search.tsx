import { FileText, LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { SearchResult } from '@/domain/search'
import type { SearchApplicationService } from '@/services/search.service'

interface WorkspaceSearchProps {
  onClose: () => void
  onSelect: (path: string) => void
  service: SearchApplicationService
}

const matchLabels = {
  filename: '파일명',
  title: '제목',
  property: '속성',
  body: '본문',
} as const

export function WorkspaceSearch({
  onClose,
  onSelect,
  service,
}: WorkspaceSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return
    }

    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setIsLoading(true)
      try {
        const nextResults = await service.search(trimmedQuery)
        if (!cancelled) {
          setResults(nextResults)
          setErrorMessage(null)
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '검색 중 오류가 발생했습니다.',
          )
          setResults([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [query, service])

  return (
    <section
      aria-label="워크스페이스 검색"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-2 flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="absolute top-2.5 left-2.5 size-3.5 text-[var(--ui-muted)]"
          />
          <input
            aria-label="워크스페이스 검색어"
            autoFocus
            className="h-8 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] pr-2 pl-8 text-[13px] outline-none placeholder:text-[var(--ui-faint)] focus:border-[var(--ui-accent)]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="문서, 제목, 본문 검색"
            type="search"
            value={query}
          />
        </div>
        <button
          aria-label="검색 닫기"
          className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-4 text-xs text-[var(--ui-muted)]">
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 animate-spin"
            />
            검색 중…
          </div>
        ) : errorMessage ? (
          <p className="px-2 py-4 text-xs leading-5 text-red-700">
            {errorMessage}
          </p>
        ) : query.trim() && results.length === 0 ? (
          <p className="px-2 py-4 text-xs leading-5 text-[var(--ui-muted)]">
            검색 결과가 없습니다.
          </p>
        ) : query.trim() ? (
          <div className="space-y-0.5">
            {results.map((result) => (
              <button
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--ui-hover)]"
                key={result.path}
                onClick={() => onSelect(result.path)}
                type="button"
              >
                <FileText
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--ui-muted)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">
                    {result.title ?? result.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-[var(--ui-muted)]">
                    {result.path}
                  </span>
                  {result.snippet ? (
                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[var(--ui-muted)]">
                      {result.snippet}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded bg-[var(--ui-accent-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ui-accent)]">
                  {matchLabels[result.matchKind]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 py-4 text-xs leading-5 text-[var(--ui-muted)]">
            파일명, 제목, 속성, 본문을 검색할 수 있습니다.
          </p>
        )}
      </div>
    </section>
  )
}
