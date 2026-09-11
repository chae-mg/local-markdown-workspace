import {
  SchemaError,
  type PropertyDefinition,
  type PropertyId,
  type PropertyType,
  type SelectOption,
  type SelectOptionId,
} from '@/domain/database'

const propertyTypes = new Set<PropertyType>([
  'text',
  'number',
  'select',
  'multi_select',
  'checkbox',
  'date',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === 'string' && propertyTypes.has(value as PropertyType)
}

function parseOptions(value: unknown, propertyId: string) {
  if (!Array.isArray(value)) {
    throw new SchemaError(
      'invalid-property',
      `${propertyId}의 선택 옵션 형식이 올바르지 않습니다.`,
    )
  }

  const seenIds = new Set<string>()
  return value.map((option, index): SelectOption => {
    if (
      !isRecord(option) ||
      typeof option.id !== 'string' ||
      !/^opt_[a-zA-Z0-9]+$/.test(option.id) ||
      typeof option.name !== 'string' ||
      !option.name.trim() ||
      (option.deleted !== undefined && typeof option.deleted !== 'boolean')
    ) {
      throw new SchemaError(
        'invalid-option',
        `${propertyId}의 ${index + 1}번째 선택 옵션이 올바르지 않습니다.`,
      )
    }

    if (seenIds.has(option.id)) {
      throw new SchemaError(
        'invalid-option',
        `${propertyId}에 중복된 Option ID가 있습니다: ${option.id}`,
      )
    }
    seenIds.add(option.id)
    return {
      id: option.id as SelectOptionId,
      name: option.name,
      ...(option.deleted === undefined ? {} : { deleted: option.deleted }),
    }
  })
}

export function parsePropertyDefinitions(
  value: Record<string, unknown>,
): Record<PropertyId, PropertyDefinition> {
  const properties = Object.create(null) as Record<
    PropertyId,
    PropertyDefinition
  >
  const seenOrders = new Set<number>()

  for (const [key, property] of Object.entries(value)) {
    if (
      !/^prop_[a-zA-Z0-9]+$/.test(key) ||
      !isRecord(property) ||
      property.id !== key ||
      typeof property.name !== 'string' ||
      !property.name.trim() ||
      !isPropertyType(property.type) ||
      typeof property.deleted !== 'boolean' ||
      !Number.isInteger(property.order) ||
      (property.order as number) < 0
    ) {
      throw new SchemaError(
        'invalid-property',
        `${key} Property 형식이 올바르지 않습니다.`,
      )
    }

    if (seenOrders.has(property.order as number)) {
      throw new SchemaError(
        'invalid-property',
        `중복된 Property 순서가 있습니다: ${String(property.order)}`,
      )
    }
    seenOrders.add(property.order as number)

    const base = {
      id: key as PropertyId,
      name: property.name,
      deleted: property.deleted,
      order: property.order as number,
    }
    properties[key as PropertyId] =
      property.type === 'select' || property.type === 'multi_select'
        ? {
            ...base,
            type: property.type,
            options: parseOptions(property.options, key),
          }
        : { ...base, type: property.type }
  }

  return properties
}
