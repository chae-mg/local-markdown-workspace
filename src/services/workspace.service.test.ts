import { describe, expect, it, vi } from 'vitest'

import type { FileSystemService } from '@/services/file-system.service'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'
import { WorkspaceService } from '@/services/workspace.service'

interface FakeHandle {
  name: string
}

function createDependencies(permission: PermissionState) {
  const handle = { name: '업무 문서' }
  const fileSystem = {
    getDirectoryName: vi.fn(() => handle.name),
    isSupported: vi.fn(() => true),
    queryPermission: vi.fn(async () => permission),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    selectDirectory: vi.fn(async () => handle),
  } as unknown as FileSystemService<FakeHandle>
  const saved: { handle: FakeHandle; lastOpened: string; name: string }[] = []
  const store: RecentWorkspaceStore<FakeHandle> = {
    clear: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
    save: vi.fn(async (workspace) => {
      saved.push(workspace)
    }),
  }

  return { fileSystem, handle, saved, store }
}

describe('WorkspaceService', () => {
  it('opens a selected directory, requests permission, and remembers it', async () => {
    const { fileSystem, handle, saved, store } = createDependencies('prompt')
    const service = new WorkspaceService(
      fileSystem,
      store,
      () => new Date('2026-09-09T12:00:00.000Z'),
    )

    await expect(service.selectWorkspace()).resolves.toEqual({
      name: '업무 문서',
      permission: 'granted',
      lastOpened: '2026-09-09T12:00:00.000Z',
    })
    expect(fileSystem.requestPermission).toHaveBeenCalledWith(
      handle,
      'readwrite',
    )
    expect(saved).toEqual([
      {
        handle,
        name: '업무 문서',
        lastOpened: '2026-09-09T12:00:00.000Z',
      },
    ])
    expect(service.getCurrentHandle()).toBe(handle)
  })

  it('restores recent metadata without prompting outside a user gesture', async () => {
    const { fileSystem, handle, store } = createDependencies('prompt')
    vi.mocked(store.load).mockResolvedValue({
      handle,
      name: '업무 문서',
      lastOpened: '2026-09-08T12:00:00.000Z',
    })
    const service = new WorkspaceService(fileSystem, store)

    await expect(service.restoreRecentWorkspace()).resolves.toEqual({
      name: '업무 문서',
      permission: 'prompt',
      lastOpened: '2026-09-08T12:00:00.000Z',
    })
    expect(fileSystem.requestPermission).not.toHaveBeenCalled()
  })
})
