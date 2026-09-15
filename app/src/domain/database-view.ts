import type { DatabaseItem, DatabaseSchema } from '@/domain/database'
import type { MarkdownValue } from '@/domain/markdown'

export const currentDatabaseViewVersion = 1
export const titleViewPropertyId = 'title'

export type DatabaseViewType = 'table' | 'kanban'
export type SortDirection = 'asc' | 'desc'
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_true'
  | 'is_false'
  | 'before'
  | 'after'

export interface FilterDefinition {
  propertyId: string
  operator: FilterOperator
  value?: MarkdownValue
}

export interface SortDefinition {
  propertyId: string
  direction: SortDirection
}

export interface DatabaseView {
  version: number
  id: string
  databaseId: string
  name: string
  type: DatabaseViewType
  filters: FilterDefinition[]
  sorts: SortDefinition[]
  hiddenProperties: string[]
  propertyOrder: string[]
  groupBy?: string
}

export type DatabaseViewErrorCode =
  'invalid-view' | 'view-not-found' | 'duplicate-view-name'

export class DatabaseViewError extends Error {
  constructor(
    public readonly code: DatabaseViewErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DatabaseViewError'
  }
}

export function activeViewProperties(database: DatabaseSchema) {
  return Object.values(database.properties)
    .filter((property) => !property.deleted)
    .sort((left, right) => left.order - right.order)
}

function valueForView(
  item: DatabaseItem,
  database: DatabaseSchema,
  propertyId: string,
) {
  if (propertyId === titleViewPropertyId) {
    return item.title
  }
  const property =
    database.properties[propertyId as keyof typeof database.properties]
  const value = item.properties[propertyId]
  if (
    property &&
    (property.type === 'select' || property.type === 'multi_select')
  ) {
    const optionNames = new Map<string, string>(
      property.options.map((option) => [option.id, option.name]),
    )
    return Array.isArray(value)
      ? value.map((optionId) => optionNames.get(String(optionId)) ?? optionId)
      : (optionNames.get(String(value)) ?? value)
  }
  return value
}

function isEmpty(value: MarkdownValue | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function matchesFilter(
  item: DatabaseItem,
  database: DatabaseSchema,
  filter: FilterDefinition,
) {
  const rawValue =
    filter.propertyId === titleViewPropertyId
      ? item.title
      : item.properties[filter.propertyId]
  const comparableValue = valueForView(item, database, filter.propertyId)
  const expected = filter.value

  switch (filter.operator) {
    case 'is_empty':
      return isEmpty(rawValue)
    case 'is_not_empty':
      return !isEmpty(rawValue)
    case 'is_true':
      return rawValue === true
    case 'is_false':
      return rawValue !== true
    case 'contains': {
      const needle = String(expected ?? '').toLocaleLowerCase()
      return Array.isArray(comparableValue)
        ? comparableValue.some((value) =>
            String(value).toLocaleLowerCase().includes(needle),
          )
        : String(comparableValue ?? '')
            .toLocaleLowerCase()
            .includes(needle)
    }
    case 'equals':
      return Array.isArray(rawValue)
        ? rawValue.some((value) => value === expected)
        : rawValue === expected
    case 'not_equals':
      return Array.isArray(rawValue)
        ? !rawValue.some((value) => value === expected)
        : rawValue !== expected
    case 'gt':
      return typeof rawValue === 'number' && rawValue > Number(expected)
    case 'gte':
      return typeof rawValue === 'number' && rawValue >= Number(expected)
    case 'lt':
      return typeof rawValue === 'number' && rawValue < Number(expected)
    case 'lte':
      return typeof rawValue === 'number' && rawValue <= Number(expected)
    case 'before':
      return typeof rawValue === 'string' && rawValue < String(expected ?? '')
    case 'after':
      return typeof rawValue === 'string' && rawValue > String(expected ?? '')
  }
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) {
    return 0
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right
  }
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right)
  }
  return String(left).localeCompare(String(right), 'ko', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function applyDatabaseView(
  items: DatabaseItem[],
  database: DatabaseSchema,
  view: DatabaseView,
) {
  const filtered = items.filter((item) =>
    view.filters.every((filter) => matchesFilter(item, database, filter)),
  )
  if (view.sorts.length === 0) {
    return filtered
  }
  return [...filtered].sort((left, right) => {
    for (const sort of view.sorts) {
      const leftValue = valueForView(left, database, sort.propertyId)
      const rightValue = valueForView(right, database, sort.propertyId)
      if (isEmpty(leftValue as MarkdownValue | undefined)) {
        if (!isEmpty(rightValue as MarkdownValue | undefined)) {
          return 1
        }
        continue
      }
      if (isEmpty(rightValue as MarkdownValue | undefined)) {
        return -1
      }
      const comparison = compareValues(leftValue, rightValue)
      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison
      }
    }
    return left.title.localeCompare(right.title, 'ko')
  })
}
