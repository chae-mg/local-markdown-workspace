import { describe, expect, it, vi } from 'vitest'

import type { RecentWorkspace, WorkspaceEntry } from '@/domain/file-system'
import type { FileSystemService } from '@/services/file-system.service'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'
import { WorkspaceService } from '@/services/workspace.service'

interface FakeHandle {
  name: string
}

const now = new Date('2026-09-09T12:00:00.000Z')
const workspaceId = 'ws_123456'

function createDependencies(options?: {
  entriesByPath?: Record<string, WorkspaceEntry[]>
  manifestContent?: string
  permission?: PermissionState
  recentWorkspace?: RecentWorkspace<FakeHandle> | null
}) {
  const handle = { name: '업무 문서' }
  const permission = options?.permission ?? 'granted'
  const entriesByPath = options?.entriesByPath ?? { '': [] }
  const fileSystem = {
    createDirectory: vi.fn(async () => undefined),
    getDirectoryName: vi.fn(() => handle.name),
    isSupported: vi.fn(() => true),
    listDirectory: vi.fn(
      async (_handle: FakeHandle, path = '') => entriesByPath[path] ?? [],
    ),
    getFileMetadata: vi.fn(),
    moveEntry: vi.fn(async () => undefined),
    queryPermission: vi.fn(async () => permission),
    readTextFile: vi.fn(async () => options?.manifestContent ?? ''),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    selectDirectory: vi.fn(async () => handle),
    writeTextFile: vi.fn(async () => undefined),
  } as unknown as FileSystemService<FakeHandle>
  const saved: RecentWorkspace<FakeHandle>[] = []
  const store: RecentWorkspaceStore<FakeHandle> = {
    clear: vi.fn(async () => undefined),
    load: vi.fn(async () => options?.recentWorkspace ?? null),
    save: vi.fn(async (workspace) => {
      saved.push(workspace)
    }),
  }

  const service = new WorkspaceService(
    fileSystem,
    store,
    () => now,
    () => workspaceId,
    () => 'trash_123456',
  )

  return { fileSystem, handle, saved, service, store }
}

describe('WorkspaceService', () => {
  it('initializes an empty selected folder and remembers it', async () => {
    const { fileSystem, handle, saved, service } = createDependencies({
      permission: 'prompt',
    })

    await expect(service.selectWorkspace()).resolves.toEqual({
      initialized: true,
      lastOpened: now.toISOString(),
      manifest: {
        workspaceVersion: 1,
        id: workspaceId,
        name: handle.name,
        createdAt: now.toISOString(),
      },
      name: handle.name,
      permission: 'granted',
    })
    expect(fileSystem.requestPermission).toHaveBeenCalledWith(
      handle,
      'readwrite',
    )
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(handle, 'Documents')
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(handle, 'Databases')
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      'Attachments',
    )
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      '.workspace/trash',
      { allowProtected: true },
    )
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      '.workspace/workspace.json',
      expect.stringContaining(`"id": "${workspaceId}"`),
      { allowProtected: true },
    )
    expect(saved).toEqual([
      {
        handle,
        name: handle.name,
        lastOpened: now.toISOString(),
      },
    ])
    expect(service.getCurrentHandle()).toBe(handle)
  })

  it('requires confirmation before initializing a non-empty folder', async () => {
    const { fileSystem, handle, service } = createDependencies({
      entriesByPath: {
        '': [{ kind: 'file', name: '기존문서.md', path: '기존문서.md' }],
      },
    })

    await expect(service.selectWorkspace()).resolves.toMatchObject({
      initialized: false,
      manifest: null,
      name: handle.name,
    })
    expect(fileSystem.createDirectory).not.toHaveBeenCalled()
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()

    await expect(service.initializeWorkspace()).resolves.toMatchObject({
      initialized: true,
      manifest: { id: workspaceId },
    })
    expect(fileSystem.writeTextFile).toHaveBeenCalledTimes(1)
  })

  it('creates new Markdown files and folders without overwriting entries', async () => {
    const { fileSystem, handle, service } = createDependencies({
      entriesByPath: {
        '': [],
        Documents: [
          {
            kind: 'file',
            name: '기존 문서.md',
            path: 'Documents/기존 문서.md',
          },
        ],
      },
    })
    await service.selectWorkspace()

    await expect(
      service.createMarkdownFile('Documents', '새 문서'),
    ).resolves.toBe('Documents/새 문서.md')
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      'Documents/새 문서.md',
      '',
    )

    await expect(service.createFolder('Documents', '프로젝트')).resolves.toBe(
      'Documents/프로젝트',
    )
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      'Documents/프로젝트',
    )

    await expect(
      service.createMarkdownFile('Documents', '기존 문서'),
    ).rejects.toMatchObject({ code: 'entry-already-exists' })
  })

  it('rejects unsafe entry names before touching the file system', async () => {
    const { fileSystem, service } = createDependencies()
    await service.selectWorkspace()
    vi.mocked(fileSystem.writeTextFile).mockClear()

    await expect(
      service.createMarkdownFile('Documents', '../비밀'),
    ).rejects.toMatchObject({ code: 'invalid-path' })
    await expect(
      service.createFolder('Documents', '잘못된?폴더'),
    ).rejects.toMatchObject({ code: 'invalid-path' })
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('renames an entry by moving it without overwriting a sibling', async () => {
    const { fileSystem, handle, service } = createDependencies({
      entriesByPath: { '': [], Documents: [] },
    })
    await service.selectWorkspace()
    vi.mocked(fileSystem.getFileMetadata).mockResolvedValue({
      kind: 'file',
      name: '회의록.md',
      path: 'Documents/회의록.md',
      lastModified: 1,
      mimeType: 'text/markdown',
      size: 10,
    })

    await expect(
      service.renameEntry('Documents/회의록.md', '주간회의'),
    ).resolves.toEqual({
      kind: 'file',
      name: '주간회의.md',
      path: 'Documents/주간회의.md',
    })
    expect(fileSystem.moveEntry).toHaveBeenCalledWith(
      handle,
      'Documents/회의록.md',
      'Documents/주간회의.md',
    )
  })

  it('moves an entry to a uniquely identified trash payload with metadata', async () => {
    const { fileSystem, handle, service } = createDependencies()
    await service.selectWorkspace()
    vi.mocked(fileSystem.getFileMetadata).mockResolvedValue({
      kind: 'file',
      name: '회의록.md',
      path: 'Documents/회의록.md',
      lastModified: 1,
      mimeType: 'text/markdown',
      size: 10,
    })

    await expect(
      service.moveEntryToTrash('Documents/회의록.md'),
    ).resolves.toEqual({
      version: 1,
      id: 'trash_123456',
      originalPath: 'Documents/회의록.md',
      payloadPath: '.workspace/trash/trash_123456/payload/회의록.md',
      kind: 'file',
      deletedAt: now.toISOString(),
    })
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      '.workspace/trash/trash_123456/payload',
      { allowProtected: true },
    )
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      '.workspace/trash/trash_123456/metadata.json',
      expect.stringContaining('"originalPath": "Documents/회의록.md"'),
      { allowProtected: true },
    )
    expect(fileSystem.moveEntry).toHaveBeenCalledWith(
      handle,
      'Documents/회의록.md',
      '.workspace/trash/trash_123456/payload/회의록.md',
      { allowProtected: true },
    )
  })

  it('restores an existing manifest without changing its immutable ID', async () => {
    const recentWorkspace = {
      handle: { name: '업무 문서' },
      name: '업무 문서',
      lastOpened: '2026-09-08T12:00:00.000Z',
    }
    const manifest = {
      workspaceVersion: 1,
      id: 'ws_existing',
      name: '업무 문서',
      createdAt: '2026-09-01T12:00:00.000Z',
    }
    const { fileSystem, service } = createDependencies({
      entriesByPath: {
        '': [{ kind: 'directory', name: '.workspace', path: '.workspace' }],
        '.workspace': [
          {
            kind: 'file',
            name: 'workspace.json',
            path: '.workspace/workspace.json',
          },
        ],
      },
      manifestContent: JSON.stringify(manifest),
      recentWorkspace,
    })

    await expect(service.restoreRecentWorkspace()).resolves.toMatchObject({
      initialized: true,
      manifest,
    })
    expect(fileSystem.createDirectory).not.toHaveBeenCalled()
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('restores recent metadata without prompting outside a user gesture', async () => {
    const recentWorkspace = {
      handle: { name: '업무 문서' },
      name: '업무 문서',
      lastOpened: '2026-09-08T12:00:00.000Z',
    }
    const { fileSystem, service } = createDependencies({
      permission: 'prompt',
      recentWorkspace,
    })

    await expect(service.restoreRecentWorkspace()).resolves.toEqual({
      initialized: false,
      manifest: null,
      name: '업무 문서',
      permission: 'prompt',
      lastOpened: recentWorkspace.lastOpened,
    })
    expect(fileSystem.requestPermission).not.toHaveBeenCalled()
    expect(fileSystem.listDirectory).not.toHaveBeenCalled()
  })

  it('does not overwrite a manifest from an unsupported future version', async () => {
    const { fileSystem, service } = createDependencies({
      entriesByPath: {
        '': [{ kind: 'directory', name: '.workspace', path: '.workspace' }],
        '.workspace': [
          {
            kind: 'file',
            name: 'workspace.json',
            path: '.workspace/workspace.json',
          },
        ],
      },
      manifestContent: JSON.stringify({
        workspaceVersion: 2,
        id: 'ws_future',
        name: '미래 Workspace',
        createdAt: '2026-09-01T12:00:00.000Z',
      }),
    })

    await expect(service.selectWorkspace()).rejects.toMatchObject({
      code: 'unsupported-workspace-version',
    })
    expect(fileSystem.createDirectory).not.toHaveBeenCalled()
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('scans folders and Markdown files while excluding app metadata', async () => {
    const { service } = createDependencies({
      entriesByPath: {
        '': [
          { kind: 'directory', name: '.workspace', path: '.workspace' },
          { kind: 'directory', name: 'Documents', path: 'Documents' },
          { kind: 'file', name: '메모.txt', path: '메모.txt' },
        ],
        Documents: [
          {
            kind: 'file',
            name: '회의록.md',
            path: 'Documents/회의록.md',
          },
        ],
      },
    })

    await service.selectWorkspace()

    await expect(service.scanWorkspace()).resolves.toEqual([
      { kind: 'directory', name: 'Documents', path: 'Documents' },
      {
        kind: 'file',
        name: '회의록.md',
        path: 'Documents/회의록.md',
      },
    ])
  })
})
