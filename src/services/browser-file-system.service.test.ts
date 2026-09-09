import { describe, expect, it } from 'vitest'

import { WorkspaceError } from '@/domain/errors'
import { BrowserFileSystemService } from '@/services/browser-file-system.service'

class FakeFileHandle {
  readonly kind = 'file' as const
  private content = new Uint8Array()

  constructor(readonly name: string) {}

  async getFile() {
    return new File([this.content], this.name, {
      lastModified: 1_789_000_000_000,
      type: 'text/markdown',
    })
  }

  async createWritable() {
    return {
      abort: async () => undefined,
      close: async () => undefined,
      write: async (value: FileSystemWriteChunkType) => {
        if (typeof value === 'string') {
          this.content = new TextEncoder().encode(value)
          return
        }

        if (value instanceof ArrayBuffer) {
          this.content = new Uint8Array(value)
          return
        }

        if (ArrayBuffer.isView(value)) {
          this.content = new Uint8Array(
            value.buffer.slice(
              value.byteOffset,
              value.byteOffset + value.byteLength,
            ),
          )
          return
        }

        throw new Error('Fake writable received an unsupported value')
      },
    }
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory' as const
  readonly entries = new Map<string, FakeDirectoryHandle | FakeFileHandle>()

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name)
    if (existing?.kind === 'directory') {
      return existing
    }
    if (existing) {
      throw new DOMException('Wrong entry type', 'TypeMismatchError')
    }
    if (!options?.create) {
      throw new DOMException('Missing directory', 'NotFoundError')
    }

    const directory = new FakeDirectoryHandle(name)
    this.entries.set(name, directory)
    return directory
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.entries.get(name)
    if (existing?.kind === 'file') {
      return existing
    }
    if (existing) {
      throw new DOMException('Wrong entry type', 'TypeMismatchError')
    }
    if (!options?.create) {
      throw new DOMException('Missing file', 'NotFoundError')
    }

    const file = new FakeFileHandle(name)
    this.entries.set(name, file)
    return file
  }

  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const existing = this.entries.get(name)
    if (!existing) {
      throw new DOMException('Missing entry', 'NotFoundError')
    }
    if (
      existing.kind === 'directory' &&
      existing.entries.size > 0 &&
      !options?.recursive
    ) {
      throw new DOMException(
        'Directory is not empty',
        'InvalidModificationError',
      )
    }

    this.entries.delete(name)
  }

  async *values() {
    yield* this.entries.values()
  }
}

function asDirectoryHandle(handle: FakeDirectoryHandle) {
  return handle as unknown as FileSystemDirectoryHandle
}

describe('BrowserFileSystemService', () => {
  it('creates, writes, reads, lists, and moves Markdown files', async () => {
    const service = new BrowserFileSystemService()
    const root = asDirectoryHandle(new FakeDirectoryHandle('Workspace'))

    await service.createDirectory(root, 'Documents')
    await service.writeTextFile(
      root,
      'Documents/회의록.md',
      '# 회의록\n\n안녕하세요.',
    )

    await expect(
      service.readTextFile(root, 'Documents/회의록.md'),
    ).resolves.toBe('# 회의록\n\n안녕하세요.')
    await expect(service.listDirectory(root, 'Documents')).resolves.toEqual([
      { kind: 'file', name: '회의록.md', path: 'Documents/회의록.md' },
    ])
    await expect(
      service.getFileMetadata(root, 'Documents/회의록.md'),
    ).resolves.toMatchObject({
      kind: 'file',
      mimeType: 'text/markdown',
      name: '회의록.md',
      path: 'Documents/회의록.md',
    })

    await service.moveEntry(
      root,
      'Documents/회의록.md',
      'Documents/주간회의.md',
    )
    await expect(
      service.readTextFile(root, 'Documents/주간회의.md'),
    ).resolves.toBe('# 회의록\n\n안녕하세요.')
    await expect(
      service.readTextFile(root, 'Documents/회의록.md'),
    ).rejects.toMatchObject({ code: 'entry-not-found' })

    await service.createDirectory(root, 'Documents/Archive')
    await service.writeTextFile(
      root,
      'Documents/Archive/결정사항.md',
      '# 결정사항',
    )
    await service.moveEntry(root, 'Documents/Archive', 'Archive')
    await expect(
      service.readTextFile(root, 'Archive/결정사항.md'),
    ).resolves.toBe('# 결정사항')
  })

  it('blocks normal mutations inside application metadata', async () => {
    const service = new BrowserFileSystemService()
    const root = asDirectoryHandle(new FakeDirectoryHandle('Workspace'))

    await expect(
      service.createDirectory(root, '.workspace'),
    ).rejects.toBeInstanceOf(WorkspaceError)
    await expect(
      service.createDirectory(root, '.workspace', { allowProtected: true }),
    ).resolves.toBeUndefined()
  })
})
