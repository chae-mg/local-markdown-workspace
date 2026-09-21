import { describe, expect, it, vi } from 'vitest'

import type { FileSystemService } from '@/services/file-system.service'
import { BackupService } from '@/services/backup.service'

interface FakeHandle {
  name: string
}

const handle = { name: 'Workspace' }

describe('BackupService', () => {
  it('stores the original text and metadata in a protected backup folder', async () => {
    const fileSystem = {
      createDirectory: vi.fn(async () => undefined),
      writeTextFile: vi.fn(async () => undefined),
    } as unknown as FileSystemService<FakeHandle>
    const service = new BackupService(
      fileSystem,
      () => handle,
      () => new Date('2026-09-17T12:00:00.000Z'),
      () => 'backup_123456',
    )

    const snapshot = await service.createTextSnapshot({
      path: '.workspace/schemas/db_123456.json',
      reason: 'schema-change',
      source: '{"schemaVersion":1}\n',
    })

    expect(snapshot).toEqual({
      version: 1,
      id: 'backup_123456',
      originalPath: '.workspace/schemas/db_123456.json',
      payloadPath:
        '.workspace/backup/backup_123456/payload/.workspace/schemas/db_123456.json',
      reason: 'schema-change',
      createdAt: '2026-09-17T12:00:00.000Z',
      size: new TextEncoder().encode('{"schemaVersion":1}\n').byteLength,
    })
    expect(fileSystem.createDirectory).toHaveBeenCalledWith(
      handle,
      '.workspace/backup/backup_123456/payload/.workspace/schemas',
      { allowProtected: true },
    )
    expect(fileSystem.writeTextFile).toHaveBeenNthCalledWith(
      1,
      handle,
      snapshot.payloadPath,
      '{"schemaVersion":1}\n',
      { allowProtected: true },
    )
    expect(fileSystem.writeTextFile).toHaveBeenNthCalledWith(
      2,
      handle,
      '.workspace/backup/backup_123456/metadata.json',
      expect.stringContaining('"reason": "schema-change"'),
      { allowProtected: true },
    )
  })

  it('rejects an empty or invalid backup path before writing', async () => {
    const fileSystem = {
      createDirectory: vi.fn(async () => undefined),
      writeTextFile: vi.fn(async () => undefined),
    } as unknown as FileSystemService<FakeHandle>
    const service = new BackupService(fileSystem, () => handle)

    await expect(
      service.createTextSnapshot({ path: '', reason: 'test', source: 'x' }),
    ).rejects.toMatchObject({ code: 'protected-path' })
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })
})
