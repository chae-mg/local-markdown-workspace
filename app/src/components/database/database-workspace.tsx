import {
  ArrowUpRight,
  Database,
  FilePlus2,
  FolderKanban,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { databaseService } from '@/app/composition-root'
import { Button } from '@/components/ui/button'
import type { DatabaseItem, DatabaseSchema } from '@/domain/database'
import type { DatabaseApplicationService } from '@/services/database.service'

interface DatabaseWorkspaceProps {
  onOpenItem(path: string): Promise<void> | void
  onWorkspaceChanged(): Promise<void> | void
  service?: DatabaseApplicationService
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Database를 처리하는 중 알 수 없는 오류가 발생했습니다.'
}

export function DatabaseWorkspace({
  onOpenItem,
  onWorkspaceChanged,
  service = databaseService,
}: DatabaseWorkspaceProps) {
  const [databases, setDatabases] = useState<DatabaseSchema[]>([])
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(
    null,
  )
  const [items, setItems] = useState<DatabaseItem[]>([])
  const [databaseName, setDatabaseName] = useState('')
  const [itemTitle, setItemTitle] = useState('')
  const [showDatabaseForm, setShowDatabaseForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'creating-database' | 'creating-item' | 'deleting'
  >('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedDatabase =
    databases.find((database) => database.id === selectedDatabaseId) ?? null

  const loadItems = useCallback(
    async (databaseId: string) => {
      setStatus('loading')
      setErrorMessage(null)
      try {
        setItems(await service.loadItems(databaseId))
        setStatus('ready')
      } catch (error) {
        setItems([])
        setErrorMessage(messageFromError(error))
        setStatus('ready')
      }
    },
    [service],
  )

  const loadDatabases = useCallback(async () => {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const loadedDatabases = await service.listDatabases()
      setDatabases(loadedDatabases)
      const nextSelectedId =
        loadedDatabases.find((database) => database.id === selectedDatabaseId)
          ?.id ??
        loadedDatabases[0]?.id ??
        null
      setSelectedDatabaseId(nextSelectedId)
      if (nextSelectedId) {
        setItems(await service.loadItems(nextSelectedId))
      } else {
        setItems([])
      }
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }, [selectedDatabaseId, service])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDatabases(), 0)
    return () => window.clearTimeout(timer)
    // Workspace 전환 시 컴포넌트를 다시 mount하므로 최초 1회만 불러온다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDatabaseSelect = (databaseId: string) => {
    if (databaseId === selectedDatabaseId) {
      return
    }
    setSelectedDatabaseId(databaseId)
    void loadItems(databaseId)
  }

  const handleCreateDatabase = async (event: FormEvent) => {
    event.preventDefault()
    if (!databaseName.trim() || status !== 'ready') {
      return
    }

    setStatus('creating-database')
    setErrorMessage(null)
    try {
      const database = await service.createDatabase(databaseName)
      setDatabases((current) =>
        [...current, database].sort((left, right) =>
          left.name.localeCompare(right.name, 'ko'),
        ),
      )
      setSelectedDatabaseId(database.id)
      setItems([])
      setDatabaseName('')
      setShowDatabaseForm(false)
      await onWorkspaceChanged()
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const handleCreateItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedDatabaseId || !itemTitle.trim() || status !== 'ready') {
      return
    }

    setStatus('creating-item')
    setErrorMessage(null)
    try {
      const item = await service.createItem(selectedDatabaseId, itemTitle)
      setItems((current) => [item, ...current])
      setItemTitle('')
      setShowItemForm(false)
      await onWorkspaceChanged()
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const handleDeleteItem = async (item: DatabaseItem) => {
    if (
      !selectedDatabaseId ||
      status !== 'ready' ||
      !window.confirm(`“${item.title}” 항목을 휴지통으로 이동할까요?`)
    ) {
      return
    }

    setStatus('deleting')
    setErrorMessage(null)
    try {
      await service.deleteItem(selectedDatabaseId, item.id)
      setItems((current) =>
        current.filter((candidate) => candidate.id !== item.id),
      )
      await onWorkspaceChanged()
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const isMutating =
    status === 'creating-database' ||
    status === 'creating-item' ||
    status === 'deleting'

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-stone-50/40 px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">
              <Database aria-hidden="true" className="size-3.5" />
              Markdown Database
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
              데이터베이스
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              각 항목은 내 폴더에 독립된 Markdown 파일로 저장됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              aria-label="데이터베이스 새로고침"
              disabled={status === 'loading' || isMutating}
              onClick={() => void loadDatabases()}
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
              />
              새로고침
            </Button>
            <Button
              disabled={isMutating}
              onClick={() => setShowDatabaseForm((visible) => !visible)}
            >
              <Plus aria-hidden="true" className="size-4" />새 데이터베이스
            </Button>
          </div>
        </div>

        {showDatabaseForm ? (
          <form
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row"
            onSubmit={(event) => void handleCreateDatabase(event)}
          >
            <label className="sr-only" htmlFor="database-name">
              새 데이터베이스 이름
            </label>
            <input
              autoFocus
              className="h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm transition outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
              disabled={isMutating}
              id="database-name"
              onChange={(event) => setDatabaseName(event.target.value)}
              placeholder="예: 프로젝트"
              value={databaseName}
            />
            <div className="flex gap-2">
              <Button
                disabled={!databaseName.trim() || isMutating}
                type="submit"
              >
                {status === 'creating-database' ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : null}
                생성
              </Button>
              <Button
                disabled={isMutating}
                onClick={() => setShowDatabaseForm(false)}
                variant="outline"
              >
                취소
              </Button>
            </div>
          </form>
        ) : null}

        {errorMessage ? (
          <div
            className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            role="alert"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="mt-7 grid min-h-[28rem] gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <p className="px-3 pt-1 pb-2 text-xs font-semibold tracking-[0.12em] text-stone-400 uppercase">
              Databases · {databases.length}
            </p>
            {status === 'loading' && databases.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-5 text-sm text-stone-500">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                불러오는 중
              </div>
            ) : databases.length === 0 ? (
              <div className="rounded-xl bg-stone-50 px-3 py-5 text-sm leading-6 text-stone-500">
                첫 데이터베이스를 만들면 Schema와 items 폴더가 자동으로
                준비됩니다.
              </div>
            ) : (
              <div className="space-y-1">
                {databases.map((database) => (
                  <button
                    aria-pressed={database.id === selectedDatabaseId}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      database.id === selectedDatabaseId
                        ? 'bg-stone-950 font-medium text-white'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                    }`}
                    disabled={isMutating}
                    key={database.id}
                    onClick={() => handleDatabaseSelect(database.id)}
                    type="button"
                  >
                    <FolderKanban
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <span className="truncate">{database.name}</span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <div className="min-w-0 rounded-2xl border border-stone-200 bg-white shadow-sm">
            {selectedDatabase ? (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-stone-200 px-5 py-5 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold tracking-tight">
                      {selectedDatabase.name}
                    </h2>
                    <p className="mt-1 truncate text-xs text-stone-400">
                      {selectedDatabase.folder}
                    </p>
                  </div>
                  <Button
                    disabled={isMutating}
                    onClick={() => setShowItemForm((visible) => !visible)}
                    size="sm"
                  >
                    <FilePlus2 aria-hidden="true" className="size-4" />새 항목
                  </Button>
                </div>

                {showItemForm ? (
                  <form
                    className="flex flex-col gap-3 border-b border-stone-200 bg-stone-50/70 p-4 sm:flex-row"
                    onSubmit={(event) => void handleCreateItem(event)}
                  >
                    <label className="sr-only" htmlFor="database-item-title">
                      새 항목 제목
                    </label>
                    <input
                      autoFocus
                      className="h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm transition outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
                      disabled={isMutating}
                      id="database-item-title"
                      onChange={(event) => setItemTitle(event.target.value)}
                      placeholder="항목 제목"
                      value={itemTitle}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={!itemTitle.trim() || isMutating}
                        size="sm"
                        type="submit"
                      >
                        {status === 'creating-item' ? (
                          <LoaderCircle
                            aria-hidden="true"
                            className="size-4 animate-spin"
                          />
                        ) : null}
                        생성
                      </Button>
                      <Button
                        disabled={isMutating}
                        onClick={() => setShowItemForm(false)}
                        size="sm"
                        variant="outline"
                      >
                        취소
                      </Button>
                    </div>
                  </form>
                ) : null}

                {status === 'loading' ? (
                  <div className="grid min-h-72 place-items-center text-sm text-stone-500">
                    <span className="flex items-center gap-2">
                      <LoaderCircle
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                      항목을 불러오는 중
                    </span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="grid min-h-72 place-items-center px-5 text-center">
                    <div>
                      <FilePlus2
                        aria-hidden="true"
                        className="mx-auto size-8 text-stone-300"
                        strokeWidth={1.5}
                      />
                      <p className="mt-3 text-sm font-medium">
                        아직 항목이 없습니다.
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        새 항목은 ID Frontmatter를 가진 Markdown 파일로
                        저장됩니다.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {items.map((item) => (
                      <article
                        className="group flex items-center gap-3 px-5 py-4 transition hover:bg-stone-50"
                        key={item.id}
                      >
                        <button
                          aria-label={`${item.title} Markdown 열기`}
                          className="min-w-0 flex-1 text-left outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-stone-400"
                          onClick={() => void onOpenItem(item.path)}
                          type="button"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-stone-900">
                            <span className="truncate">{item.title}</span>
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-3.5 shrink-0 text-stone-400"
                            />
                          </span>
                          <span className="mt-1 block truncate text-xs text-stone-400">
                            {item.path.split('/').at(-1)}
                          </span>
                        </button>
                        <button
                          aria-label={`${item.title} 휴지통으로 이동`}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                          disabled={isMutating}
                          onClick={() => void handleDeleteItem(item)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="grid min-h-[28rem] place-items-center px-6 text-center">
                <div>
                  <Database
                    aria-hidden="true"
                    className="mx-auto size-9 text-stone-300"
                    strokeWidth={1.5}
                  />
                  <h2 className="mt-4 text-lg font-semibold">
                    Database Foundation
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                    데이터베이스를 만들면 Schema는 앱 Metadata에, 실제 항목은
                    일반 Markdown 파일로 저장됩니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
