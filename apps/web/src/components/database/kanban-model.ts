import type {
  DatabaseItem,
  SelectOptionId,
  SelectPropertyDefinition,
} from '@/domain/database'

const unassignedColumnId = 'kanban:unassigned'
const optionColumnPrefix = 'kanban:option:'

export function kanbanColumnId(optionId?: string) {
  return optionId ? `${optionColumnPrefix}${optionId}` : unassignedColumnId
}

export function optionIdFromKanbanColumn(columnId: string) {
  if (columnId === unassignedColumnId) {
    return undefined
  }
  return columnId.startsWith(optionColumnPrefix)
    ? (columnId.slice(optionColumnPrefix.length) as SelectOptionId)
    : null
}

export function groupKanbanItems(
  items: DatabaseItem[],
  property: SelectPropertyDefinition,
) {
  const activeOptionIds = new Set(
    property.options
      .filter((option) => !option.deleted)
      .map((option) => option.id),
  )
  const groups = new Map<string, DatabaseItem[]>()
  groups.set(unassignedColumnId, [])
  for (const optionId of activeOptionIds) {
    groups.set(kanbanColumnId(optionId), [])
  }

  for (const item of items) {
    const value = item.properties[property.id]
    const columnId =
      typeof value === 'string' && activeOptionIds.has(value as SelectOptionId)
        ? kanbanColumnId(value)
        : unassignedColumnId
    groups.get(columnId)?.push(item)
  }

  return groups
}
