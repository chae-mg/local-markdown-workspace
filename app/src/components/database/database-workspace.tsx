import {
  Database,
  FilePlus2,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  RefreshCw,
  Settings2,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  databaseService,
  viewService as defaultViewService,
} from '@/app/composition-root'
import { DatabaseTable } from '@/components/database/database-table'
import { DatabaseViewToolbar } from '@/components/database/database-view-toolbar'
import { KanbanBoard } from '@/components/database/kanban-board'
import { SchemaPropertyManager } from '@/components/database/schema-property-manager'
import { Button } from '@/components/ui/button'
import type {
  DatabaseItem,
  DatabaseSchema,
  PropertyDefinition,
} from '@/domain/database'
import {
  applyDatabaseView,
  type DatabaseView,
  type DatabaseViewType,
} from '@/domain/database-view'
import type { MarkdownValue } from '@/domain/markdown'
import type { DatabaseApplicationService } from '@/services/database.service'
import type { ViewApplicationService } from '@/services/view.service'

interface DatabaseWorkspaceProps {
  onOpenItem(path: string): Promise<void> | void
  onWorkspaceChanged(): Promise<void> | void
  service?: DatabaseApplicationService
  viewApplicationService?: ViewApplicationService
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
  viewApplicationService = defaultViewService,
}: DatabaseWorkspaceProps) {
  const [databases, setDatabases] = useState<DatabaseSchema[]>([])
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(
    null,
  )
  const [items, setItems] = useState<DatabaseItem[]>([])
  const [views, setViews] = useState<DatabaseView[]>([])
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  const [databaseName, setDatabaseName] = useState('')
  const [itemTitle, setItemTitle] = useState('')
  const [showDatabaseForm, setShowDatabaseForm] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [showSchemaManager, setShowSchemaManager] = useState(false)
  const [status, setStatus] = useState<
    | 'loading'
    | 'ready'
    | 'creating-database'
    | 'creating-item'
    | 'deleting'
    | 'updating-property'
    | 'updating-view'
  >('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedDatabase =
    databases.find((database) => database.id === selectedDatabaseId) ?? null
  const selectedView =
    views.find((view) => view.id === selectedViewId) ?? views[0] ?? null
  const displayedItems =
    selectedDatabase && selectedView
      ? applyDatabaseView(items, selectedDatabase, selectedView)
      : items

  const loadDatabaseContent = useCallback(
    async (databaseId: string) => {
      setStatus('loading')
      setErrorMessage(null)
      try {
        const [loadedItems, storedViews] = await Promise.all([
          service.loadItems(databaseId),
          viewApplicationService.listViews(databaseId),
        ])
        const loadedViews =
          storedViews.length > 0
            ? storedViews
            : [
                await viewApplicationService.createView(
                  databaseId,
                  '전체 항목',
                  'table',
                ),
              ]
        setItems(loadedItems)
        setViews(loadedViews)
        setSelectedViewId((current) =>
          loadedViews.some((view) => view.id === current)
            ? current
            : (loadedViews[0]?.id ?? null),
        )
        setStatus('ready')
      } catch (error) {
        setItems([])
        setViews([])
        setSelectedViewId(null)
        setErrorMessage(messageFromError(error))
        setStatus('ready')
      }
    },
    [service, viewApplicationService],
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
        const [loadedItems, storedViews] = await Promise.all([
          service.loadItems(nextSelectedId),
          viewApplicationService.listViews(nextSelectedId),
        ])
        const loadedViews =
          storedViews.length > 0
            ? storedViews
            : [
                await viewApplicationService.createView(
                  nextSelectedId,
                  '전체 항목',
                  'table',
                ),
              ]
        setItems(loadedItems)
        setViews(loadedViews)
        setSelectedViewId((current) =>
          loadedViews.some((view) => view.id === current)
            ? current
            : (loadedViews[0]?.id ?? null),
        )
      } else {
        setItems([])
        setViews([])
        setSelectedViewId(null)
      }
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }, [selectedDatabaseId, service, viewApplicationService])

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
    setShowSchemaManager(false)
    setViews([])
    setSelectedViewId(null)
    void loadDatabaseContent(databaseId)
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
      setShowSchemaManager(false)
      const view = await viewApplicationService.createView(
        database.id,
        '전체 항목',
        'table',
      )
      setViews([view])
      setSelectedViewId(view.id)
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

  const handleUpdateProperty = async (
    item: DatabaseItem,
    property: PropertyDefinition,
    value: MarkdownValue | undefined,
  ) => {
    if (!selectedDatabaseId || status !== 'ready') {
      return
    }

    setStatus('updating-property')
    setErrorMessage(null)
    try {
      const updatedItem = await service.updateProperty(
        selectedDatabaseId,
        item.id,
        property.id,
        value,
      )
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === updatedItem.id ? updatedItem : candidate,
        ),
      )
      await onWorkspaceChanged()
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const handleCreateView = async (name: string, type: DatabaseViewType) => {
    if (!selectedDatabaseId || status !== 'ready') {
      return
    }
    setStatus('updating-view')
    setErrorMessage(null)
    try {
      const view = await viewApplicationService.createView(
        selectedDatabaseId,
        name,
        type,
      )
      setViews((current) => [...current, view])
      setSelectedViewId(view.id)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const handleUpdateView = async (
    view: DatabaseView,
    patch: Partial<DatabaseView>,
  ) => {
    if (status !== 'ready') {
      return
    }
    setStatus('updating-view')
    setErrorMessage(null)
    const nextView = { ...view, ...patch }
    setViews((current) =>
      current.map((candidate) =>
        candidate.id === nextView.id ? nextView : candidate,
      ),
    )
    try {
      const updatedView = await viewApplicationService.updateView(nextView)
      setViews((current) =>
        current.map((candidate) =>
          candidate.id === updatedView.id ? updatedView : candidate,
        ),
      )
      setStatus('ready')
    } catch (error) {
      setViews((current) =>
        current.map((candidate) =>
          candidate.id === view.id ? view : candidate,
        ),
      )
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const handleDeleteView = async (view: DatabaseView) => {
    if (
      status !== 'ready' ||
      views.length <= 1 ||
      !window.confirm(`“${view.name}” View를 삭제할까요?`)
    ) {
      return
    }
    setStatus('updating-view')
    setErrorMessage(null)
    try {
      await viewApplicationService.deleteView(view.id)
      const remainingViews = views.filter(
        (candidate) => candidate.id !== view.id,
      )
      setViews(remainingViews)
      setSelectedViewId(remainingViews[0]?.id ?? null)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(messageFromError(error))
      setStatus('ready')
    }
  }

  const isMutating =
    status === 'creating-database' ||
    status === 'creating-item' ||
    status === 'deleting' ||
    status === 'updating-property' ||
    status === 'updating-view'

  return (
    <section className="document-content min-h-0 flex-1 overflow-y-auto bg-stone-50/40 px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-[var(--ui-surface)] px-3 py-1.5 text-xs font-medium text-stone-600">
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
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-[var(--ui-surface)] p-4 shadow-sm sm:flex-row"
            onSubmit={(event) => void handleCreateDatabase(event)}
          >
            <label className="sr-only" htmlFor="database-name">
              새 데이터베이스 이름
            </label>
            <input
              autoFocus
              className="h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-[var(--ui-surface)] px-3 text-sm transition outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
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
          <aside className="rounded-2xl border border-stone-200 bg-[var(--ui-surface)] p-3 shadow-sm">
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
                        ? 'bg-stone-950 font-medium text-[var(--ui-surface)]'
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

          <div className="min-w-0 rounded-2xl border border-stone-200 bg-[var(--ui-surface)] shadow-sm">
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
                  <div className="flex gap-2">
                    <div
                      aria-label="데이터베이스 보기"
                      className="flex rounded-lg border border-[var(--ui-border)] bg-[var(--ui-sidebar)] p-0.5"
                      role="group"
                    >
                      <button
                        aria-label="테이블 보기"
                        aria-pressed={selectedView?.type === 'table'}
                        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${
                          selectedView?.type === 'table'
                            ? 'bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm'
                            : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
                        }`}
                        disabled={isMutating || !selectedView}
                        onClick={() =>
                          selectedView
                            ? void handleUpdateView(selectedView, {
                                type: 'table',
                              })
                            : undefined
                        }
                        type="button"
                      >
                        <Table2 aria-hidden="true" className="size-3.5" />
                        테이블
                      </button>
                      <button
                        aria-label="칸반 보기"
                        aria-pressed={selectedView?.type === 'kanban'}
                        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition ${
                          selectedView?.type === 'kanban'
                            ? 'bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm'
                            : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'
                        }`}
                        disabled={isMutating || !selectedView}
                        onClick={() =>
                          selectedView
                            ? void handleUpdateView(selectedView, {
                                type: 'kanban',
                              })
                            : undefined
                        }
                        type="button"
                      >
                        <LayoutDashboard
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        칸반
                      </button>
                    </div>
                    <Button
                      aria-expanded={showSchemaManager}
                      disabled={isMutating}
                      onClick={() =>
                        setShowSchemaManager((visible) => !visible)
                      }
                      size="sm"
                      variant="outline"
                    >
                      <Settings2 aria-hidden="true" className="size-4" />
                      속성
                    </Button>
                    <Button
                      disabled={isMutating}
                      onClick={() => setShowItemForm((visible) => !visible)}
                      size="sm"
                    >
                      <FilePlus2 aria-hidden="true" className="size-4" />새 항목
                    </Button>
                  </div>
                </div>

                {showSchemaManager ? (
                  <SchemaPropertyManager
                    database={selectedDatabase}
                    onChange={(schema) =>
                      setDatabases((current) =>
                        current.map((database) =>
                          database.id === schema.id ? schema : database,
                        ),
                      )
                    }
                  />
                ) : null}

                {selectedView ? (
                  <DatabaseViewToolbar
                    database={selectedDatabase}
                    disabled={isMutating}
                    onCreate={handleCreateView}
                    onDelete={handleDeleteView}
                    onSelect={setSelectedViewId}
                    onUpdate={handleUpdateView}
                    selectedView={selectedView}
                    views={views}
                  />
                ) : null}

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
                      className="h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-[var(--ui-surface)] px-3 text-sm transition outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
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
                ) : !selectedView ? (
                  <div className="grid min-h-72 place-items-center text-sm text-stone-500">
                    View를 준비하는 중입니다.
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
                ) : selectedView.type === 'kanban' ? (
                  <KanbanBoard
                    database={selectedDatabase}
                    disabled={isMutating}
                    groupById={selectedView.groupBy}
                    items={displayedItems}
                    key={`kanban:${selectedView.id}:${JSON.stringify(
                      selectedView,
                    )}:${JSON.stringify(selectedDatabase.properties)}`}
                    onGroupByChange={(groupBy) =>
                      handleUpdateView(selectedView, { groupBy })
                    }
                    onMoveItem={handleUpdateProperty}
                    onOpenItem={onOpenItem}
                  />
                ) : (
                  <DatabaseTable
                    database={selectedDatabase}
                    disabled={isMutating}
                    items={displayedItems}
                    key={`table:${selectedView.id}:${JSON.stringify(
                      selectedDatabase.properties,
                    )}`}
                    onDeleteItem={handleDeleteItem}
                    onOpenItem={onOpenItem}
                    onUpdateProperty={handleUpdateProperty}
                    onViewChange={(patch) =>
                      handleUpdateView(selectedView, patch)
                    }
                    view={selectedView}
                  />
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
