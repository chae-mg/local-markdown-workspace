import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'

import type { WorkspaceEntry } from '@/domain/file-system'

interface WorkspaceTreeProps {
  entries: WorkspaceEntry[]
  errorMessage: string | null
  isLoading: boolean
  onRefresh(): void
  onSelect(path: string): void
  selectedPath: string | null
  workspaceName: string
}

const defaultExpandedPaths = new Set(['Documents', 'Databases', 'Attachments'])

function entryDepth(entry: WorkspaceEntry) {
  return entry.path.split('/').length - 1
}

function ancestorPaths(path: string) {
  const segments = path.split('/')
  return segments
    .slice(0, -1)
    .map((_, index) => segments.slice(0, index + 1).join('/'))
}

export function WorkspaceTree({
  entries,
  errorMessage,
  isLoading,
  onRefresh,
  onSelect,
  selectedPath,
  workspaceName,
}: WorkspaceTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState(
    () => new Set(defaultExpandedPaths),
  )
  const hasMarkdownFiles = entries.some((entry) => entry.kind === 'file')
  const visibleEntries = entries.filter((entry) =>
    ancestorPaths(entry.path).every((path) => expandedPaths.has(path)),
  )

  const toggleDirectory = (path: string) => {
    setExpandedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths)
      if (nextPaths.has(path)) {
        nextPaths.delete(path)
      } else {
        nextPaths.add(path)
      }
      return nextPaths
    })
  }

  return (
    <section className="mt-7 min-h-0 flex-1 border-t border-stone-200 pt-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-stone-800">
            {workspaceName}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">Markdown 파일</p>
        </div>
        <button
          aria-label="파일 트리 새로고침"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 disabled:cursor-wait disabled:opacity-50"
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </button>
      </div>

      {errorMessage ? (
        <div className="mx-1 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {!errorMessage && !isLoading && !hasMarkdownFiles ? (
        <div className="mx-1 mt-3 rounded-lg border border-dashed border-stone-300 px-3 py-4 text-center text-xs leading-5 text-stone-500">
          아직 Markdown 문서가 없습니다.
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div
          aria-label={`${workspaceName} 파일 트리`}
          className="mt-2 max-h-[42vh] space-y-0.5 overflow-y-auto pr-1"
          role="tree"
        >
          {visibleEntries.map((entry) => {
            const isDirectory = entry.kind === 'directory'
            const isExpanded = expandedPaths.has(entry.path)
            const isSelected = selectedPath === entry.path
            const depth = entryDepth(entry)

            return (
              <button
                aria-expanded={isDirectory ? isExpanded : undefined}
                aria-level={depth + 1}
                aria-selected={isDirectory ? undefined : isSelected}
                className={`flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-stone-200 font-medium text-stone-950'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                }`}
                key={entry.path}
                onClick={() =>
                  isDirectory
                    ? toggleDirectory(entry.path)
                    : onSelect(entry.path)
                }
                role="treeitem"
                style={{ paddingLeft: `${4 + depth * 14}px` }}
                title={entry.path}
                type="button"
              >
                {isDirectory ? (
                  <ChevronRight
                    aria-hidden="true"
                    className={`size-3 shrink-0 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {isDirectory ? (
                  isExpanded ? (
                    <FolderOpen
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-amber-700"
                    />
                  ) : (
                    <Folder
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-amber-700"
                    />
                  )
                ) : (
                  <FileText
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-stone-500"
                  />
                )}
                <span className="truncate">{entry.name}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
