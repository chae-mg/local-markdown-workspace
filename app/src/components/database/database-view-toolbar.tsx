import {
  ArrowDownAZ,
  Filter,
  LayoutDashboard,
  Plus,
  Settings2,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import type { DatabaseSchema, PropertyDefinition } from '@/domain/database'
import {
  activeViewProperties,
  titleViewPropertyId,
  type DatabaseView,
  type DatabaseViewType,
  type FilterDefinition,
  type FilterOperator,
  type SortDirection,
} from '@/domain/database-view'
import type { MarkdownValue } from '@/domain/markdown'

interface DatabaseViewToolbarProps {
  database: DatabaseSchema
  disabled?: boolean
  onCreate(name: string, type: DatabaseViewType): Promise<void> | void
  onDelete(view: DatabaseView): Promise<void> | void
  onSelect(viewId: string): void
  onUpdate(
    view: DatabaseView,
    patch: Partial<DatabaseView>,
  ): Promise<void> | void
  selectedView: DatabaseView
  views: DatabaseView[]
}

const operatorNames: Record<FilterOperator, string> = {
  equals: '같음',
  not_equals: '같지 않음',
  contains: '포함',
  is_empty: '비어 있음',
  is_not_empty: '비어 있지 않음',
  gt: '초과',
  gte: '이상',
  lt: '미만',
  lte: '이하',
  is_true: '체크됨',
  is_false: '체크 안 됨',
  before: '이전',
  after: '이후',
}

function operatorsFor(property: PropertyDefinition | null): FilterOperator[] {
  if (
    !property ||
    property.type === 'text' ||
    property.type === 'multi_select'
  ) {
    return ['contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty']
  }
  switch (property.type) {
    case 'number':
      return [
        'equals',
        'not_equals',
        'gt',
        'gte',
        'lt',
        'lte',
        'is_empty',
        'is_not_empty',
      ]
    case 'select':
      return ['equals', 'not_equals', 'is_empty', 'is_not_empty']
    case 'checkbox':
      return ['is_true', 'is_false']
    case 'date':
      return ['equals', 'before', 'after', 'is_empty', 'is_not_empty']
  }
}

function needsFilterValue(operator: FilterOperator) {
  return !['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator)
}

function displayPropertyName(database: DatabaseSchema, propertyId: string) {
  return propertyId === titleViewPropertyId
    ? '이름'
    : (database.properties[propertyId as keyof typeof database.properties]
        ?.name ?? '삭제된 속성')
}

function filterDisplayValue(
  database: DatabaseSchema,
  filter: FilterDefinition,
) {
  if (!needsFilterValue(filter.operator)) {
    return ''
  }
  const property =
    database.properties[filter.propertyId as keyof typeof database.properties]
  if (property?.type === 'select' || property?.type === 'multi_select') {
    return (
      property.options.find((option) => option.id === filter.value)?.name ??
      String(filter.value ?? '')
    )
  }
  return String(filter.value ?? '')
}

export function DatabaseViewToolbar({
  database,
  disabled = false,
  onCreate,
  onDelete,
  onSelect,
  onUpdate,
  selectedView,
  views,
}: DatabaseViewToolbarProps) {
  const properties = useMemo(() => activeViewProperties(database), [database])
  const filterableProperties = useMemo(
    () => [
      { id: titleViewPropertyId, name: '이름', property: null },
      ...properties.map((property) => ({
        id: property.id,
        name: property.name,
        property,
      })),
    ],
    [properties],
  )
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [newViewType, setNewViewType] = useState<DatabaseViewType>('table')
  const [renameDraft, setRenameDraft] = useState(selectedView.name)
  const [filterPropertyId, setFilterPropertyId] = useState(titleViewPropertyId)
  const [filterOperator, setFilterOperator] =
    useState<FilterOperator>('contains')
  const [filterValue, setFilterValue] = useState('')
  const [sortPropertyId, setSortPropertyId] = useState(titleViewPropertyId)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const selectedFilterProperty =
    filterableProperties.find((property) => property.id === filterPropertyId)
      ?.property ?? null
  const availableOperators = operatorsFor(selectedFilterProperty)

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!newViewName.trim() || disabled) {
      return
    }
    await onCreate(newViewName, newViewType)
    setNewViewName('')
    setShowCreate(false)
  }

  const handleRename = (event: FormEvent) => {
    event.preventDefault()
    if (!renameDraft.trim() || renameDraft.trim() === selectedView.name) {
      return
    }
    void onUpdate(selectedView, { name: renameDraft })
  }

  const handleFilterPropertyChange = (propertyId: string) => {
    const property =
      filterableProperties.find((candidate) => candidate.id === propertyId)
        ?.property ?? null
    setFilterPropertyId(propertyId)
    setFilterOperator(operatorsFor(property)[0])
    setFilterValue('')
  }

  const addFilter = () => {
    if (needsFilterValue(filterOperator) && filterValue === '') {
      return
    }
    let value: MarkdownValue | undefined = filterValue
    if (selectedFilterProperty?.type === 'number') {
      const numericValue = Number(filterValue)
      if (!Number.isFinite(numericValue)) {
        return
      }
      value = numericValue
    }
    const filter: FilterDefinition = {
      propertyId: filterPropertyId,
      operator: filterOperator,
      ...(needsFilterValue(filterOperator) ? { value } : {}),
    }
    void onUpdate(selectedView, {
      filters: [...selectedView.filters, filter],
    })
    setFilterValue('')
  }

  const addSort = () => {
    const sorts = selectedView.sorts.filter(
      (sort) => sort.propertyId !== sortPropertyId,
    )
    void onUpdate(selectedView, {
      sorts: [
        ...sorts,
        { propertyId: sortPropertyId, direction: sortDirection },
      ],
    })
  }

  return (
    <div className="border-b border-[var(--ui-border)] bg-[var(--ui-sidebar)]/70">
      <div className="flex min-h-11 items-center gap-1 overflow-x-auto px-3">
        {views.map((view) => {
          const Icon = view.type === 'kanban' ? LayoutDashboard : Table2
          return (
            <button
              aria-pressed={view.id === selectedView.id}
              className={`flex h-8 max-w-44 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                view.id === selectedView.id
                  ? 'bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-sm'
                  : 'text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]'
              }`}
              disabled={disabled}
              key={view.id}
              onClick={() => {
                onSelect(view.id)
                setRenameDraft(view.name)
              }}
              type="button"
            >
              <Icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{view.name}</span>
            </button>
          )
        })}
        <button
          aria-label="새 View 추가"
          className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--ui-muted)] hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)]"
          disabled={disabled}
          onClick={() => setShowCreate((visible) => !visible)}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <div className="ml-auto shrink-0">
          <Button
            aria-expanded={showSettings}
            disabled={disabled}
            onClick={() => {
              setRenameDraft(selectedView.name)
              setShowSettings((visible) => !visible)
            }}
            size="sm"
            variant="outline"
          >
            <Settings2 aria-hidden="true" className="size-3.5" />
            View 설정
          </Button>
        </div>
      </div>

      {showCreate ? (
        <form
          className="flex flex-col gap-2 border-t border-[var(--ui-border)] px-4 py-3 sm:flex-row"
          onSubmit={(event) => void handleCreate(event)}
        >
          <input
            aria-label="새 View 이름"
            autoFocus
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm outline-none focus:border-[var(--ui-accent)]"
            disabled={disabled}
            onChange={(event) => setNewViewName(event.target.value)}
            placeholder="예: 진행 상황"
            value={newViewName}
          />
          <select
            aria-label="새 View 타입"
            className="h-9 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm"
            disabled={disabled}
            onChange={(event) =>
              setNewViewType(event.target.value as DatabaseViewType)
            }
            value={newViewType}
          >
            <option value="table">Table</option>
            <option value="kanban">Kanban</option>
          </select>
          <Button
            disabled={!newViewName.trim() || disabled}
            size="sm"
            type="submit"
          >
            생성
          </Button>
          <Button
            onClick={() => setShowCreate(false)}
            size="sm"
            variant="outline"
          >
            취소
          </Button>
        </form>
      ) : null}

      {showSettings ? (
        <div className="space-y-4 border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <form className="flex min-w-0 flex-1 gap-2" onSubmit={handleRename}>
              <label className="min-w-0 flex-1 text-xs font-medium text-[var(--ui-muted)]">
                View 이름
                <input
                  aria-label="View 이름 변경"
                  className="mt-1 h-9 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
                  disabled={disabled}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  value={renameDraft}
                />
              </label>
              <Button
                className="self-end"
                disabled={
                  disabled ||
                  !renameDraft.trim() ||
                  renameDraft.trim() === selectedView.name
                }
                size="sm"
                type="submit"
              >
                저장
              </Button>
            </form>
            <Button
              className="self-end"
              disabled={disabled || views.length <= 1}
              onClick={() => void onDelete(selectedView)}
              size="sm"
              variant="outline"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
              View 삭제
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-[var(--ui-border)] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
                <Filter aria-hidden="true" className="size-3.5" />
                필터
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="필터 속성"
                  className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs"
                  disabled={disabled}
                  onChange={(event) =>
                    handleFilterPropertyChange(event.target.value)
                  }
                  value={filterPropertyId}
                >
                  {filterableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="필터 조건"
                  className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs"
                  disabled={disabled}
                  onChange={(event) =>
                    setFilterOperator(event.target.value as FilterOperator)
                  }
                  value={filterOperator}
                >
                  {availableOperators.map((operator) => (
                    <option key={operator} value={operator}>
                      {operatorNames[operator]}
                    </option>
                  ))}
                </select>
                {needsFilterValue(filterOperator) ? (
                  selectedFilterProperty?.type === 'select' ? (
                    <select
                      aria-label="필터 값"
                      className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs"
                      disabled={disabled}
                      onChange={(event) => setFilterValue(event.target.value)}
                      value={filterValue}
                    >
                      <option value="">Option 선택</option>
                      {selectedFilterProperty.options
                        .filter((option) => !option.deleted)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      aria-label="필터 값"
                      className="h-8 min-w-28 flex-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs outline-none focus:border-[var(--ui-accent)]"
                      disabled={disabled}
                      onChange={(event) => setFilterValue(event.target.value)}
                      type={
                        selectedFilterProperty?.type === 'number'
                          ? 'number'
                          : selectedFilterProperty?.type === 'date'
                            ? 'date'
                            : 'text'
                      }
                      value={filterValue}
                    />
                  )
                ) : null}
                <Button
                  disabled={
                    disabled ||
                    (needsFilterValue(filterOperator) && filterValue === '')
                  }
                  onClick={addFilter}
                  size="sm"
                  variant="outline"
                >
                  추가
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedView.filters.length === 0 ? (
                  <span className="text-xs text-[var(--ui-faint)]">
                    모든 항목을 표시합니다.
                  </span>
                ) : (
                  selectedView.filters.map((filter, index) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-active)] py-1 pr-1 pl-2.5 text-[11px]"
                      key={`${filter.propertyId}:${filter.operator}:${index}`}
                    >
                      {displayPropertyName(database, filter.propertyId)}{' '}
                      {operatorNames[filter.operator]}{' '}
                      {filterDisplayValue(database, filter)}
                      <button
                        aria-label={`${displayPropertyName(database, filter.propertyId)} 필터 제거`}
                        className="grid size-5 place-items-center rounded-full hover:bg-[var(--ui-hover)]"
                        disabled={disabled}
                        onClick={() =>
                          void onUpdate(selectedView, {
                            filters: selectedView.filters.filter(
                              (_, candidateIndex) => candidateIndex !== index,
                            ),
                          })
                        }
                        type="button"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[var(--ui-border)] p-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
                <ArrowDownAZ aria-hidden="true" className="size-3.5" />
                정렬
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="정렬 속성"
                  className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs"
                  disabled={disabled}
                  onChange={(event) => setSortPropertyId(event.target.value)}
                  value={sortPropertyId}
                >
                  {filterableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="정렬 방향"
                  className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs"
                  disabled={disabled}
                  onChange={(event) =>
                    setSortDirection(event.target.value as SortDirection)
                  }
                  value={sortDirection}
                >
                  <option value="asc">오름차순</option>
                  <option value="desc">내림차순</option>
                </select>
                <Button
                  disabled={disabled}
                  onClick={addSort}
                  size="sm"
                  variant="outline"
                >
                  추가
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selectedView.sorts.length === 0 ? (
                  <span className="text-xs text-[var(--ui-faint)]">
                    별도 정렬이 없습니다.
                  </span>
                ) : (
                  selectedView.sorts.map((sort) => (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--ui-active)] py-1 pr-1 pl-2.5 text-[11px]"
                      key={sort.propertyId}
                    >
                      {displayPropertyName(database, sort.propertyId)} ·{' '}
                      {sort.direction === 'asc' ? '오름차순' : '내림차순'}
                      <button
                        aria-label={`${displayPropertyName(database, sort.propertyId)} 정렬 제거`}
                        className="grid size-5 place-items-center rounded-full hover:bg-[var(--ui-hover)]"
                        disabled={disabled}
                        onClick={() =>
                          void onUpdate(selectedView, {
                            sorts: selectedView.sorts.filter(
                              (candidate) =>
                                candidate.propertyId !== sort.propertyId,
                            ),
                          })
                        }
                        type="button"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
