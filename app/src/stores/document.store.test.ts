import { describe, expect, it, vi } from 'vitest'

import { DocumentConflictError, type DocumentSnapshot } from '@/domain/document'
import type { DocumentApplicationService } from '@/services/document.service'
import { createDocumentStore } from '@/stores/document.store'

const openedDocument: DocumentSnapshot = {
  lastModified: 100,
  path: 'Documents/메모.md',
  size: 9,
  source: '# 처음\n',
}

function createService() {
  return {
    openDocument: vi.fn(async () => openedDocument),
    saveDocument: vi.fn(async (request) => ({
      lastModified: 101,
      path: request.path,
      size: new TextEncoder().encode(request.source).byteLength,
      source: request.source,
    })),
  } satisfies DocumentApplicationService
}

describe('document store', () => {
  it('keeps a draft and advances the saved snapshot after saving', async () => {
    const service = createService()
    const store = createDocumentStore(service)

    await store.getState().openDocument(openedDocument.path)
    store.getState().updateDraft('# 수정\n')
    await expect(store.getState().saveDocument()).resolves.toBe(true)

    expect(service.saveDocument).toHaveBeenCalledWith({
      expectedLastModified: 100,
      expectedSource: '# 처음\n',
      force: false,
      path: openedDocument.path,
      source: '# 수정\n',
    })
    expect(store.getState()).toMatchObject({
      document: { lastModified: 101, source: '# 수정\n' },
      draftSource: '# 수정\n',
      status: 'ready',
    })
  })

  it('keeps the local draft when an external change causes a conflict', async () => {
    const service = createService()
    service.saveDocument.mockRejectedValueOnce(
      new DocumentConflictError(openedDocument.path, 200),
    )
    const store = createDocumentStore(service)

    await store.getState().openDocument(openedDocument.path)
    store.getState().updateDraft('# 내 수정\n')
    await expect(store.getState().saveDocument()).resolves.toBe(false)

    expect(store.getState()).toMatchObject({
      draftSource: '# 내 수정\n',
      status: 'conflict',
    })
  })

  it('passes an explicit force flag after the user chooses overwrite', async () => {
    const service = createService()
    const store = createDocumentStore(service)

    await store.getState().openDocument(openedDocument.path)
    store.getState().updateDraft('# 내 수정\n')
    store.setState({ status: 'conflict' })
    await expect(store.getState().forceSave()).resolves.toBe(true)

    expect(service.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, source: '# 내 수정\n' }),
    )
  })
})
