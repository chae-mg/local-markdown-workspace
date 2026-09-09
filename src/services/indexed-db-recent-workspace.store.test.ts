import { beforeEach, describe, expect, it } from 'vitest'

import { IndexedDbRecentWorkspaceStore } from '@/services/indexed-db-recent-workspace.store'

interface SerializableHandle {
  name: string
}

describe('IndexedDbRecentWorkspaceStore', () => {
  let store: IndexedDbRecentWorkspaceStore<SerializableHandle>

  beforeEach(async () => {
    store = new IndexedDbRecentWorkspaceStore<SerializableHandle>()
    await store.clear()
  })

  it('stores and restores the recent directory handle record', async () => {
    const workspace = {
      handle: { name: '내 문서' },
      name: '내 문서',
      lastOpened: '2026-09-09T12:00:00.000Z',
    }

    await store.save(workspace)

    await expect(store.load()).resolves.toEqual(workspace)
  })
})
