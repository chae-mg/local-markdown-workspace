import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Columns3,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import type {
  DatabaseItem,
  DatabaseSchema,
  PropertyDefinition,
  SelectOptionId,
} from '@/domain/database'
import type { MarkdownValue } from '@/domain/markdown'

interface DatabaseTableProps {
  database: DatabaseSchema
  disabled?: boolean
  items: DatabaseItem[]
  onDeleteItem(item: DatabaseItem): Promise<void> | void
  onOpenItem(path: string): Promise<void> | void
  onUpdateProperty(
    item: DatabaseItem,
    property: PropertyDefinition,
    value: MarkdownValue | undefined,
  ): Promise<void> | void
}

const features = tableFeatures({
  columnOrderingFeature,
  columnVisibilityFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, DatabaseItem>()
const fixedColumnIds = new Set(['selection', 'title', 'actions'])

function activeProperties(database: DatabaseSchema) {
  return Object.values(database.properties)
    .filter((property) => !property.deleted)
    .sort((left, right) => left.order - right.order)
}

function propertySearchValue(item: DatabaseItem, property: PropertyDefinition) {
  const value = item.properties[property.id]
  if (property.type === 'select' || property.type === 'multi_select') {
    const optionNames = new Map(
      property.options.map((option) => [option.id, option.name]),
    )
    const values = Array.isArray(value) ? value : [value]
    return values
      .filter((candidate): candidate is string => typeof candidate === 'string')
      .map(
        (candidate) =>
          optionNames.get(candidate as SelectOptionId) ?? candidate,
      )
      .join(', ')
  }
  if (typeof value === 'boolean') {
    return value ? '완료 true 체크' : '미완료 false'
  }
  if (property.type === 'number' && typeof value === 'number') {
    return value
  }
  return typeof value === 'string' ? value : ''
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange(event: unknown): void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      aria-label={label}
      checked={checked}
      className="size-4 accent-[var(--ui-accent)]"
      onChange={onChange}
      ref={ref}
      type="checkbox"
    />
  )
}

function TextCell({ disabled, item, onCommit, property }: CellEditorProps) {
  const currentValue = item.properties[property.id]
  const initialValue = typeof currentValue === 'string' ? currentValue : ''
  const [draft, setDraft] = useState(initialValue)

  const commit = () => {
    if (draft === initialValue) {
      return
    }
    void onCommit(draft === '' ? undefined : draft)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      setDraft(initialValue)
      event.currentTarget.blur()
    }
  }

  return (
    <input
      aria-label={`${item.title} ${property.name}`}
      className="h-8 w-full min-w-32 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-[var(--ui-border)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-surface)]"
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="비어 있음"
      value={draft}
    />
  )
}

function NumberCell({ disabled, item, onCommit, property }: CellEditorProps) {
  const currentValue = item.properties[property.id]
  const initialValue =
    typeof currentValue === 'number' ? String(currentValue) : ''
  const [draft, setDraft] = useState(initialValue)

  const commit = () => {
    if (draft === initialValue) {
      return
    }
    const value = draft === '' ? undefined : Number(draft)
    if (value === undefined || Number.isFinite(value)) {
      void onCommit(value)
    }
  }

  return (
    <input
      aria-label={`${item.title} ${property.name}`}
      className="h-8 w-full min-w-28 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-[var(--ui-border)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-surface)]"
      disabled={disabled}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          setDraft(initialValue)
          event.currentTarget.blur()
        }
      }}
      placeholder="비어 있음"
      step="any"
      type="number"
      value={draft}
    />
  )
}

function SelectCell({ disabled, item, onCommit, property }: CellEditorProps) {
  if (property.type !== 'select') {
    return null
  }
  const currentValue = item.properties[property.id]
  const value = typeof currentValue === 'string' ? currentValue : ''
  const activeOptions = property.options.filter((option) => !option.deleted)
  const currentOption = property.options.find((option) => option.id === value)

  return (
    <select
      aria-label={`${item.title} ${property.name}`}
      className="h-8 min-w-32 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-[var(--ui-border)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-surface)]"
      disabled={disabled}
      onChange={(event) =>
        void onCommit(
          event.target.value === '' ? undefined : event.target.value,
        )
      }
      value={value}
    >
      <option value="">비어 있음</option>
      {currentOption?.deleted ? (
        <option disabled value={currentOption.id}>
          {currentOption.name} (삭제됨)
        </option>
      ) : null}
      {activeOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

function MultiSelectCell({
  disabled,
  item,
  onCommit,
  property,
}: CellEditorProps) {
  if (property.type !== 'multi_select') {
    return null
  }
  const currentValue = item.properties[property.id]
  const selectedIds = new Set(
    Array.isArray(currentValue)
      ? currentValue.filter(
          (candidate): candidate is string => typeof candidate === 'string',
        )
      : [],
  )
  const activeOptionIds = new Set<string>(
    property.options
      .filter((option) => !option.deleted)
      .map((option) => option.id),
  )
  const displayedOptions = property.options.filter(
    (option) => !option.deleted || selectedIds.has(option.id),
  )
  const selectedNames = property.options
    .filter((option) => selectedIds.has(option.id))
    .map((option) => `${option.name}${option.deleted ? ' (삭제됨)' : ''}`)

  return (
    <details className="relative min-w-40">
      <summary className="flex h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-transparent px-2 text-sm hover:border-[var(--ui-border)]">
        <span className="max-w-36 truncate text-left">
          {selectedNames.length > 0 ? selectedNames.join(', ') : '비어 있음'}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </summary>
      <div className="absolute top-9 left-0 z-20 grid min-w-48 gap-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-lg">
        {displayedOptions.length === 0 ? (
          <span className="px-2 py-1 text-xs text-[var(--ui-muted)]">
            사용 가능한 옵션이 없습니다.
          </span>
        ) : (
          displayedOptions.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-[var(--ui-hover)]"
              key={option.id}
            >
              <input
                aria-label={`${item.title} ${property.name} ${option.name}`}
                checked={selectedIds.has(option.id)}
                className="size-4 accent-[var(--ui-accent)]"
                disabled={disabled}
                onChange={(event) => {
                  const next = new Set(
                    [...selectedIds].filter((id) => activeOptionIds.has(id)),
                  )
                  if (event.target.checked && !option.deleted) {
                    next.add(option.id)
                  } else {
                    next.delete(option.id)
                  }
                  void onCommit(next.size === 0 ? undefined : [...next])
                }}
                type="checkbox"
              />
              {option.name}
              {option.deleted ? ' (삭제됨)' : ''}
            </label>
          ))
        )}
      </div>
    </details>
  )
}

function CheckboxCell({ disabled, item, onCommit, property }: CellEditorProps) {
  return (
    <label className="flex min-w-24 items-center gap-2 px-2 text-xs text-[var(--ui-muted)]">
      <input
        aria-label={`${item.title} ${property.name}`}
        checked={item.properties[property.id] === true}
        className="size-4 accent-[var(--ui-accent)]"
        disabled={disabled}
        onChange={(event) => void onCommit(event.target.checked)}
        type="checkbox"
      />
      {item.properties[property.id] === true ? '완료' : '미완료'}
    </label>
  )
}

function DateCell({ disabled, item, onCommit, property }: CellEditorProps) {
  const currentValue = item.properties[property.id]
  const value = typeof currentValue === 'string' ? currentValue : ''
  return (
    <input
      aria-label={`${item.title} ${property.name}`}
      className="h-8 min-w-36 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-[var(--ui-border)] focus:border-[var(--ui-accent)] focus:bg-[var(--ui-surface)]"
      disabled={disabled}
      onChange={(event) =>
        void onCommit(
          event.target.value === '' ? undefined : event.target.value,
        )
      }
      type="date"
      value={value}
    />
  )
}

interface CellEditorProps {
  disabled?: boolean
  item: DatabaseItem
  onCommit(value: MarkdownValue | undefined): Promise<void> | void
  property: PropertyDefinition
}

function PropertyCell(props: CellEditorProps) {
  const editorKey = `${props.item.id}:${props.property.id}:${JSON.stringify(
    props.item.properties[props.property.id],
  )}`
  switch (props.property.type) {
    case 'text':
      return <TextCell {...props} key={editorKey} />
    case 'number':
      return <NumberCell {...props} key={editorKey} />
    case 'select':
      return <SelectCell {...props} />
    case 'multi_select':
      return <MultiSelectCell {...props} />
    case 'checkbox':
      return <CheckboxCell {...props} />
    case 'date':
      return <DateCell {...props} />
  }
}

export function DatabaseTable({
  database,
  disabled = false,
  items,
  onDeleteItem,
  onOpenItem,
  onUpdateProperty,
}: DatabaseTableProps) {
  const properties = useMemo(() => activeProperties(database), [database])
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: 'selection',
          enableHiding: false,
          cell: ({ row }) => (
            <SelectionCheckbox
              checked={row.getIsSelected()}
              label={`${row.original.title} 선택`}
              onChange={row.getToggleSelectedHandler()}
            />
          ),
          header: ({ table }) => (
            <SelectionCheckbox
              checked={table.getIsAllRowsSelected()}
              indeterminate={
                table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
              }
              label="모든 행 선택"
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
          ),
        }),
        columnHelper.accessor('title', {
          id: 'title',
          enableHiding: false,
          header: '이름',
          cell: ({ row }) => (
            <button
              aria-label={`${row.original.title} Markdown 열기`}
              className="flex min-w-48 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium outline-none hover:bg-[var(--ui-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
              onClick={() => void onOpenItem(row.original.path)}
              type="button"
            >
              <span className="max-w-56 truncate">{row.original.title}</span>
              <ExternalLink
                aria-hidden="true"
                className="size-3.5 shrink-0 text-[var(--ui-faint)]"
              />
            </button>
          ),
        }),
        ...properties.map((property) =>
          columnHelper.accessor((item) => propertySearchValue(item, property), {
            id: property.id,
            header: property.name,
            cell: ({ row }) => (
              <PropertyCell
                disabled={disabled}
                item={row.original}
                onCommit={(value) =>
                  onUpdateProperty(row.original, property, value)
                }
                property={property}
              />
            ),
          }),
        ),
        columnHelper.display({
          id: 'actions',
          enableHiding: false,
          cell: ({ row }) => (
            <button
              aria-label={`${row.original.title} 휴지통으로 이동`}
              className="grid size-8 place-items-center rounded-md text-[var(--ui-faint)] hover:bg-[var(--ui-danger-soft)] hover:text-[var(--ui-danger)]"
              disabled={disabled}
              onClick={() => void onDeleteItem(row.original)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          ),
          header: '',
        }),
      ]),
    [disabled, onDeleteItem, onOpenItem, onUpdateProperty, properties],
  )
  const initialColumnOrder = useMemo(
    () => [
      'selection',
      'title',
      ...properties.map((property) => property.id),
      'actions',
    ],
    [properties],
  )
  const table = useTable({
    columns,
    data: items,
    features,
    getRowId: (item) => item.id,
    initialState: { columnOrder: initialColumnOrder },
  })
  const selectedCount = table.getSelectedRowModel().rows.length
  const filteredRows = table.getRowModel().rows
  const reorderableColumns = table.state.columnOrder
    .map((columnId) => table.getColumn(columnId))
    .filter(
      (column): column is NonNullable<typeof column> =>
        column !== undefined && !fixedColumnIds.has(column.id),
    )

  const moveColumn = (columnId: string, direction: -1 | 1) => {
    const order = [...table.state.columnOrder]
    const currentIndex = order.indexOf(columnId)
    const propertyIndexes = order
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !fixedColumnIds.has(id))
    const propertyIndex = propertyIndexes.findIndex(({ id }) => id === columnId)
    const target = propertyIndexes[propertyIndex + direction]
    if (currentIndex < 0 || !target) {
      return
    }
    ;[order[currentIndex], order[target.index]] = [
      order[target.index],
      order[currentIndex],
    ]
    table.setColumnOrder(order)
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-[var(--ui-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--ui-faint)]"
          />
          <input
            aria-label="테이블 필터"
            className="h-9 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] pr-3 pl-8 text-sm outline-none focus:border-[var(--ui-accent)]"
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder="항목과 속성 검색"
            value={(table.state.globalFilter as string | undefined) ?? ''}
          />
        </label>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-xs text-[var(--ui-muted)]">
            {filteredRows.length}개 행
            {selectedCount > 0 ? ` · ${selectedCount}개 선택` : ''}
          </span>
          {selectedCount > 0 ? (
            <Button
              onClick={() => table.resetRowSelection(true)}
              size="sm"
              variant="outline"
            >
              선택 해제
            </Button>
          ) : null}
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[var(--ui-border)] px-2.5 text-xs font-medium hover:bg-[var(--ui-hover)]">
              <Columns3 aria-hidden="true" className="size-3.5" />열
              <ChevronDown aria-hidden="true" className="size-3" />
            </summary>
            <div className="absolute top-9 right-0 z-30 w-64 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-xl">
              <p className="px-2 py-1 text-[11px] font-semibold text-[var(--ui-muted)]">
                열 표시 및 순서
              </p>
              {reorderableColumns.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--ui-muted)]">
                  먼저 속성을 추가해 주세요.
                </p>
              ) : (
                reorderableColumns.map((column, index) => (
                  <div
                    className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[var(--ui-hover)]"
                    key={column.id}
                  >
                    <input
                      aria-label={`${String(column.columnDef.header)} 열 표시`}
                      checked={column.getIsVisible()}
                      className="size-4 accent-[var(--ui-accent)]"
                      onChange={column.getToggleVisibilityHandler()}
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {String(column.columnDef.header)}
                    </span>
                    <button
                      aria-label={`${String(column.columnDef.header)} 열 왼쪽으로`}
                      className="grid size-6 place-items-center rounded text-[var(--ui-muted)] hover:bg-[var(--ui-active)] disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => moveColumn(column.id, -1)}
                      type="button"
                    >
                      <ArrowLeft aria-hidden="true" className="size-3" />
                    </button>
                    <button
                      aria-label={`${String(column.columnDef.header)} 열 오른쪽으로`}
                      className="grid size-6 place-items-center rounded text-[var(--ui-muted)] hover:bg-[var(--ui-active)] disabled:opacity-30"
                      disabled={index === reorderableColumns.length - 1}
                      onClick={() => moveColumn(column.id, 1)}
                      type="button"
                    >
                      <ArrowRight aria-hidden="true" className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </details>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[var(--ui-sidebar)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : 'none'
                      }
                      className="h-10 border-r border-b border-[var(--ui-border)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ui-muted)] last:border-r-0"
                      key={header.id}
                      scope="col"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:text-[var(--ui-text)]"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp aria-hidden="true" className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown aria-hidden="true" className="size-3" />
                          ) : (
                            <ArrowUpDown
                              aria-hidden="true"
                              className="size-3 text-[var(--ui-faint)]"
                            />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  className="h-32 text-center text-sm text-[var(--ui-muted)]"
                  colSpan={table.getVisibleLeafColumns().length}
                >
                  검색 조건에 맞는 항목이 없습니다.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  className={`border-b border-[var(--ui-border)] last:border-b-0 ${
                    row.getIsSelected() ? 'bg-[var(--ui-accent-soft)]' : ''
                  }`}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      className="h-11 border-r border-[var(--ui-border)] px-2 last:border-r-0"
                      key={cell.id}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
