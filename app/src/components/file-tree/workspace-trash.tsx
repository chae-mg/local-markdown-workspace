import {
  ChevronDown,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import type { TrashEntryMetadata } from '@/domain/workspace'

interface WorkspaceTrashProps {
  entries: TrashEntryMetadata[]
  errorMessage: string | null
  isLoading: boolean
  isMutating: boolean
  mutationErrorMessage: string | null
  onClearMutationError(): void
  onEmpty(): Promise<boolean>
  onRefresh(): void
  onRestore(id: string, name: string): Promise<boolean>
}

function entryName(entry: TrashEntryMetadata) {
  return entry.originalPath.split('/').at(-1) ?? entry.originalPath
}

function deletedAtLabel(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function WorkspaceTrash({
  entries,
  errorMessage,
  isLoading,
  isMutating,
  mutationErrorMessage,
  onClearMutationError,
  onEmpty,
  onRefresh,
  onRestore,
}: WorkspaceTrashProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [restoreEntryId, setRestoreEntryId] = useState<string | null>(null)
  const [restoreName, setRestoreName] = useState('')
  const [isConfirmingEmpty, setIsConfirmingEmpty] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (restoreEntryId) {
      inputRef.current?.focus()
    }
  }, [restoreEntryId])

  const startRestore = (entry: TrashEntryMetadata) => {
    onClearMutationError()
    setIsConfirmingEmpty(false)
    setRestoreName(entryName(entry))
    setRestoreEntryId(entry.id)
  }

  const cancelRestore = () => {
    onClearMutationError()
    setRestoreEntryId(null)
    setRestoreName('')
  }

  const handleRestore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!restoreEntryId) {
      return
    }

    if (await onRestore(restoreEntryId, restoreName)) {
      setRestoreEntryId(null)
      setRestoreName('')
    }
  }

  const startEmpty = () => {
    onClearMutationError()
    setRestoreEntryId(null)
    setIsConfirmingEmpty(true)
  }

  const cancelEmpty = () => {
    onClearMutationError()
    setIsConfirmingEmpty(false)
  }

  const handleEmpty = async () => {
    if (await onEmpty()) {
      setIsConfirmingEmpty(false)
    }
  }

  return (
    <section className="mt-4 border-t border-stone-200 pt-4">
      <div className="flex items-center gap-1">
        <button
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs font-medium text-stone-700 hover:bg-stone-100"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 shrink-0 transition-transform ${
              isExpanded ? '' : '-rotate-90'
            }`}
          />
          <Trash2 aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">휴지통</span>
          <span className="ml-auto rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] text-stone-600 tabular-nums">
            {entries.length}
          </span>
        </button>
        <button
          aria-label="휴지통 새로고침"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-200/70 hover:text-stone-900 disabled:opacity-50"
          disabled={isLoading || isMutating}
          onClick={onRefresh}
          title="휴지통 새로고침"
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
        <button
          aria-label="휴지통 비우기"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          disabled={entries.length === 0 || isLoading || isMutating}
          onClick={startEmpty}
          title="휴지통 비우기"
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      {isExpanded ? (
        <div className="mt-2">
          {errorMessage ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-800"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          {!errorMessage && !isLoading && entries.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-stone-500">
              휴지통이 비어 있습니다.
            </p>
          ) : null}

          {entries.length > 0 ? (
            <ul
              aria-label="휴지통 항목"
              className="max-h-48 space-y-1 overflow-y-auto pr-1"
            >
              {entries.map((entry) => (
                <li
                  className="rounded-lg border border-transparent bg-stone-100/70 p-2"
                  key={entry.id}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-stone-800">
                        {entryName(entry)}
                      </p>
                      <p
                        className="mt-0.5 truncate text-[10px] text-stone-500"
                        title={entry.originalPath}
                      >
                        {entry.originalPath} · {deletedAtLabel(entry.deletedAt)}
                      </p>
                    </div>
                    <button
                      aria-label={`${entryName(entry)} 복원`}
                      className="grid size-7 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-white hover:text-emerald-700 disabled:opacity-50"
                      disabled={isMutating}
                      onClick={() => startRestore(entry)}
                      title="복원"
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>

                  {restoreEntryId === entry.id ? (
                    <form
                      className="mt-2 border-t border-stone-200 pt-2"
                      onSubmit={(event) => void handleRestore(event)}
                    >
                      <label className="text-[10px] text-stone-500">
                        복원할 이름
                        <input
                          aria-label="복원할 이름"
                          className="mt-1 h-8 w-full rounded-lg border border-stone-300 bg-white px-2.5 text-xs outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50"
                          disabled={isMutating}
                          onChange={(event) =>
                            setRestoreName(event.target.value)
                          }
                          ref={inputRef}
                          value={restoreName}
                        />
                      </label>
                      {mutationErrorMessage ? (
                        <p
                          className="mt-2 text-[11px] leading-4 text-red-700"
                          role="alert"
                        >
                          {mutationErrorMessage}
                        </p>
                      ) : null}
                      <div className="mt-2 flex gap-1.5">
                        <button
                          className="h-8 flex-1 rounded-lg border border-stone-300 bg-white text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                          disabled={isMutating}
                          onClick={cancelRestore}
                          type="button"
                        >
                          취소
                        </button>
                        <button
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-stone-950 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                          disabled={isMutating || !restoreName.trim()}
                          type="submit"
                        >
                          {isMutating ? (
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-3.5 animate-spin"
                            />
                          ) : null}
                          {isMutating ? '복원 중' : '복원'}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {isConfirmingEmpty ? (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
              <p className="text-[11px] font-medium text-red-900">
                휴지통의 {entries.length}개 항목을 영구 삭제할까요?
              </p>
              <p className="mt-1 text-[10px] leading-4 text-red-700">
                이 작업은 되돌릴 수 없습니다.
              </p>
              {mutationErrorMessage ? (
                <p className="mt-2 text-[11px] text-red-800" role="alert">
                  {mutationErrorMessage}
                </p>
              ) : null}
              <div className="mt-2 flex gap-1.5">
                <button
                  className="h-8 flex-1 rounded-lg border border-red-200 bg-white text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  disabled={isMutating}
                  onClick={cancelEmpty}
                  type="button"
                >
                  취소
                </button>
                <button
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-700 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  disabled={isMutating}
                  onClick={() => void handleEmpty()}
                  type="button"
                >
                  {isMutating ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-3.5 animate-spin"
                    />
                  ) : null}
                  {isMutating ? '비우는 중' : '영구 삭제'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
