import type { PropertyDefinition } from '@/domain/database'
import {
  activeViewProperties,
  currentDatabaseViewVersion,
  DatabaseViewError,
  titleViewPropertyId,
  type DatabaseView,
  type DatabaseViewType,
  type FilterDefinition,
  type FilterOperator,
  type SortDefinition,
} from '@/domain/database-view'
import { WorkspaceError } from '@/domain/errors'
import type { MarkdownValue } from '@/domain/markdown'
import type { DatabaseApplicationService } from '@/services/database.service'
import type { FileSystemService } from '@/services/file-system.service'

const viewsPath = '.workspace/views'

export interface ViewApplicationService {
  createView(
    databaseId: string,
    name: string,
    type: DatabaseViewType,
  ): Promise<DatabaseView>
  deleteView(viewId: string): Promise<void>
  listViews(databaseId: string): Promise<DatabaseView[]>
  updateView(view: DatabaseView): Promise<DatabaseView>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertViewId(value: string) {
  if (!/^view_[a-zA-Z0-9]+$/.test(value)) {
    throw new DatabaseViewError('invalid-view', '유효하지 않은 View ID입니다.')
  }
  return value
}

function assertDatabaseId(value: string) {
  if (!/^db_[a-zA-Z0-9]+$/.test(value)) {
    throw new DatabaseViewError(
      'invalid-view',
      '유효하지 않은 Database ID입니다.',
    )
  }
  return value
}

function normalizeViewName(name: string) {
  const normalized = name.trim().normalize('NFC')
  if (!normalized || /[\r\n]/.test(normalized) || normalized.length > 100) {
    throw new DatabaseViewError(
      'invalid-view',
      'View 이름은 한 줄의 1~100자여야 합니다.',
    )
  }
  return normalized
}

function isMarkdownValue(value: unknown): value is MarkdownValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (Array.isArray(value)) {
    return value.every(isMarkdownValue)
  }
  return isRecord(value) && Object.values(value).every(isMarkdownValue)
}

const filterOperators = new Set<FilterOperator>([
  'equals',
  'not_equals',
  'contains',
  'is_empty',
  'is_not_empty',
  'gt',
  'gte',
  'lt',
  'lte',
  'is_true',
  'is_false',
  'before',
  'after',
])

function parseFilter(value: unknown): FilterDefinition {
  if (
    !isRecord(value) ||
    typeof value.propertyId !== 'string' ||
    typeof value.operator !== 'string' ||
    !filterOperators.has(value.operator as FilterOperator) ||
    ('value' in value && !isMarkdownValue(value.value))
  ) {
    throw new DatabaseViewError(
      'invalid-view',
      'View Filter 형식이 올바르지 않습니다.',
    )
  }
  return {
    propertyId: value.propertyId,
    operator: value.operator as FilterOperator,
    ...('value' in value ? { value: value.value as MarkdownValue } : {}),
  }
}

function parseSort(value: unknown): SortDefinition {
  if (
    !isRecord(value) ||
    typeof value.propertyId !== 'string' ||
    (value.direction !== 'asc' && value.direction !== 'desc')
  ) {
    throw new DatabaseViewError(
      'invalid-view',
      'View Sort 형식이 올바르지 않습니다.',
    )
  }
  return { propertyId: value.propertyId, direction: value.direction }
}

function parseStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new DatabaseViewError(
      'invalid-view',
      `${label} 형식이 올바르지 않습니다.`,
    )
  }
  return [...new Set(value as string[])]
}

function parseView(source: string, expectedId: string): DatabaseView {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new DatabaseViewError(
      'invalid-view',
      `${expectedId} View JSON을 읽을 수 없습니다.`,
      { cause: error },
    )
  }
  if (
    !isRecord(value) ||
    value.version !== currentDatabaseViewVersion ||
    value.id !== expectedId ||
    typeof value.databaseId !== 'string' ||
    typeof value.name !== 'string' ||
    (value.type !== 'table' && value.type !== 'kanban') ||
    !Array.isArray(value.filters) ||
    !Array.isArray(value.sorts)
  ) {
    throw new DatabaseViewError(
      'invalid-view',
      `${expectedId} View 형식이 올바르지 않습니다.`,
    )
  }
  assertViewId(expectedId)
  return {
    version: currentDatabaseViewVersion,
    id: expectedId,
    databaseId: assertDatabaseId(value.databaseId),
    name: normalizeViewName(value.name),
    type: value.type,
    filters: value.filters.map(parseFilter),
    sorts: value.sorts.map(parseSort),
    hiddenProperties: parseStringArray(
      value.hiddenProperties,
      'hiddenProperties',
    ),
    propertyOrder: parseStringArray(value.propertyOrder, 'propertyOrder'),
    ...(typeof value.groupBy === 'string' ? { groupBy: value.groupBy } : {}),
  }
}

function operatorsForProperty(property: PropertyDefinition | null) {
  if (
    !property ||
    property.type === 'text' ||
    property.type === 'multi_select'
  ) {
    return new Set<FilterOperator>([
      'equals',
      'not_equals',
      'contains',
      'is_empty',
      'is_not_empty',
    ])
  }
  switch (property.type) {
    case 'number':
      return new Set<FilterOperator>([
        'equals',
        'not_equals',
        'gt',
        'gte',
        'lt',
        'lte',
        'is_empty',
        'is_not_empty',
      ])
    case 'select':
      return new Set<FilterOperator>([
        'equals',
        'not_equals',
        'is_empty',
        'is_not_empty',
      ])
    case 'checkbox':
      return new Set<FilterOperator>(['is_true', 'is_false'])
    case 'date':
      return new Set<FilterOperator>([
        'equals',
        'before',
        'after',
        'is_empty',
        'is_not_empty',
      ])
  }
}

export class ViewService<DirectoryHandle> implements ViewApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly databases: Pick<
      DatabaseApplicationService,
      'loadDatabase'
    >,
    private readonly createViewId: () => string = () =>
      `view_${crypto.randomUUID().replaceAll('-', '')}`,
  ) {}

  async listViews(databaseId: string) {
    const normalizedDatabaseId = assertDatabaseId(databaseId)
    const root = this.getRoot()
    let entries
    try {
      entries = await this.fileSystem.listDirectory(root, viewsPath)
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === 'entry-not-found') {
        return []
      }
      throw error
    }
    const views = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.kind === 'file' &&
            /^view_[a-zA-Z0-9]+\.json$/.test(entry.name),
        )
        .map(async (entry) => {
          const id = entry.name.slice(0, -'.json'.length)
          return parseView(
            await this.fileSystem.readTextFile(root, entry.path),
            id,
          )
        }),
    )
    return views
      .filter((view) => view.databaseId === normalizedDatabaseId)
      .sort((left, right) => left.name.localeCompare(right.name, 'ko'))
  }

  async createView(databaseId: string, name: string, type: DatabaseViewType) {
    const schema = await this.databases.loadDatabase(databaseId)
    const normalizedName = normalizeViewName(name)
    const currentViews = await this.listViews(schema.id)
    if (this.hasSameName(currentViews, normalizedName)) {
      throw new DatabaseViewError(
        'duplicate-view-name',
        '같은 이름의 View가 이미 있습니다.',
      )
    }
    await this.fileSystem.createDirectory(this.getRoot(), viewsPath, {
      allowProtected: true,
    })
    const entries = await this.fileSystem.listDirectory(
      this.getRoot(),
      viewsPath,
    )
    let id = this.createViewId()
    let attempts = 0
    while (entries.some((entry) => entry.name === `${id}.json`)) {
      if (++attempts >= 10) {
        throw new DatabaseViewError(
          'invalid-view',
          '고유한 View ID를 만들지 못했습니다.',
        )
      }
      id = this.createViewId()
    }
    assertViewId(id)
    const properties = activeViewProperties(schema)
    const firstSelect = properties.find(
      (property) => property.type === 'select',
    )
    const view: DatabaseView = {
      version: currentDatabaseViewVersion,
      id,
      databaseId: schema.id,
      name: normalizedName,
      type,
      filters: [],
      sorts: [],
      hiddenProperties: [],
      propertyOrder: properties.map((property) => property.id),
      ...(type === 'kanban' && firstSelect ? { groupBy: firstSelect.id } : {}),
    }
    return this.persist(view)
  }

  async updateView(view: DatabaseView) {
    const id = assertViewId(view.id)
    const schema = await this.databases.loadDatabase(view.databaseId)
    const currentViews = await this.listViews(schema.id)
    if (!currentViews.some((candidate) => candidate.id === id)) {
      throw new DatabaseViewError('view-not-found', 'View를 찾을 수 없습니다.')
    }
    const normalizedName = normalizeViewName(view.name)
    if (this.hasSameName(currentViews, normalizedName, id)) {
      throw new DatabaseViewError(
        'duplicate-view-name',
        '같은 이름의 View가 이미 있습니다.',
      )
    }
    const normalized = this.normalizeConfiguration(
      { ...view, name: normalizedName, databaseId: schema.id },
      schema.properties,
    )
    return this.persist(normalized)
  }

  async deleteView(viewId: string) {
    const id = assertViewId(viewId)
    try {
      await this.fileSystem.readTextFile(
        this.getRoot(),
        `${viewsPath}/${id}.json`,
      )
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === 'entry-not-found') {
        throw new DatabaseViewError(
          'view-not-found',
          '삭제할 View를 찾을 수 없습니다.',
          { cause: error },
        )
      }
      throw error
    }
    await this.fileSystem.deleteEntry(
      this.getRoot(),
      `${viewsPath}/${id}.json`,
      {
        allowProtected: true,
      },
    )
  }

  private normalizeConfiguration(
    view: DatabaseView,
    properties: Record<string, PropertyDefinition>,
  ) {
    const activeIds = new Set<string>(
      Object.values(properties)
        .filter((property) => !property.deleted)
        .sort((left, right) => left.order - right.order)
        .map((property) => property.id),
    )
    const isKnownId = (id: string) =>
      id === titleViewPropertyId || activeIds.has(id)
    const filters = view.filters.filter((filter) => {
      if (!isKnownId(filter.propertyId)) {
        return false
      }
      const property =
        filter.propertyId === titleViewPropertyId
          ? null
          : properties[filter.propertyId]
      return operatorsForProperty(property).has(filter.operator)
    })
    const sorts = view.sorts.filter(
      (sort, index) =>
        isKnownId(sort.propertyId) &&
        (sort.direction === 'asc' || sort.direction === 'desc') &&
        view.sorts.findIndex(
          (candidate) => candidate.propertyId === sort.propertyId,
        ) === index,
    )
    const propertyOrder = [
      ...view.propertyOrder.filter((propertyId) => activeIds.has(propertyId)),
      ...[...activeIds].filter(
        (propertyId) => !view.propertyOrder.includes(propertyId),
      ),
    ]
    const hiddenProperties = view.hiddenProperties.filter((propertyId) =>
      activeIds.has(propertyId),
    )
    const groupByProperty = view.groupBy ? properties[view.groupBy] : undefined
    return {
      ...view,
      version: currentDatabaseViewVersion,
      filters,
      sorts,
      propertyOrder,
      hiddenProperties: [...new Set(hiddenProperties)],
      ...(groupByProperty?.type === 'select' && !groupByProperty.deleted
        ? { groupBy: groupByProperty.id }
        : { groupBy: undefined }),
    }
  }

  private hasSameName(views: DatabaseView[], name: string, exceptId?: string) {
    const comparableName = name.toLocaleLowerCase()
    return views.some(
      (view) =>
        view.id !== exceptId &&
        view.name.normalize('NFC').toLocaleLowerCase() === comparableName,
    )
  }

  private async persist(view: DatabaseView) {
    await this.fileSystem.writeTextFile(
      this.getRoot(),
      `${viewsPath}/${view.id}.json`,
      `${JSON.stringify(view, null, 2)}\n`,
      { allowProtected: true },
    )
    return view
  }
}
