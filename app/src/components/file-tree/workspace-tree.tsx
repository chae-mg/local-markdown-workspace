import {
  ChevronRight,
  FileText,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import type { WorkspaceEntry } from '@/domain/file-system'

interface WorkspaceTreeProps {
  entries: WorkspaceEntry[]
  errorMessage: string | null
  isLoading: boolean
  isMutating: boolean
  mutationErrorMessage: string | null
  onClearMutationError(): void
  onCreateFolder(parentPath: string, name: string): Promise<boolean>
  onCreateMarkdownFile(parentPath: string, name: string): Promise<boolean>
  onDirectorySelect(path: string): void
  onRefresh(): void
  onSelect(path: string): void
  selectedDirectoryPath: string
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
  isMutating,
  mutationErrorMessage,
  onClearMutationError,
  onCreateFolder,
  onCreateMarkdownFile,
  onDirectorySelect,
  onRefresh,
  onSelect,
  selectedDirectoryPath,
  selectedPath,
  workspaceName,
}: WorkspaceTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState(
    () => new Set(defaultExpandedPaths),
  )
  const [creationKind, setCreationKind] = useState<'file' | 'folder' | null>(
    null,
  )
  const [entryName, setEntryName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    if (creationKind) {
      inputRef.current?.focus()
    }
  }, [creationKind])

  const startCreation = (kind: 'file' | 'folder') => {
    onClearMutationError()
    setExpandedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths)
      for (const path of [
        ...ancestorPaths(selectedDirectoryPath),
        selectedDirectoryPath,
      ]) {
        if (path) {
          nextPaths.add(path)
        }
      }
      return nextPaths
    })
    setEntryName('')
    setCreationKind(kind)
  }

  const cancelCreation = () => {
    onClearMutationError()
    setEntryName('')
    setCreationKind(null)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const created =
      creationKind === 'file'
        ? await onCreateMarkdownFile(selectedDirectoryPath, entryName)
        : await onCreateFolder(selectedDirectoryPath, entryName)

    if (created) {
      setEntryName('')
      setCreationKind(null)
    }
  }

  const creationParentLabel = selectedDirectoryPath || workspaceName

  return (
    <section className="mt-7 min-h-0 flex-1 border-t border-stone-200 pt-5 md:overflow-y-auto md:pr-1">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-stone-800">
            {workspaceName}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-500">Markdown 파일</p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            aria-label={`${creationParentLabel}에 새 Markdown 문서`}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-50"
            disabled={isLoading || isMutating}
            onClick={() => startCreation('file')}
            title="새 Markdown 문서"
            type="button"
          >
            <FilePlus2 aria-hidden="true" className="size-3.5" />
          </button>
          <button
            aria-label={`${creationParentLabel}에 새 폴더`}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-50"
            disabled={isLoading || isMutating}
            onClick={() => startCreation('folder')}
            title="새 폴더"
            type="button"
          >
            <FolderPlus aria-hidden="true" className="size-3.5" />
          </button>
          <button
            aria-label="파일 트리 새로고침"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 disabled:cursor-wait disabled:opacity-50"
            disabled={isLoading || isMutating}
            onClick={onRefresh}
            title="새로고침"
            type="button"
          >
            {isLoading ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            ) : (
              <RefreshCw aria-hidden="true" className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {creationKind ? (
        <form
          className="mx-1 mt-3 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm"
          onSubmit={(event) => void handleCreate(event)}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-800">
                새 {creationKind === 'file' ? 'Markdown 문서' : '폴더'}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-stone-500">
                {creationParentLabel}에 생성
              </p>
            </div>
            <button
              aria-label="생성 취소"
              className="grid size-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              disabled={isMutating}
              onClick={cancelCreation}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <input
            aria-label={
              creationKind === 'file' ? '새 문서 이름' : '새 폴더 이름'
            }
            className="h-8 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-xs transition-shadow outline-none placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50"
            disabled={isMutating}
            onChange={(event) => setEntryName(event.target.value)}
            placeholder={creationKind === 'file' ? '회의록' : '새 프로젝트'}
            ref={inputRef}
            value={entryName}
          />
          {mutationErrorMessage ? (
            <p className="mt-2 text-[11px] leading-4 text-red-700" role="alert">
              {mutationErrorMessage}
            </p>
          ) : null}
          <button
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-stone-950 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-wait disabled:opacity-50"
            disabled={isMutating || !entryName.trim()}
            type="submit"
          >
            {isMutating ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            ) : null}
            {isMutating ? '생성 중' : '생성'}
          </button>
        </form>
      ) : null}

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
          className="mt-2 max-h-[42vh] space-y-0.5 overflow-y-auto pr-1 md:max-h-none"
          role="tree"
        >
          {visibleEntries.map((entry) => {
            const isDirectory = entry.kind === 'directory'
            const isExpanded = expandedPaths.has(entry.path)
            const isSelected = selectedPath === entry.path
            const isSelectedDirectory =
              isDirectory && selectedDirectoryPath === entry.path
            const depth = entryDepth(entry)

            return (
              <button
                aria-expanded={isDirectory ? isExpanded : undefined}
                aria-level={depth + 1}
                aria-selected={isDirectory ? isSelectedDirectory : isSelected}
                className={`flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-stone-200 font-medium text-stone-950'
                    : isSelectedDirectory
                      ? 'bg-amber-50 font-medium text-amber-950'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                }`}
                key={entry.path}
                onClick={() => {
                  if (isDirectory) {
                    onDirectorySelect(entry.path)
                    toggleDirectory(entry.path)
                    return
                  }

                  onSelect(entry.path)
                }}
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
