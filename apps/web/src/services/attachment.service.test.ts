import { describe, expect, it, vi } from 'vitest'

import {
  AttachmentService,
  relativePathFromDocument,
  resolveAttachmentPath,
} from '@/services/attachment.service'
import type { FileSystemService } from '@/services/file-system.service'

function createFileSystem(existingNames: string[] = []) {
  const files = new Map<string, File>()
  for (const name of existingNames) {
    files.set(
      `Attachments/${name}`,
      new File(['기존'], name, { type: 'application/octet-stream' }),
    )
  }

  const fileSystem = {
    createDirectory: vi.fn(),
    deleteEntry: vi.fn(),
    getDirectoryName: vi.fn(() => 'Workspace'),
    getFileMetadata: vi.fn(),
    isSupported: vi.fn(() => true),
    listDirectory: vi.fn(async () =>
      [...files.entries()].map(([path, file]) => ({
        kind: 'file' as const,
        name: file.name,
        path,
      })),
    ),
    moveEntry: vi.fn(),
    queryPermission: vi.fn(async () => 'granted' as PermissionState),
    readFile: vi.fn(async (_root, path: string) => {
      const file = files.get(path)
      if (!file) {
        throw new Error('missing file')
      }
      return file
    }),
    readTextFile: vi.fn(),
    requestPermission: vi.fn(async () => 'granted' as PermissionState),
    selectDirectory: vi.fn(),
    writeFile: vi.fn(async (_root, path: string, file: File) => {
      files.set(path, file)
    }),
    writeTextFile: vi.fn(),
  } satisfies FileSystemService<object>

  return { fileSystem, files }
}

describe('attachment paths', () => {
  it('creates portable relative paths from documents at different depths', () => {
    expect(
      relativePathFromDocument('Documents/회의록.md', 'Attachments/img_01.png'),
    ).toBe('../Attachments/img_01.png')
    expect(
      relativePathFromDocument(
        'Databases/Projects/items/item_01.md',
        'Attachments/img_01.png',
      ),
    ).toBe('../../../Attachments/img_01.png')
  })

  it('resolves only local files inside the Attachments directory', () => {
    expect(
      resolveAttachmentPath('Documents/회의록.md', '../Attachments/img_01.png'),
    ).toBe('Attachments/img_01.png')
    expect(
      resolveAttachmentPath('Documents/회의록.md', 'https://example.com/a.png'),
    ).toBeNull()
    expect(
      resolveAttachmentPath('Documents/회의록.md', '../../secret.txt'),
    ).toBeNull()
    expect(
      resolveAttachmentPath('Documents/회의록.md', '../Documents/다른.md'),
    ).toBeNull()
  })
})

describe('AttachmentService', () => {
  it('stores an image with a collision-safe name and returns Markdown', async () => {
    const fixture = createFileSystem(['img_same.png'])
    const createId = vi
      .fn()
      .mockReturnValueOnce('same')
      .mockReturnValueOnce('next')
    const service = new AttachmentService(
      fixture.fileSystem,
      () => ({}),
      createId,
    )
    const file = new File(['png'], '대시보드.png', { type: 'image/png' })

    const attachment = await service.saveAttachment('Documents/회의록.md', file)

    expect(attachment).toMatchObject({
      isImage: true,
      markdown: '![대시보드](../Attachments/img_next.png)',
      path: 'Attachments/img_next.png',
      relativePath: '../Attachments/img_next.png',
    })
    expect(fixture.files.get(attachment.path)).toBe(file)
    expect(createId).toHaveBeenCalledTimes(2)
  })

  it('stores a general file as a portable Markdown link', async () => {
    const fixture = createFileSystem()
    const service = new AttachmentService(
      fixture.fileSystem,
      () => ({}),
      () => 'report',
    )
    const file = new File(['pdf'], '분기 [보고서].pdf', {
      type: 'application/pdf',
    })

    await expect(
      service.saveAttachment('Documents/회의록.md', file),
    ).resolves.toMatchObject({
      isImage: false,
      markdown: '[분기 \\[보고서\\].pdf](../Attachments/file_report.pdf)',
      path: 'Attachments/file_report.pdf',
    })
  })

  it('loads a referenced local attachment for an editor preview', async () => {
    const fixture = createFileSystem(['img_preview.png'])
    const service = new AttachmentService(fixture.fileSystem, () => ({}))

    const file = await service.readAttachment(
      'Documents/회의록.md',
      '../Attachments/img_preview.png',
    )

    expect(file?.name).toBe('img_preview.png')
    await expect(
      service.readAttachment(
        'Documents/회의록.md',
        'https://example.com/image.png',
      ),
    ).resolves.toBeNull()
  })
})
