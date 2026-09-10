import { describe, expect, it, vi } from 'vitest'

import { WorkspaceError } from '@/domain/errors'
import type { WorkspaceApplicationService } from '@/services/workspace.service'
import { createWorkspaceStore } from '@/stores/workspace.store'

function createService() {
  return {
    initializeWorkspace: vi.fn(),
    isSupported: vi.fn(() => true),
    requestRecentWorkspacePermission: vi.fn(),
    restoreRecentWorkspace: vi.fn(async () => null),
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
})
