import { describe, expect, it, vi } from 'vitest'

import type { FileSystemService } from '@/services/file-system.service'
import { HealthCheckService } from '@/services/health-check.service'

interface FakeHandle {
  name: string
}

function createFixture(options?: { manifest?: unknown; itemSource?: string }) {
  const handle = { name: 'health-workspace' }
  const manifest = options?.manifest ?? {
    workspaceVersion: 1,
    id: 'ws_fixture',
    name: 'health-workspace',
    createdAt: '2026-09-18T00:00:00.000Z',
  }
  const schema = {
    schemaVersion: 1,
    id: 'db_fixture',
    name: '업무',
    folder: 'Databases/업무/items',
    properties: {
      prop_status: {
        id: 'prop_status',
        name: '상태',
        type: 'select',
        deleted: false,
        order: 0,
        options: [{ id: 'opt_todo', name: '예정' }],
      },
    },
  }
  const files: Record<string, string> = {
    '.workspace/workspace.json': JSON.stringify(manifest),
    '.workspace/schemas/db_fixture.json': JSON.stringify(schema),
    '.workspace/views/view_fixture.json': JSON.stringify({
      version: 1,
      id: 'view_fixture',
      databaseId: 'db_fixture',
      name: '기본',
      type: 'table',
      filters: [],
      sorts: [],
      hiddenProperties: [],
      propertyOrder: ['title', 'prop_status'],
    }),
    'Databases/업무/items/item_fixture.md':
      options?.itemSource ??
      '---\nid: item_fixture\nprop_status: opt_todo\n---\n# 업무 기록\n',
    'Documents/메모.md': '![첨부](../Attachments/img_fixture.png)',
    'Attachments/img_fixture.png': 'binary',
    '.workspace/trash/trash_fixture/metadata.json': JSON.stringify({
      version: 1,
      id: 'trash_fixture',
      originalPath: 'Documents/삭제.md',
      payloadPath: '.workspace/trash/trash_fixture/payload/삭제.md',
      kind: 'file',
      deletedAt: '2026-09-18T00:00:00.000Z',
    }),
    '.workspace/trash/trash_fixture/payload/삭제.md': '# 삭제',
  }
  const directories: Record<
    string,
    Array<{ kind: 'file' | 'directory'; name: string; path: string }>
  > = {
    '.workspace/schemas': [
      {
        kind: 'file',
        name: 'db_fixture.json',
        path: '.workspace/schemas/db_fixture.json',
      },
    ],
    'Databases/업무/items': [
      {
        kind: 'file',
        name: 'item_fixture.md',
        path: 'Databases/업무/items/item_fixture.md',
      },
    ],
    '.workspace/views': [
      {
        kind: 'file',
        name: 'view_fixture.json',
        path: '.workspace/views/view_fixture.json',
      },
    ],
    '.workspace/trash': [
      {
        kind: 'directory',
        name: 'trash_fixture',
        path: '.workspace/trash/trash_fixture',
      },
    ],
  }
  const fileSystem = {
    getFileMetadata: vi.fn(async (_root: FakeHandle, path: string) => {
      if (!(path in files)) throw new Error('missing')
      return {
        kind: 'file' as const,
        name: path.split('/').at(-1) ?? path,
        path,
        lastModified: 1,
        mimeType: null,
        size: files[path].length,
      }
    }),
    listDirectory: vi.fn(
      async (_root: FakeHandle, path = '') => directories[path] ?? [],
    ),
    readTextFile: vi.fn(async (_root: FakeHandle, path: string) => {
      if (!(path in files)) throw new Error('missing')
      return files[path]
    }),
    writeTextFile: vi.fn(
      async (_root: FakeHandle, path: string, content: string) => {
        files[path] = content
      },
    ),
  } as unknown as FileSystemService<FakeHandle>
  const workspace = {
    scanWorkspace: vi.fn(async () => [
      { kind: 'file' as const, name: '메모.md', path: 'Documents/메모.md' },
      {
        kind: 'file' as const,
        name: 'item_fixture.md',
        path: 'Databases/업무/items/item_fixture.md',
      },
    ]),
  }
  const backup = {
    createTextSnapshot: vi.fn(async () => ({
      version: 1 as const,
      id: 'backup_fixture',
      originalPath: '.workspace/workspace.json',
      payloadPath:
        '.workspace/backup/backup_fixture/payload/.workspace/workspace.json',
      reason: 'workspace-migration',
      createdAt: '2026-09-18T00:00:00.000Z',
      size: 1,
    })),
  }
  const service = new HealthCheckService(
    fileSystem,
    () => handle,
    workspace,
    backup,
  )
  return { backup, fileSystem, files, service }
}

describe('HealthCheckService', () => {
  it('reports a healthy workspace without modifying source files', async () => {
    const { fileSystem, service } = createFixture()

    await expect(service.run()).resolves.toMatchObject({
      healthy: true,
      issues: [],
    })
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('detects broken references and attachments as read-only issues', async () => {
    const { files, service } = createFixture({
      itemSource:
        '---\nid: item_fixture\nprop_missing: opt_missing\n---\n# 깨짐\n',
    })
    files['Documents/메모.md'] = '![첨부](../Attachments/missing.png)'

    const report = await service.run()

    expect(report.healthy).toBe(false)
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-reference' }),
        expect.objectContaining({ code: 'broken-attachment' }),
      ]),
    )
  })

  it('blocks future and unavailable migrations without writing', async () => {
    const { service } = createFixture({
      manifest: {
        workspaceVersion: 2,
        id: 'ws_fixture',
        name: 'future',
        createdAt: '2026-09-18T00:00:00.000Z',
      },
    })

    await expect(service.migrate(1)).rejects.toMatchObject({
      code: 'unsupported-source-version',
    })
    await expect(service.migrate(2)).rejects.toMatchObject({
      code: 'invalid-target-version',
    })
  })

  it('backs up and migrates a supported Version 0 manifest', async () => {
    const { backup, files, service } = createFixture({
      manifest: {
        workspaceVersion: 0,
        id: 'ws_fixture',
        name: 'legacy',
        createdAt: '2026-09-18T00:00:00.000Z',
      },
    })

    await expect(service.migrate(1)).resolves.toEqual({
      changed: true,
      fromVersion: 0,
      toVersion: 1,
    })
    expect(backup.createTextSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '.workspace/workspace.json',
        reason: 'workspace-migration',
      }),
    )
    expect(
      JSON.parse(files['.workspace/workspace.json']).workspaceVersion,
    ).toBe(1)
  })
})
