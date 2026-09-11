import type { MarkdownValue } from '@/domain/markdown'

export const currentDatabaseSchemaVersion = 1

export type PropertyType =
  'text' | 'number' | 'select' | 'multi_select' | 'checkbox' | 'date'

export type PropertyId = `prop_${string}`
export type SelectOptionId = `opt_${string}`

export interface SelectOption {
  id: SelectOptionId
  name: string
  deleted?: boolean
}

interface BasePropertyDefinition {
  id: PropertyId
  name: string
  type: PropertyType
  deleted: boolean
  order: number
}

export interface ScalarPropertyDefinition extends BasePropertyDefinition {
  type: 'text' | 'number' | 'checkbox' | 'date'
}

export interface SelectPropertyDefinition extends BasePropertyDefinition {
  type: 'select' | 'multi_select'
  options: SelectOption[]
}

export type PropertyDefinition =
  ScalarPropertyDefinition | SelectPropertyDefinition

export interface DatabaseSchema {
  schemaVersion: number
  id: string
  name: string
  folder: string
  properties: Record<PropertyId, PropertyDefinition>
}

export interface DatabaseItem {
  id: string
  path: string
  title: string
  properties: Record<string, MarkdownValue>
  body: string
  lastModified: number
}

export type DatabaseErrorCode =
  | 'database-not-found'
  | 'invalid-database'
  | 'invalid-item'
  | 'duplicate-item-id'

export type SchemaErrorCode =
  | 'invalid-property'
  | 'property-not-found'
  | 'duplicate-property-name'
  | 'invalid-option'
  | 'option-not-found'
  | 'duplicate-option-name'
  | 'incompatible-property-type'

export class DatabaseError extends Error {
  constructor(
    public readonly code: DatabaseErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DatabaseError'
  }
}

export class SchemaError extends Error {
  constructor(
    public readonly code: SchemaErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SchemaError'
  }
}
