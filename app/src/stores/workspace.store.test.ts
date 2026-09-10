import { describe, expect, it, vi } from 'vitest'

import { WorkspaceError } from '@/domain/errors'
import type { WorkspaceApplicationService } from '@/services/workspace.service'
import { createWorkspaceStore } from '@/stores/workspace.store'

function createService() {
  return {
    createFolder: vi.fn(async (_parentPath: string, name: string) => name),
    createMarkdownFile: vi.fn(
      async (_parentPath: string, name: string) => `${name}.md`,
    ),
    initializeWorkspace: vi.fn(),
    isSupported: vi.fn(() => true),
    moveEntryToTrash: vi.fn(),
    requestRecentWorkspacePermission: vi.fn(),
    restoreRecentWorkspace: vi.fn(async () => null),
    renameEntry: vi.fn(),
    scanWorkspace: vi.fn(async () => [
      { kind: 'directory' as const, name: 'Documents', path: 'Documents' },
      {
        kind: 'file' as const,
        name: '회의록.md',
        path: 'Documents/회의록.md',
      },
    ]),
    selectWorkspace: vi.fn(),
  } satisfies WorkspaceApplicationService
}

describe('workspace store file tree', () => {
  it('scans a ready workspace and selects only files in the result', async () => {
    const service = createService()
    const store = createWorkspaceStore(service)
    store.setState({ status: 'ready' })

    await store.getState().refreshWorkspace()

    expect(store.getState()).toMatchObject({
      entries: [
        { kind: 'directory', name: 'Documents', path: 'Documents' },
        {
          kind: 'file',
          name: '회의록.md',
          path: 'Documents/회의록.md',
        },
      ],
      treeErrorMessage: null,
      treeStatus: 'ready',
    })

    store.getState().selectEntry('Documents')
    expect(store.getState().selectedPath).toBeNull()

    store.getState().selectEntry('Documents/회의록.md')
    expect(store.getState().selectedPath).toBe('Documents/회의록.md')
  })

  it('keeps the last tree and exposes a separate scan error', async () => {
    const service = createService()
    service.scanWorkspace.mockRejectedValueOnce(new Error('읽기 실패'))
    const store = createWorkspaceStore(service)
    store.setState({
      entries: [{ kind: 'file', name: '기존.md', path: '기존.md' }],
      status: 'ready',
    })

    await store.getState().refreshWorkspace()

    expect(store.getState()).toMatchObject({
      entries: [{ kind: 'file', name: '기존.md', path: '기존.md' }],
      treeErrorMessage: '읽기 실패',
      treeStatus: 'error',
    })
  })

  it('creates a Markdown file and selects the new path', async () => {
    const service = createService()
    service.createMarkdownFile.mockResolvedValueOnce('Documents/새 문서.md')
    service.scanWorkspace.mockResolvedValueOnce([
      { kind: 'directory', name: 'Documents', path: 'Documents' },
      {
        kind: 'file',
        name: '새 문서.md',
        path: 'Documents/새 문서.md',
      },
    ])
    const store = createWorkspaceStore(service)
    store.setState({ status: 'ready' })

    await expect(
      store.getState().createMarkdownFile('Documents', '새 문서'),
    ).resolves.toBe(true)

    expect(service.createMarkdownFile).toHaveBeenCalledWith(
      'Documents',
      '새 문서',
    )
    expect(store.getState()).toMatchObject({
      mutationErrorMessage: null,
      mutationStatus: 'idle',
      selectedPath: 'Documents/새 문서.md',
    })
  })

  it('renames the selected file and follows its new path', async () => {
    const service = createService()
    service.renameEntry.mockResolvedValueOnce({
      kind: 'file',
      name: '주간회의.md',
      path: 'Documents/주간회의.md',
    })
    service.scanWorkspace.mockResolvedValueOnce([
      { kind: 'directory', name: 'Documents', path: 'Documents' },
      {
        kind: 'file',
        name: '주간회의.md',
        path: 'Documents/주간회의.md',
      },
    ])
    const store = createWorkspaceStore(service)
    store.setState({ status: 'ready' })

    await expect(
      store.getState().renameEntry('Documents/회의록.md', '주간회의'),
    ).resolves.toBe(true)
    expect(store.getState()).toMatchObject({
      selectedDirectoryPath: 'Documents',
      selectedPath: 'Documents/주간회의.md',
    })
  })

  it('moves the selected entry to trash and returns selection to its parent', async () => {
    const service = createService()
    service.moveEntryToTrash.mockResolvedValueOnce({
      version: 1,
      id: 'trash_123456',
      originalPath: 'Documents/회의록.md',
      payloadPath: '.workspace/trash/trash_123456/payload/회의록.md',
      kind: 'file',
      deletedAt: '2026-09-10T12:00:00.000Z',
    })
    service.scanWorkspace.mockResolvedValueOnce([
      { kind: 'directory', name: 'Documents', path: 'Documents' },
    ])
    const store = createWorkspaceStore(service)
    store.setState({
      entries: [
        { kind: 'directory', name: 'Documents', path: 'Documents' },
        {
          kind: 'file',
          name: '회의록.md',
          path: 'Documents/회의록.md',
        },
      ],
      selectedPath: 'Documents/회의록.md',
      status: 'ready',
    })

    await expect(
      store.getState().moveEntryToTrash('Documents/회의록.md'),
    ).resolves.toBe(true)
    expect(store.getState()).toMatchObject({
      entries: [{ kind: 'directory', name: 'Documents', path: 'Documents' }],
      selectedDirectoryPath: 'Documents',
      selectedPath: null,
    })
  })

  it('keeps the current workspace when choosing another folder is cancelled', async () => {
    const service = createService()
    service.selectWorkspace.mockRejectedValueOnce(
      new WorkspaceError('picker-cancelled', '폴더 선택을 취소했습니다.'),
    )
    const store = createWorkspaceStore(service)
    store.setState({
      entries: [{ kind: 'file', name: '기존.md', path: '기존.md' }],
      status: 'ready',
      workspace: {
        initialized: true,
        lastOpened: '2026-09-10T12:00:00.000Z',
        manifest: {
          workspaceVersion: 1,
          id: 'ws_existing',
          name: '기존 Workspace',
          createdAt: '2026-09-09T12:00:00.000Z',
        },
        name: '기존 Workspace',
        permission: 'granted',
      },
    })

    await store.getState().openWorkspace()

    expect(store.getState()).toMatchObject({
      entries: [{ kind: 'file', name: '기존.md', path: '기존.md' }],
      status: 'ready',
      workspace: { name: '기존 Workspace' },
    })
  })

  it('creates a Markdown file and refreshes the selected entry', async () => {
    const service = createService()
    service.createMarkdownFile.mockResolvedValueOnce('Documents/새 문서.md')
    service.scanWorkspace.mockResolvedValueOnce([
      { kind: 'directory', name: 'Documents', path: 'Documents' },
      {
        kind: 'file',
        name: '새 문서.md',
        path: 'Documents/새 문서.md',
      },
    ])
    const store = createWorkspaceStore(service)
    store.setState({ status: 'ready' })

    await expect(
      store.getState().createMarkdownFile('Documents', '새 문서'),
    ).resolves.toBe(true)
    expect(service.createMarkdownFile).toHaveBeenCalledWith(
      'Documents',
      '새 문서',
    )
    expect(store.getState()).toMatchObject({
      mutationErrorMessage: null,
      mutationStatus: 'idle',
      selectedDirectoryPath: 'Documents',
      selectedPath: 'Documents/새 문서.md',
    })
  })
})
