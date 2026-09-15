import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { ExternalLink, GripVertical, LayoutDashboard } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'

import {
  groupKanbanItems,
  kanbanColumnId,
  optionIdFromKanbanColumn,
} from '@/components/database/kanban-model'
import type {
  DatabaseItem,
  DatabaseSchema,
  SelectOption,
  SelectPropertyDefinition,
} from '@/domain/database'
import type { MarkdownValue } from '@/domain/markdown'

interface KanbanColumn {
  id: string
  option?: SelectOption
  title: string
}

interface KanbanBoardProps {
  database: DatabaseSchema
  disabled?: boolean
  groupById?: string
  items: DatabaseItem[]
  onGroupByChange?(propertyId: string): Promise<void> | void
  onMoveItem(
    item: DatabaseItem,
    property: SelectPropertyDefinition,
    value: MarkdownValue | undefined,
  ): Promise<void> | void
  onOpenItem(path: string): Promise<void> | void
}

function KanbanCardPreview({ item }: { item: DatabaseItem }) {
  return (
    <div className="w-64 rotate-2 rounded-xl border border-[var(--ui-accent)] bg-[var(--ui-surface)] px-3 py-3 shadow-xl">
      <p className="truncate text-sm font-medium">{item.title}</p>
    </div>
  )
}

function KanbanCard({
  disabled,
  item,
  onOpenItem,
}: {
  disabled: boolean
  item: DatabaseItem
  onOpenItem(path: string): Promise<void> | void
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      disabled,
      id: item.id,
    })
  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <article
      className={`group rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-30' : ''
      }`}
      ref={setNodeRef}
      style={style}
    >
      <div className="flex items-start gap-1 p-2.5">
        <button
          aria-label={`${item.title} Markdown 열기`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm font-medium outline-none hover:bg-[var(--ui-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
          onClick={() => void onOpenItem(item.path)}
          type="button"
        >
          <span className="truncate">{item.title}</span>
          <ExternalLink
            aria-hidden="true"
            className="size-3.5 shrink-0 text-[var(--ui-faint)]"
          />
        </button>
        <button
          aria-label={`${item.title} 카드 이동`}
          className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-[var(--ui-faint)] outline-none hover:bg-[var(--ui-hover)] hover:text-[var(--ui-text)] focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
      </div>
    </article>
  )
}

function KanbanColumnView({
  column,
  disabled,
  items,
  onOpenItem,
}: {
  column: KanbanColumn
  disabled: boolean
  items: DatabaseItem[]
  onOpenItem(path: string): Promise<void> | void
}) {
  const { isOver, setNodeRef } = useDroppable({
    disabled,
    id: column.id,
  })

  return (
    <section
      aria-label={`${column.title} 칸반 열`}
      className={`flex min-h-72 w-72 shrink-0 flex-col rounded-xl border p-2 transition-colors ${
        isOver
          ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]'
          : 'border-[var(--ui-border)] bg-[var(--ui-sidebar)]'
      }`}
      ref={setNodeRef}
    >
      <header className="flex items-center justify-between gap-2 px-1.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${
              column.option
                ? 'bg-[var(--ui-accent)]'
                : 'border border-[var(--ui-faint)] bg-transparent'
            }`}
          />
          <h3 className="truncate text-xs font-semibold">{column.title}</h3>
        </div>
        <span className="rounded-full bg-[var(--ui-active)] px-2 py-0.5 text-[11px] text-[var(--ui-muted)] tabular-nums">
          {items.length}
        </span>
      </header>
      <div className="mt-1 flex flex-1 flex-col gap-2">
        {items.map((item) => (
          <KanbanCard
            disabled={disabled}
            item={item}
            key={item.id}
            onOpenItem={onOpenItem}
          />
        ))}
        {items.length === 0 ? (
          <div className="grid min-h-20 flex-1 place-items-center rounded-lg border border-dashed border-[var(--ui-border)] px-3 text-center text-xs text-[var(--ui-faint)]">
            여기에 카드를 놓으세요
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function KanbanBoard({
  database,
  disabled = false,
  groupById: configuredGroupById,
  items,
  onGroupByChange,
  onMoveItem,
  onOpenItem,
}: KanbanBoardProps) {
  const selectProperties = useMemo(
    () =>
      Object.values(database.properties)
        .filter(
          (property): property is SelectPropertyDefinition =>
            !property.deleted && property.type === 'select',
        )
        .sort((left, right) => left.order - right.order),
    [database],
  )
  const [groupById, setGroupById] = useState<string>(
    selectProperties.some((property) => property.id === configuredGroupById)
      ? (configuredGroupById ?? '')
      : (selectProperties[0]?.id ?? ''),
  )
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  const groupBy = selectProperties.find((property) => property.id === groupById)
  const columns = useMemo<KanbanColumn[]>(
    () =>
      groupBy
        ? [
            { id: kanbanColumnId(), title: '미지정' },
            ...groupBy.options
              .filter((option) => !option.deleted)
              .map((option) => ({
                id: kanbanColumnId(option.id),
                option,
                title: option.name,
              })),
          ]
        : [],
    [groupBy],
  )
  const groupedItems = useMemo(
    () => (groupBy ? groupKanbanItems(items, groupBy) : new Map()),
    [groupBy, items],
  )
  const activeItem = items.find((item) => item.id === activeItemId) ?? null

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveItemId(String(active.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveItemId(null)
    if (!groupBy || !over) {
      return
    }
    const item = items.find((candidate) => candidate.id === String(active.id))
    const optionId = optionIdFromKanbanColumn(String(over.id))
    if (!item || optionId === null) {
      return
    }
    const currentValue = item.properties[groupBy.id]
    if (currentValue === optionId || (!currentValue && !optionId)) {
      return
    }
    void onMoveItem(item, groupBy, optionId)
  }

  if (!groupBy) {
    return (
      <div className="grid min-h-72 place-items-center px-5 text-center">
        <div>
          <LayoutDashboard
            aria-hidden="true"
            className="mx-auto size-8 text-[var(--ui-faint)]"
            strokeWidth={1.5}
          />
          <p className="mt-3 text-sm font-medium">
            칸반에 사용할 Select 속성이 없습니다.
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--ui-muted)]">
            속성 관리에서 Select 속성과 Option을 추가해 주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => setActiveItemId(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="border-b border-[var(--ui-border)] px-4 py-3">
        <label className="flex w-fit items-center gap-2 text-xs font-medium text-[var(--ui-muted)]">
          그룹 기준
          <select
            aria-label="칸반 그룹 속성"
            className="h-8 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-accent)]"
            disabled={disabled}
            onChange={(event) => {
              setGroupById(event.target.value)
              void onGroupByChange?.(event.target.value)
            }}
            value={groupBy.id}
          >
            {selectProperties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <span className="text-[var(--ui-faint)]">
            · {items.length}개 카드
          </span>
        </label>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max gap-3">
          {columns.map((column) => (
            <KanbanColumnView
              column={column}
              disabled={disabled}
              items={groupedItems.get(column.id) ?? []}
              key={column.id}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeItem ? <KanbanCardPreview item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
