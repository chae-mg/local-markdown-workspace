import {
  ChevronRight,
  FileText,
  FilePlus2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'

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
  onMoveEntry(path: string, destinationPath: string): Promise<boolean>
  onMoveToTrash(path: string): Promise<boolean>
  onRefresh(): void
  onRenameEntry(path: string, name: string): Promise<boolean>
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

function parentDirectoryPath(path: string) {
  const segments = path.split('/')
  segments.pop()
  return segments.join('/')
}

function canMoveEntryToDirectory(
  entry: WorkspaceEntry,
  destinationPath: string,
) {
  if (destinationPath === parentDirectoryPath(entry.path)) {
    return false
  }

  return !(
    entry.kind === 'directory' &&
    (destinationPath === entry.path ||
      destinationPath.startsWith(`${entry.path}/`))
  )
}

function moveDestinationPaths(
  entry: WorkspaceEntry,
  entries: WorkspaceEntry[],
) {
  return [
    '',
    ...entries
      .filter((item) => item.kind === 'directory')
      .map((item) => item.path),
  ].filter((path) => canMoveEntryToDirectory(entry, path))
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
  onMoveEntry,
  onMoveToTrash,
  onRefresh,
  onRenameEntry,
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
  const [entryAction, setEntryAction] = useState<
    'menu' | 'move' | 'rename' | 'trash' | null
  >(null)
  const [entryName, setEntryName] = useState('')
  const [moveDestinationPath, setMoveDestinationPath] = useState('')
  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasMarkdownFiles = entries.some((entry) => entry.kind === 'file')
  const visibleEntries = entries.filter((entry) =>
    ancestorPaths(entry.path).every((path) => expandedPaths.has(path)),
  )
  const selectedActionEntry = entries.find(
    (entry) => entry.path === (selectedPath ?? selectedDirectoryPath),
  )
  const draggedEntry = entries.find((entry) => entry.path === draggedPath)
  const moveDestinations = selectedActionEntry
    ? moveDestinationPaths(selectedActionEntry, entries)
    : []

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
    if (creationKind || entryAction === 'rename') {
      inputRef.current?.focus()
    }
  }, [creationKind, entryAction])

  const expandDirectoryPath = (path: string) => {
    setExpandedPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths)
      for (const expandedPath of [...ancestorPaths(path), path]) {
        if (expandedPath) {
          nextPaths.add(expandedPath)
        }
      }
      return nextPaths
    })
  }

  const startCreation = (kind: 'file' | 'folder') => {
    onClearMutationError()
    setEntryAction(null)
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

  const startEntryAction = (action: 'menu' | 'move' | 'rename' | 'trash') => {
    if (!selectedActionEntry) {
      return
    }

    onClearMutationError()
    setCreationKind(null)
    setEntryName(action === 'rename' ? selectedActionEntry.name : '')
    if (action === 'move') {
      setMoveDestinationPath(
        moveDestinationPaths(selectedActionEntry, entries)[0] ?? '',
      )
    }
    setEntryAction(action)
  }

  const cancelEntryAction = () => {
    onClearMutationError()
    setEntryName('')
    setMoveDestinationPath('')
    setEntryAction(null)
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

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedActionEntry) {
      return
    }

    if (await onRenameEntry(selectedActionEntry.path, entryName)) {
      setEntryName('')
      setEntryAction(null)
    }
  }

  const handleMove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedActionEntry) {
      return
    }

    if (await onMoveEntry(selectedActionEntry.path, moveDestinationPath)) {
      expandDirectoryPath(moveDestinationPath)
      setMoveDestinationPath('')
      setEntryAction(null)
    }
  }

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    entry: WorkspaceEntry,
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', entry.path)
    onClearMutationError()
    setCreationKind(null)
    setEntryAction(null)
    setDraggedPath(entry.path)
  }

  const handleDragOver = (
    event: DragEvent<HTMLElement>,
    destinationPath: string,
  ) => {
    const sourcePath =
      draggedPath || event.dataTransfer.getData('text/plain') || null
    const source = entries.find((entry) => entry.path === sourcePath)

    if (!source || !canMoveEntryToDirectory(source, destinationPath)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetPath(destinationPath)
  }

  const handleDrop = async (
    event: DragEvent<HTMLElement>,
    destinationPath: string,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    const sourcePath =
      draggedPath || event.dataTransfer.getData('text/plain') || null
    const source = entries.find((entry) => entry.path === sourcePath)
    setDraggedPath(null)
    setDropTargetPath(null)

    if (!source || !canMoveEntryToDirectory(source, destinationPath)) {
      return
    }

    if (await onMoveEntry(source.path, destinationPath)) {
      expandDirectoryPath(destinationPath)
    }
  }

  const finishDragging = () => {
    setDraggedPath(null)
    setDropTargetPath(null)
  }

  const handleMoveToTrash = async () => {
    if (!selectedActionEntry) {
      return
    }

    if (await onMoveToTrash(selectedActionEntry.path)) {
      setEntryAction(null)
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
            aria-label={
              selectedActionEntry
                ? `${selectedActionEntry.name} 작업`
                : '선택 항목 작업'
            }
            className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-40"
            disabled={!selectedActionEntry || isLoading || isMutating}
            onClick={() => startEntryAction('menu')}
            title="선택 항목 작업"
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="size-3.5" />
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

      {draggedEntry && canMoveEntryToDirectory(draggedEntry, '') ? (
        <div
          className={`mx-1 mb-2 rounded-lg border border-dashed px-3 py-2 text-center text-[11px] transition-colors ${
            dropTargetPath === ''
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'border-stone-300 bg-stone-50 text-stone-500'
          }`}
          onDragOver={(event) => handleDragOver(event, '')}
          onDrop={(event) => void handleDrop(event, '')}
        >
          {workspaceName} 최상위로 이동
        </div>
      ) : null}

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

      {entryAction === 'menu' && selectedActionEntry ? (
        <div className="mx-1 mt-3 rounded-xl border border-stone-200 bg-white p-1.5 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <p className="min-w-0 truncate text-[11px] font-medium text-stone-700">
              {selectedActionEntry.name}
            </p>
            <button
              aria-label="항목 작업 닫기"
              className="grid size-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              onClick={cancelEntryAction}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-950"
            onClick={() => startEntryAction('rename')}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            이름 변경
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-stone-700 hover:bg-stone-100 hover:text-stone-950 disabled:text-stone-400"
            disabled={moveDestinations.length === 0}
            onClick={() => startEntryAction('move')}
            type="button"
          >
            <FolderInput aria-hidden="true" className="size-3.5" />
            폴더로 이동
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-red-700 hover:bg-red-50"
            onClick={() => startEntryAction('trash')}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            휴지통으로 이동
          </button>
        </div>
      ) : null}

      {entryAction === 'move' && selectedActionEntry ? (
        <form
          className="mx-1 mt-3 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm"
          onSubmit={(event) => void handleMove(event)}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-stone-800">
                {selectedActionEntry.name} 이동
              </p>
              <p className="mt-0.5 text-[10px] text-stone-500">
                이름은 그대로 유지됩니다.
              </p>
            </div>
            <button
              aria-label="이동 취소"
              className="grid size-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              disabled={isMutating}
              onClick={cancelEntryAction}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          {moveDestinations.length > 0 ? (
            <select
              aria-label="이동할 폴더"
              className="h-8 w-full rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-700 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50"
              disabled={isMutating}
              onChange={(event) => setMoveDestinationPath(event.target.value)}
              value={moveDestinationPath}
            >
              {moveDestinations.map((path) => (
                <option key={path || 'workspace-root'} value={path}>
                  {path || `${workspaceName} 최상위`}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-lg bg-stone-50 px-2.5 py-2 text-[11px] text-stone-500">
              이동 가능한 폴더가 없습니다.
            </p>
          )}
          {mutationErrorMessage ? (
            <p className="mt-2 text-[11px] leading-4 text-red-700" role="alert">
              {mutationErrorMessage}
            </p>
          ) : null}
          <button
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-stone-950 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-wait disabled:opacity-50"
            disabled={isMutating || moveDestinations.length === 0}
            type="submit"
          >
            {isMutating ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            ) : null}
            {isMutating ? '이동 중' : '이동'}
          </button>
        </form>
      ) : null}

      {entryAction === 'rename' && selectedActionEntry ? (
        <form
          className="mx-1 mt-3 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm"
          onSubmit={(event) => void handleRename(event)}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-stone-800">
              {selectedActionEntry.name} 이름 변경
            </p>
            <button
              aria-label="이름 변경 취소"
              className="grid size-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              disabled={isMutating}
              onClick={cancelEntryAction}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <input
            aria-label="변경할 이름"
            className="h-8 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-xs transition-shadow outline-none placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50"
            disabled={isMutating}
            onChange={(event) => setEntryName(event.target.value)}
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
            {isMutating ? '변경 중' : '이름 변경'}
          </button>
        </form>
      ) : null}

      {entryAction === 'trash' && selectedActionEntry ? (
        <div className="mx-1 mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5">
          <p className="text-xs font-medium text-red-900">
            {selectedActionEntry.name}을(를) 휴지통으로 이동할까요?
          </p>
          <p className="mt-1 text-[11px] leading-4 text-red-700">
            원래 위치와 이동 시간을 기록하며, 다음 단계에서 복원할 수 있습니다.
          </p>
          {mutationErrorMessage ? (
            <p className="mt-2 text-[11px] leading-4 text-red-800" role="alert">
              {mutationErrorMessage}
            </p>
          ) : null}
          <div className="mt-2 flex gap-1.5">
            <button
              className="h-8 flex-1 rounded-lg border border-red-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              disabled={isMutating}
              onClick={cancelEntryAction}
              type="button"
            >
              취소
            </button>
            <button
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-700 text-xs font-medium text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-50"
              disabled={isMutating}
              onClick={() => void handleMoveToTrash()}
              type="button"
            >
              {isMutating ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                />
              ) : null}
              {isMutating ? '이동 중' : '휴지통으로 이동'}
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mx-1 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {!creationKind && !entryAction && mutationErrorMessage ? (
        <div
          className="mx-1 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
          role="alert"
        >
          {mutationErrorMessage}
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
                draggable={!isMutating}
                className={`flex w-full cursor-grab items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-xs transition-colors active:cursor-grabbing ${
                  dropTargetPath === entry.path
                    ? 'bg-amber-100 font-medium text-amber-950 ring-1 ring-amber-400'
                    : isSelected
                      ? 'bg-stone-200 font-medium text-stone-950'
                      : isSelectedDirectory
                        ? 'bg-amber-50 font-medium text-amber-950'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                } ${draggedPath === entry.path ? 'opacity-50' : ''}`}
                key={entry.path}
                onClick={() => {
                  setEntryAction(null)
                  onClearMutationError()

                  if (isDirectory) {
                    onDirectorySelect(entry.path)
                    toggleDirectory(entry.path)
                    return
                  }

                  onSelect(entry.path)
                }}
                onDragEnd={finishDragging}
                onDragOver={
                  isDirectory
                    ? (event) => handleDragOver(event, entry.path)
                    : undefined
                }
                onDragStart={(event) => handleDragStart(event, entry)}
                onDrop={
                  isDirectory
                    ? (event) => void handleDrop(event, entry.path)
                    : undefined
                }
                role="treeitem"
                style={{ paddingLeft: `${4 + depth * 14}px` }}
                title={`${entry.path} · 폴더로 드래그하여 이동`}
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
