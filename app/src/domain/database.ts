import type { MarkdownValue } from '@/domain/markdown'

export const currentDatabaseSchemaVersion = 1

export interface DatabaseSchema {
  schemaVersion: number
  id: string
  name: string
  folder: string
  properties: Record<string, unknown>
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
