import { describe, expect, it, vi } from 'vitest'

import { DocumentConflictError } from '@/domain/document'
import type { FileMetadata } from '@/domain/file-system'
import { DocumentService } from '@/services/document.service'
import type { FileSystemService } from '@/services/file-system.service'

function createFileSystem(source = '# 처음\n', lastModified = 100) {
  let currentSource = source
  let currentLastModified = lastModified
  const metadata = (): FileMetadata => ({
    kind: 'file',
    lastModified: currentLastModified,
    mimeType: 'text/markdown',
    name: '메모.md',
    path: 'Documents/메모.md',
    size: new TextEncoder().encode(currentSource).byteLength,
  })
  const fileSystem = {
    createDirectory: vi.fn(),
    deleteEntry: vi.fn(),
    getDirectoryName: vi.fn(() => 'Workspace'),
    getFileMetadata: vi.fn(async () => metadata()),
    isSupported: vi.fn(() => true),
    listDirectory: vi.fn(async () => []),
    moveEntry: vi.fn(),
    queryPermission: vi.fn(async () => 'granted' as PermissionState),
    readFile: vi.fn(),
    readTextFile: vi.fn(async () => currentSource),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    selectDirectory: vi.fn(),
    writeFile: vi.fn(),
    writeTextFile: vi.fn(async (_root, _path, content: string) => {
      currentSource = content
      currentLastModified += 1
    }),
  } satisfies FileSystemService<object>

  return {
    fileSystem,
    readSource: () => currentSource,
    simulateExternalChange(nextSource: string) {
      currentSource = nextSource
      currentLastModified += 1
    },
  }
}

describe('DocumentService', () => {
  it('opens a Markdown file with a stable disk snapshot', async () => {
    const fixture = createFileSystem()
    const service = new DocumentService(fixture.fileSystem, () => ({}))

    await expect(service.openDocument('Documents/메모.md')).resolves.toEqual({
      lastModified: 100,
      path: 'Documents/메모.md',
      size: 9,
      source: '# 처음\n',
    })
  })

  it('saves when the disk version still matches the opened snapshot', async () => {
    const fixture = createFileSystem()
    const service = new DocumentService(fixture.fileSystem, () => ({}))

    const saved = await service.saveDocument({
      expectedLastModified: 100,
      expectedSource: '# 처음\n',
      path: 'Documents/메모.md',
      source: '# 수정\n',
    })

    expect(saved.source).toBe('# 수정\n')
    expect(saved.lastModified).toBe(101)
    expect(fixture.readSource()).toBe('# 수정\n')
  })

  it('blocks a save after an external change and preserves the draft', async () => {
    const fixture = createFileSystem()
    const service = new DocumentService(fixture.fileSystem, () => ({}))
    fixture.simulateExternalChange('# 외부 수정\n')

    await expect(
      service.saveDocument({
        expectedLastModified: 100,
        expectedSource: '# 처음\n',
        path: 'Documents/메모.md',
        source: '# 내 수정\n',
      }),
    ).rejects.toBeInstanceOf(DocumentConflictError)
    expect(fixture.readSource()).toBe('# 외부 수정\n')
  })

  it('overwrites only when force save is explicitly requested', async () => {
    const fixture = createFileSystem()
    const service = new DocumentService(fixture.fileSystem, () => ({}))
    fixture.simulateExternalChange('# 외부 수정\n')

    await service.saveDocument({
      expectedLastModified: 100,
      expectedSource: '# 처음\n',
      force: true,
      path: 'Documents/메모.md',
      source: '# 내 수정\n',
    })

    expect(fixture.readSource()).toBe('# 내 수정\n')
  })
})
