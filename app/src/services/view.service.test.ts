import { describe, expect, it, vi } from 'vitest'

import type { DatabaseSchema } from '@/domain/database'
import type { DatabaseView } from '@/domain/database-view'
import { WorkspaceError } from '@/domain/errors'
import type { WorkspaceEntry } from '@/domain/file-system'
import type { FileSystemService } from '@/services/file-system.service'
import { ViewService } from '@/services/view.service'

interface FakeHandle {
  name: string
}

const handle = { name: 'Workspace' }
const schema: DatabaseSchema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {
    prop_status: {
      id: 'prop_status',
      name: '상태',
      type: 'select',
      deleted: false,
      order: 1,
      options: [{ id: 'opt_todo', name: '예정' }],
    },
    prop_done: {
      id: 'prop_done',
      name: '완료',
      type: 'checkbox',
      deleted: false,
      order: 2,
    },
  },
}

const tableView: DatabaseView = {
  version: 1,
  id: 'view_table',
  databaseId: schema.id,
  name: '전체 항목',
  type: 'table',
  filters: [],
  sorts: [],
  hiddenProperties: [],
  propertyOrder: ['prop_status', 'prop_done'],
}

function createService(options?: {
  entries?: WorkspaceEntry[]
  files?: Record<string, string>
  missingDirectory?: boolean
  viewIds?: string[]
}) {
  const files = options?.files ?? {}
  const fileSystem = {
    createDirectory: vi.fn(async () => undefined),
    deleteEntry: vi.fn(async () => undefined),
    listDirectory: vi.fn(async () => {
      if (options?.missingDirectory) {
        throw new WorkspaceError('entry-not-found', '없음')
      }
      return options?.entries ?? []
    }),
    readTextFile: vi.fn(async (_root: FakeHandle, path: string) => {
      const source = files[path]
      if (source === undefined) {
        throw new WorkspaceError('entry-not-found', '없음')
      }
      return source
    }),
    writeTextFile: vi.fn(async () => undefined),
  } as unknown as FileSystemService<FakeHandle>
  const databases = { loadDatabase: vi.fn(async () => schema) }
  const viewIds = options?.viewIds ?? ['view_created']
  const service = new ViewService(
    fileSystem,
    () => handle,
    databases,
    () => viewIds.shift() ?? 'view_fallback',
  )
  return { databases, fileSystem, service }
}

describe('ViewService', () => {
  it('returns an empty list when the views directory does not exist', async () => {
    const { service } = createService({ missingDirectory: true })
    await expect(service.listViews(schema.id)).resolves.toEqual([])
  })

  it('creates a persisted table or Kanban view from active schema properties', async () => {
    const { fileSystem, service } = createService()

    const view = await service.createView(schema.id, '상태별', 'kanban')

    expect(view).toMatchObject({
      id: 'view_created',
      databaseId: schema.id,
      name: '상태별',
      type: 'kanban',
      groupBy: 'prop_status',
      propertyOrder: ['prop_status', 'prop_done'],
    })
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      '.workspace/views',
      { allowProtected: true },
    )
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      '.workspace/views/view_created.json',
      `${JSON.stringify(view, null, 2)}\n`,
      { allowProtected: true },
    )
  })

  it('loads only the requested database views and validates their files', async () => {
    const otherView = { ...tableView, id: 'view_other', databaseId: 'db_other' }
    const { service } = createService({
      entries: [
        {
          kind: 'file',
          name: 'view_table.json',
          path: '.workspace/views/view_table.json',
        },
        {
          kind: 'file',
          name: 'view_other.json',
          path: '.workspace/views/view_other.json',
        },
      ],
      files: {
        '.workspace/views/view_table.json': JSON.stringify(tableView),
        '.workspace/views/view_other.json': JSON.stringify(otherView),
      },
    })

    await expect(service.listViews(schema.id)).resolves.toEqual([tableView])
  })

  it('normalizes stale configuration when updating a view', async () => {
    const { fileSystem, service } = createService({
      entries: [
        {
          kind: 'file',
          name: 'view_table.json',
          path: '.workspace/views/view_table.json',
        },
      ],
      files: {
        '.workspace/views/view_table.json': JSON.stringify(tableView),
      },
    })

    const updated = await service.updateView({
      ...tableView,
      name: '진행 중',
      filters: [
        { propertyId: 'prop_done', operator: 'is_true' },
        { propertyId: 'prop_missing', operator: 'equals', value: 'x' },
      ],
      sorts: [
        { propertyId: 'title', direction: 'asc' },
        { propertyId: 'prop_missing', direction: 'desc' },
      ],
      hiddenProperties: ['prop_done', 'prop_missing'],
      propertyOrder: ['prop_done'],
      groupBy: 'prop_missing',
    })

    expect(updated).toMatchObject({
      name: '진행 중',
      filters: [{ propertyId: 'prop_done', operator: 'is_true' }],
      sorts: [{ propertyId: 'title', direction: 'asc' }],
      hiddenProperties: ['prop_done'],
      propertyOrder: ['prop_done', 'prop_status'],
    })
    expect(updated.groupBy).toBeUndefined()
    expect(fileSystem.writeTextFile).toHaveBeenCalled()
  })

  it('deletes a view metadata file from the protected directory', async () => {
    const { fileSystem, service } = createService({
      files: {
        '.workspace/views/view_table.json': JSON.stringify(tableView),
      },
    })

    await service.deleteView('view_table')

    expect(fileSystem.deleteEntry).toHaveBeenCalledWith(
      handle,
      '.workspace/views/view_table.json',
      { allowProtected: true },
    )
  })
})
