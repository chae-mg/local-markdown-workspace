import {
  SchemaError,
  type DatabaseSchema,
  type PropertyDefinition,
  type PropertyId,
  type PropertyType,
  type SelectOptionId,
} from '@/domain/database'
import type { MarkdownValue } from '@/domain/markdown'
import type { DatabaseApplicationService } from '@/services/database.service'
import type { FileSystemService } from '@/services/file-system.service'

export interface SchemaApplicationService {
  addOption(
    databaseId: string,
    propertyId: string,
    name: string,
  ): Promise<DatabaseSchema>
  changePropertyType(
    databaseId: string,
    propertyId: string,
    type: PropertyType,
  ): Promise<DatabaseSchema>
  createProperty(
    databaseId: string,
    name: string,
    type: PropertyType,
  ): Promise<DatabaseSchema>
  moveProperty(
    databaseId: string,
    propertyId: string,
    direction: 'up' | 'down',
  ): Promise<DatabaseSchema>
  renameOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
    name: string,
  ): Promise<DatabaseSchema>
  renameProperty(
    databaseId: string,
    propertyId: string,
    name: string,
  ): Promise<DatabaseSchema>
  restoreOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
  ): Promise<DatabaseSchema>
  restoreProperty(
    databaseId: string,
    propertyId: string,
  ): Promise<DatabaseSchema>
  softDeleteOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
  ): Promise<DatabaseSchema>
  softDeleteProperty(
    databaseId: string,
    propertyId: string,
  ): Promise<DatabaseSchema>
}

function normalizeDisplayName(name: string, label: string) {
  const normalized = name.trim().normalize('NFC')
  if (!normalized || /[\r\n]/.test(normalized) || normalized.length > 100) {
    throw new SchemaError(
      'invalid-property',
      `${label} 이름은 한 줄의 1~100자여야 합니다.`,
    )
  }
  return normalized
}

function assertPropertyId(value: string): asserts value is PropertyId {
  if (!/^prop_[a-zA-Z0-9]+$/.test(value)) {
    throw new SchemaError(
      'invalid-property',
      '유효하지 않은 Property ID입니다.',
    )
  }
}

function assertOptionId(value: string): asserts value is SelectOptionId {
  if (!/^opt_[a-zA-Z0-9]+$/.test(value)) {
    throw new SchemaError('invalid-option', '유효하지 않은 Option ID입니다.')
  }
}

function hasSameName(
  values: Array<{ id: string; name: string }>,
  name: string,
  exceptId?: string,
) {
  const comparableName = name.toLocaleLowerCase()
  return values.some(
    (value) =>
      value.id !== exceptId &&
      value.name.normalize('NFC').toLocaleLowerCase() === comparableName,
  )
}

function isSelectProperty(
  property: PropertyDefinition,
): property is Extract<
  PropertyDefinition,
  { type: 'select' | 'multi_select' }
> {
  return property.type === 'select' || property.type === 'multi_select'
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  )
}

function isCompatibleValue(
  value: MarkdownValue,
  type: PropertyType,
  optionIds: Set<string>,
) {
  if (value === null) {
    return true
  }

  switch (type) {
    case 'text':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'checkbox':
      return typeof value === 'boolean'
    case 'date':
      return typeof value === 'string' && isValidDate(value)
    case 'select':
      return typeof value === 'string' && optionIds.has(value)
    case 'multi_select':
      return (
        Array.isArray(value) &&
        value.every((optionId) =>
          typeof optionId === 'string' ? optionIds.has(optionId) : false,
        )
      )
  }
}

export class SchemaService<
  DirectoryHandle,
> implements SchemaApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly databases: DatabaseApplicationService,
    private readonly createPropertyId: () => string = () =>
      `prop_${crypto.randomUUID().replaceAll('-', '')}`,
    private readonly createOptionId: () => string = () =>
      `opt_${crypto.randomUUID().replaceAll('-', '')}`,
  ) {}

  async createProperty(databaseId: string, name: string, type: PropertyType) {
    const schema = await this.databases.loadDatabase(databaseId)
    const normalizedName = normalizeDisplayName(name, 'Property')
    const properties = Object.values(schema.properties)
    if (hasSameName(properties, normalizedName)) {
      throw new SchemaError(
        'duplicate-property-name',
        '같은 이름의 Property가 이미 있습니다.',
      )
    }

    let id = this.createPropertyId()
    let attempts = 0
    while (schema.properties[id as PropertyId]) {
      if (++attempts >= 10) {
        throw new SchemaError(
          'invalid-property',
          '고유한 Property ID를 만들지 못했습니다.',
        )
      }
      id = this.createPropertyId()
    }
    assertPropertyId(id)

    const base = {
      id,
      name: normalizedName,
      deleted: false,
      order: Math.max(0, ...properties.map((property) => property.order)) + 1,
    }
    const property: PropertyDefinition =
      type === 'select' || type === 'multi_select'
        ? { ...base, type, options: [] }
        : { ...base, type }

    return this.persist({
      ...schema,
      properties: { ...schema.properties, [id]: property },
    })
  }

  async renameProperty(databaseId: string, propertyId: string, name: string) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireProperty(schema, propertyId)
    const normalizedName = normalizeDisplayName(name, 'Property')
    if (
      hasSameName(Object.values(schema.properties), normalizedName, property.id)
    ) {
      throw new SchemaError(
        'duplicate-property-name',
        '같은 이름의 Property가 이미 있습니다.',
      )
    }
    return this.updateProperty(schema, property.id, {
      ...property,
      name: normalizedName,
    })
  }

  async softDeleteProperty(databaseId: string, propertyId: string) {
    return this.setPropertyDeleted(databaseId, propertyId, true)
  }

  async restoreProperty(databaseId: string, propertyId: string) {
    return this.setPropertyDeleted(databaseId, propertyId, false)
  }

  async moveProperty(
    databaseId: string,
    propertyId: string,
    direction: 'up' | 'down',
  ) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireProperty(schema, propertyId)
    const visibleProperties = Object.values(schema.properties)
      .filter((candidate) => !candidate.deleted)
      .sort((left, right) => left.order - right.order)
    const index = visibleProperties.findIndex(
      (candidate) => candidate.id === property.id,
    )
    const target = visibleProperties[index + (direction === 'up' ? -1 : 1)]
    if (index < 0 || !target) {
      return schema
    }

    return this.persist({
      ...schema,
      properties: {
        ...schema.properties,
        [property.id]: { ...property, order: target.order },
        [target.id]: { ...target, order: property.order },
      },
    })
  }

  async changePropertyType(
    databaseId: string,
    propertyId: string,
    type: PropertyType,
  ) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireProperty(schema, propertyId)
    if (property.type === type) {
      return schema
    }

    const options = isSelectProperty(property) ? property.options : []
    if (
      isSelectProperty(property) &&
      type !== 'select' &&
      type !== 'multi_select' &&
      options.length > 0
    ) {
      throw new SchemaError(
        'incompatible-property-type',
        '기존 Select Option이 있어 다른 타입으로 변경할 수 없습니다.',
      )
    }
    const optionIds = new Set(options.map((option) => option.id))
    const items = await this.databases.loadItems(databaseId)
    const incompatibleItem = items.find((item) => {
      const value = item.properties[property.id]
      return value !== undefined && !isCompatibleValue(value, type, optionIds)
    })
    if (incompatibleItem) {
      throw new SchemaError(
        'incompatible-property-type',
        `“${incompatibleItem.title}” 항목의 값이 ${type} 타입과 호환되지 않아 변경할 수 없습니다.`,
      )
    }

    const nextProperty: PropertyDefinition =
      type === 'select' || type === 'multi_select'
        ? { ...property, type, options }
        : {
            id: property.id,
            name: property.name,
            deleted: property.deleted,
            order: property.order,
            type,
          }
    return this.updateProperty(schema, property.id, nextProperty)
  }

  async addOption(databaseId: string, propertyId: string, name: string) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireSelectProperty(schema, propertyId)
    const normalizedName = normalizeDisplayName(name, 'Option')
    if (hasSameName(property.options, normalizedName)) {
      throw new SchemaError(
        'duplicate-option-name',
        '같은 이름의 Option이 이미 있습니다.',
      )
    }

    let id = this.createOptionId()
    let attempts = 0
    while (property.options.some((option) => option.id === id)) {
      if (++attempts >= 10) {
        throw new SchemaError(
          'invalid-option',
          '고유한 Option ID를 만들지 못했습니다.',
        )
      }
      id = this.createOptionId()
    }
    assertOptionId(id)
    return this.updateProperty(schema, property.id, {
      ...property,
      options: [...property.options, { id, name: normalizedName }],
    })
  }

  async renameOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
    name: string,
  ) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireSelectProperty(schema, propertyId)
    const option = this.requireOption(property, optionId)
    const normalizedName = normalizeDisplayName(name, 'Option')
    if (hasSameName(property.options, normalizedName, option.id)) {
      throw new SchemaError(
        'duplicate-option-name',
        '같은 이름의 Option이 이미 있습니다.',
      )
    }
    return this.updateOption(schema, property, option.id, {
      ...option,
      name: normalizedName,
    })
  }

  async softDeleteOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
  ) {
    return this.setOptionDeleted(databaseId, propertyId, optionId, true)
  }

  async restoreOption(
    databaseId: string,
    propertyId: string,
    optionId: string,
  ) {
    return this.setOptionDeleted(databaseId, propertyId, optionId, false)
  }

  private async setPropertyDeleted(
    databaseId: string,
    propertyId: string,
    deleted: boolean,
  ) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireProperty(schema, propertyId)
    return this.updateProperty(schema, property.id, { ...property, deleted })
  }

  private async setOptionDeleted(
    databaseId: string,
    propertyId: string,
    optionId: string,
    deleted: boolean,
  ) {
    const schema = await this.databases.loadDatabase(databaseId)
    const property = this.requireSelectProperty(schema, propertyId)
    const option = this.requireOption(property, optionId)
    return this.updateOption(schema, property, option.id, {
      ...option,
      deleted,
    })
  }

  private requireProperty(schema: DatabaseSchema, propertyId: string) {
    assertPropertyId(propertyId)
    const property = schema.properties[propertyId]
    if (!property) {
      throw new SchemaError(
        'property-not-found',
        'Property를 찾을 수 없습니다.',
      )
    }
    return property
  }

  private requireSelectProperty(schema: DatabaseSchema, propertyId: string) {
    const property = this.requireProperty(schema, propertyId)
    if (!isSelectProperty(property)) {
      throw new SchemaError(
        'invalid-property',
        'Select 또는 Multi-select Property에서만 Option을 관리할 수 있습니다.',
      )
    }
    return property
  }

  private requireOption(
    property: Extract<PropertyDefinition, { type: 'select' | 'multi_select' }>,
    optionId: string,
  ) {
    assertOptionId(optionId)
    const option = property.options.find(
      (candidate) => candidate.id === optionId,
    )
    if (!option) {
      throw new SchemaError('option-not-found', 'Option을 찾을 수 없습니다.')
    }
    return option
  }

  private updateOption(
    schema: DatabaseSchema,
    property: Extract<PropertyDefinition, { type: 'select' | 'multi_select' }>,
    optionId: SelectOptionId,
    option: (typeof property.options)[number],
  ) {
    return this.updateProperty(schema, property.id, {
      ...property,
      options: property.options.map((candidate) =>
        candidate.id === optionId ? option : candidate,
      ),
    })
  }

  private updateProperty(
    schema: DatabaseSchema,
    propertyId: PropertyId,
    property: PropertyDefinition,
  ) {
    return this.persist({
      ...schema,
      properties: { ...schema.properties, [propertyId]: property },
    })
  }

  private async persist(schema: DatabaseSchema) {
    await this.fileSystem.writeTextFile(
      this.getRoot(),
      `.workspace/schemas/${schema.id}.json`,
      `${JSON.stringify(schema, null, 2)}\n`,
      { allowProtected: true },
    )
    return schema
  }
}
