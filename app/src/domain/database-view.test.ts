import { describe, expect, it } from 'vitest'

import type { DatabaseItem, DatabaseSchema } from '@/domain/database'
import { applyDatabaseView, type DatabaseView } from '@/domain/database-view'

const database: DatabaseSchema = {
  schemaVersion: 1,
  id: 'db_test',
  name: '작업',
  folder: 'Databases/작업/items',
  properties: {
    prop_status: {
      id: 'prop_status',
      name: '상태',
      type: 'select',
      deleted: false,
      order: 1,
      options: [
        { id: 'opt_todo', name: '예정' },
        { id: 'opt_doing', name: '진행 중' },
      ],
    },
    prop_score: {
      id: 'prop_score',
      name: '점수',
      type: 'number',
      deleted: false,
      order: 2,
    },
  },
}

const items: DatabaseItem[] = [
  {
    id: 'item_a',
    path: 'a.md',
    title: '문서 A',
    properties: { prop_status: 'opt_todo', prop_score: 10 },
    body: '',
    lastModified: 1,
  },
  {
    id: 'item_b',
    path: 'b.md',
    title: '문서 B',
    properties: { prop_status: 'opt_doing', prop_score: 30 },
    body: '',
    lastModified: 2,
  },
  {
    id: 'item_c',
    path: 'c.md',
    title: '기타',
    properties: { prop_score: 20 },
    body: '',
    lastModified: 3,
  },
]

const view: DatabaseView = {
  version: 1,
  id: 'view_test',
  databaseId: database.id,
  name: '보기',
  type: 'table',
  filters: [],
  sorts: [],
  hiddenProperties: [],
  propertyOrder: ['prop_status', 'prop_score'],
}

describe('applyDatabaseView', () => {
  it('filters title, number, select, and empty property values', () => {
    expect(
      applyDatabaseView(items, database, {
        ...view,
        filters: [
          { propertyId: 'title', operator: 'contains', value: '문서' },
          { propertyId: 'prop_score', operator: 'gte', value: 20 },
          {
            propertyId: 'prop_status',
            operator: 'equals',
            value: 'opt_doing',
          },
        ],
      }),
    ).toEqual([items[1]])

    expect(
      applyDatabaseView(items, database, {
        ...view,
        filters: [{ propertyId: 'prop_status', operator: 'is_empty' }],
      }),
    ).toEqual([items[2]])
  })

  it('applies stable multi-column sorting using displayed select names', () => {
    const result = applyDatabaseView(items, database, {
      ...view,
      sorts: [
        { propertyId: 'prop_status', direction: 'asc' },
        { propertyId: 'prop_score', direction: 'desc' },
      ],
    })

    expect(result.map((item) => item.id)).toEqual([
      'item_a',
      'item_b',
      'item_c',
    ])
  })
})
