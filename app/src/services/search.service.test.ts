import { describe, expect, it, vi } from 'vitest'

import type { FileSystemService } from '@/services/file-system.service'
import { SearchService } from '@/services/search.service'
import type { WorkspaceApplicationService } from '@/services/workspace.service'

interface FakeHandle {
  name: string
}

function createService(options?: {
  indexContent?: string
  files?: Record<string, { name: string; source: string; lastModified: number }>
}) {
  const handle = { name: 'workspace' }
  const files = options?.files ?? {
    'Documents/회의.md': {
      name: '회의.md',
      source: '---\nproject: alpha\n---\n# 주간 회의\n검색 가능한 본문입니다.',
      lastModified: 1,
    },
    'Documents/계획.md': {
      name: '계획.md',
      source: '# 다음 계획\n다음 주 작업',
      lastModified: 2,
    },
  }
  const fileSystem = {
    createDirectory: vi.fn(async () => undefined),
    getFileMetadata: vi.fn(async (_root: FakeHandle, path: string) => {
      const file = files[path]
      if (!file) throw new Error('missing')
      return {
        kind: 'file' as const,
        name: file.name,
        path,
        lastModified: file.lastModified,
        mimeType: 'text/markdown',
        size: file.source.length,
      }
    }),
    readTextFile: vi.fn(async (_root: FakeHandle, path: string) => {
      if (path === '.workspace/search/index.json') {
        if (options?.indexContent === undefined) throw new Error('missing')
        return options.indexContent
      }
      const file = files[path]
      if (!file) throw new Error('missing')
      return file.source
    }),
    writeTextFile: vi.fn(async () => undefined),
  } as unknown as FileSystemService<FakeHandle>
  const workspace = {
    scanWorkspace: vi.fn(async () =>
      Object.entries(files).map(([path, file]) => ({
        kind: 'file' as const,
        name: file.name,
        path,
      })),
    ),
  } as unknown as WorkspaceApplicationService
  const service = new SearchService(
    fileSystem,
    () => handle,
    workspace,
    undefined,
    () => new Date('2026-09-18T00:00:00.000Z'),
  )
  return { fileSystem, service, workspace }
}

describe('SearchService', () => {
  it('searches filename, title, frontmatter, and body while returning match metadata', async () => {
    const { service } = createService()

    await expect(service.search('회의.md')).resolves.toEqual([
      expect.objectContaining({
        path: 'Documents/회의.md',
        matchKind: 'filename',
      }),
    ])
    await expect(service.search('주간 회의')).resolves.toEqual([
      expect.objectContaining({
        path: 'Documents/회의.md',
        matchKind: 'title',
      }),
    ])
    await expect(service.search('alpha')).resolves.toEqual([
      expect.objectContaining({
        path: 'Documents/회의.md',
        matchKind: 'property',
      }),
    ])
    await expect(service.search('검색 가능한')).resolves.toEqual([
      expect.objectContaining({ path: 'Documents/회의.md', matchKind: 'body' }),
    ])
  })

  it('rebuilds when the persisted index is missing or invalid', async () => {
    const { fileSystem, service } = createService({ indexContent: '{broken' })

    await expect(service.search('다음 계획')).resolves.toHaveLength(1)
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      expect.anything(),
      '.workspace/search/index.json',
      expect.stringContaining('"version": 1'),
      { allowProtected: true },
    )
  })

  it('reflects files added or changed outside the app after refresh', async () => {
    const files: Record<
      string,
      { name: string; source: string; lastModified: number }
    > = {
      'Documents/처음.md': {
        name: '처음.md',
        source: '# 처음\n기존 내용',
        lastModified: 1,
      },
    }
    const { service } = createService({ files })

    await expect(service.search('기존 내용')).resolves.toHaveLength(1)
    files['Documents/외부.md'] = {
      name: '외부.md',
      source: '# 외부 변경\n새로운 내용',
      lastModified: 3,
    }

    await expect(service.search('새로운 내용')).resolves.toEqual([
      expect.objectContaining({ path: 'Documents/외부.md' }),
    ])
  })
})
