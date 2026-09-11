import { describe, expect, it, vi } from 'vitest'

import type { WorkspaceEntry } from '@/domain/file-system'
import type { FileSystemService } from '@/services/file-system.service'
import { DatabaseService } from '@/services/database.service'

interface FakeHandle {
  name: string
}

const handle = { name: 'Workspace' }
const schema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {},
}

function createService(options?: {
  entriesByPath?: Record<string, WorkspaceEntry[]>
  filesByPath?: Record<string, string>
  itemIds?: string[]
}) {
  const entriesByPath = options?.entriesByPath ?? {
    Databases: [],
    '.workspace/schemas': [],
  }
  const filesByPath = options?.filesByPath ?? {}
  const itemIds = options?.itemIds ?? ['item_123456']
  const fileSystem = {
    createDirectory: vi.fn(async () => undefined),
    deleteEntry: vi.fn(async () => undefined),
    getFileMetadata: vi.fn(async (_root: FakeHandle, path: string) => ({
      kind: 'file' as const,
      name: path.split('/').at(-1) ?? '',
      path,
      lastModified: path.includes('second') ? 20 : 10,
      mimeType: 'text/markdown',
      size: 10,
    })),
    listDirectory: vi.fn(
      async (_root: FakeHandle, path = '') => entriesByPath[path] ?? [],
    ),
    readTextFile: vi.fn(async (_root: FakeHandle, path: string) => {
      const source = filesByPath[path]
      if (source === undefined) {
        throw new Error(`Missing fake file: ${path}`)
      }
      return source
    }),
    writeTextFile: vi.fn(async () => undefined),
  } as unknown as FileSystemService<FakeHandle>
  const trashService = { moveEntryToTrash: vi.fn(async () => undefined) }
  const service = new DatabaseService(
    fileSystem,
    () => handle,
    trashService,
    undefined,
    () => 'db_123456',
    () => itemIds.shift() ?? 'item_fallback',
  )
  return { fileSystem, service, trashService }
}

describe('DatabaseService', () => {
  it('creates a database folder and protected schema without overwriting', async () => {
    const { fileSystem, service } = createService()

    await expect(service.createDatabase('프로젝트')).resolves.toEqual(schema)
    expect(fileSystem.createDirectory).toHaveBeenNthCalledWith(
      1,
      handle,
      '.workspace/schemas',
      { allowProtected: true },
    )
    expect(fileSystem.createDirectory).toHaveBeenNthCalledWith(
      2,
      handle,
      'Databases/프로젝트/items',
    )
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      '.workspace/schemas/db_123456.json',
      `${JSON.stringify(schema, null, 2)}\n`,
      { allowProtected: true },
    )
  })

  it('rejects duplicate database folders case-insensitively before writing a schema', async () => {
    const { fileSystem, service } = createService({
      entriesByPath: {
        Databases: [
          {
            kind: 'directory',
            name: 'Projects',
            path: 'Databases/Projects',
          },
        ],
        '.workspace/schemas': [],
      },
    })

    await expect(service.createDatabase('projects')).rejects.toMatchObject({
      code: 'entry-already-exists',
    })
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('loads and sorts valid database schemas', async () => {
    const secondSchema = {
      ...schema,
      id: 'db_654321',
      name: '회의',
      folder: 'Databases/회의/items',
    }
    const { service } = createService({
      entriesByPath: {
        '.workspace/schemas': [
          {
            kind: 'file',
            name: 'db_123456.json',
            path: '.workspace/schemas/db_123456.json',
          },
          {
            kind: 'file',
            name: 'db_654321.json',
            path: '.workspace/schemas/db_654321.json',
          },
          {
            kind: 'file',
            name: 'notes.txt',
            path: '.workspace/schemas/notes.txt',
          },
        ],
      },
      filesByPath: {
        '.workspace/schemas/db_123456.json': JSON.stringify(schema),
        '.workspace/schemas/db_654321.json': JSON.stringify(secondSchema),
      },
    })

    await expect(service.listDatabases()).resolves.toEqual([
      schema,
      secondSchema,
    ])
  })

  it('creates a Markdown item with a stable ID and H1 title', async () => {
    const { fileSystem, service } = createService({
      entriesByPath: { 'Databases/프로젝트/items': [] },
      filesByPath: {
        '.workspace/schemas/db_123456.json': JSON.stringify(schema),
      },
    })

    await expect(
      service.createItem('db_123456', '대시보드 개선'),
    ).resolves.toMatchObject({
      id: 'item_123456',
      path: 'Databases/프로젝트/items/item_123456.md',
      title: '대시보드 개선',
      body: '\n# 대시보드 개선\n',
    })
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      'Databases/프로젝트/items/item_123456.md',
      '---\nid: item_123456\n---\n\n# 대시보드 개선\n',
    )
  })

  it('loads item files as rows and excludes the ID from properties', async () => {
    const itemSource =
      '---\nid: item_123456\nprop_status: opt_progress\n---\n\n# 대시보드 개선\n\n본문'
    const { service } = createService({
      entriesByPath: {
        'Databases/프로젝트/items': [
          {
            kind: 'file',
            name: 'first.md',
            path: 'Databases/프로젝트/items/first.md',
          },
        ],
      },
      filesByPath: {
        '.workspace/schemas/db_123456.json': JSON.stringify(schema),
        'Databases/프로젝트/items/first.md': itemSource,
      },
    })

    await expect(service.loadItems('db_123456')).resolves.toEqual([
      {
        id: 'item_123456',
        path: 'Databases/프로젝트/items/first.md',
        title: '대시보드 개선',
        properties: { prop_status: 'opt_progress' },
        body: '\n# 대시보드 개선\n\n본문',
        lastModified: 10,
      },
    ])
  })

  it('detects duplicate item IDs instead of silently merging rows', async () => {
    const itemSource = '---\nid: item_123456\n---\n\n# 중복'
    const { service } = createService({
      entriesByPath: {
        'Databases/프로젝트/items': [
          {
            kind: 'file',
            name: 'first.md',
            path: 'Databases/프로젝트/items/first.md',
          },
          {
            kind: 'file',
            name: 'second.md',
            path: 'Databases/프로젝트/items/second.md',
          },
        ],
      },
      filesByPath: {
        '.workspace/schemas/db_123456.json': JSON.stringify(schema),
        'Databases/프로젝트/items/first.md': itemSource,
        'Databases/프로젝트/items/second.md': itemSource,
      },
    })

    await expect(service.loadItems('db_123456')).rejects.toMatchObject({
      code: 'duplicate-item-id',
    })
  })

  it('moves deleted items to the workspace trash', async () => {
    const itemSource = '---\nid: item_123456\n---\n\n# 삭제할 항목'
    const { service, trashService } = createService({
      entriesByPath: {
        'Databases/프로젝트/items': [
          {
            kind: 'file',
            name: 'first.md',
            path: 'Databases/프로젝트/items/first.md',
          },
        ],
      },
      filesByPath: {
        '.workspace/schemas/db_123456.json': JSON.stringify(schema),
        'Databases/프로젝트/items/first.md': itemSource,
      },
    })

    await service.deleteItem('db_123456', 'item_123456')
    expect(trashService.moveEntryToTrash).toHaveBeenCalledWith(
      'Databases/프로젝트/items/first.md',
    )
  })
})
