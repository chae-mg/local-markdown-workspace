import { describe, expect, it, vi } from 'vitest'

import type {
  DatabaseItem,
  DatabaseSchema,
  PropertyDefinition,
  PropertyId,
} from '@/domain/database'
import type { DatabaseApplicationService } from '@/services/database.service'
import type { BackupApplicationService } from '@/services/backup.service'
import type { FileSystemService } from '@/services/file-system.service'
import { SchemaService } from '@/services/schema.service'

interface FakeHandle {
  name: string
}

const handle = { name: 'Workspace' }

function property(
  id: PropertyId,
  name: string,
  type: PropertyDefinition['type'],
  order: number,
): PropertyDefinition {
  const base = { id, name, deleted: false, order }
  return type === 'select' || type === 'multi_select'
    ? { ...base, type, options: [] }
    : { ...base, type }
}

function createService(options?: {
  backups?: BackupApplicationService
  items?: DatabaseItem[]
  properties?: Record<PropertyId, PropertyDefinition>
}) {
  let currentSchema: DatabaseSchema = {
    schemaVersion: 1,
    id: 'db_123456',
    name: '프로젝트',
    folder: 'Databases/프로젝트/items',
    properties: options?.properties ?? {},
  }
  const fileSystem = {
    readTextFile: vi.fn(async () => ''),
    writeTextFile: vi.fn(
      async (_root: FakeHandle, _path: string, source: string) => {
        currentSchema = JSON.parse(source) as DatabaseSchema
      },
    ),
  } as unknown as FileSystemService<FakeHandle>
  const databases = {
    createDatabase: vi.fn(),
    createItem: vi.fn(),
    deleteItem: vi.fn(),
    listDatabases: vi.fn(),
    loadDatabase: vi.fn(async () => currentSchema),
    loadItems: vi.fn(async () => options?.items ?? []),
  } as unknown as DatabaseApplicationService
  const propertyIds = ['prop_first', 'prop_second']
  const optionIds = ['opt_first', 'opt_second']
  const service = new SchemaService(
    fileSystem,
    () => handle,
    databases,
    () => propertyIds.shift() ?? 'prop_fallback',
    () => optionIds.shift() ?? 'opt_fallback',
    options?.backups,
  )
  return {
    databases,
    fileSystem,
    getSchema: () => currentSchema,
    service,
  }
}

describe('SchemaService', () => {
  it('creates stable Property IDs and increasing display order', async () => {
    const { fileSystem, service } = createService({
      properties: {
        prop_existing: property('prop_existing', '설명', 'text', 1),
      },
    })

    const schema = await service.createProperty('db_123456', '완료', 'checkbox')

    expect(schema.properties.prop_first).toEqual({
      id: 'prop_first',
      name: '완료',
      type: 'checkbox',
      deleted: false,
      order: 2,
    })
    expect(fileSystem.writeTextFile).toHaveBeenCalledWith(
      handle,
      '.workspace/schemas/db_123456.json',
      expect.stringContaining('"prop_first"'),
      { allowProtected: true },
    )
  })

  it('creates a Backup Snapshot before changing the Schema file', async () => {
    const backups: BackupApplicationService = {
      createTextSnapshot: vi.fn(async () => ({
        version: 1 as const,
        id: 'backup_123456',
        originalPath: '.workspace/schemas/db_123456.json',
        payloadPath:
          '.workspace/backup/backup_123456/payload/.workspace/schemas/db_123456.json',
        reason: 'schema-change',
        createdAt: '2026-09-17T12:00:00.000Z',
        size: 10,
      })),
    }
    const { fileSystem, service } = createService({
      backups,
      properties: {
        prop_existing: property('prop_existing', '설명', 'text', 1),
      },
    })
    vi.mocked(fileSystem.readTextFile).mockResolvedValueOnce(
      '{"schemaVersion":1}\n',
    )

    await service.createProperty('db_123456', '완료', 'checkbox')

    expect(backups.createTextSnapshot).toHaveBeenCalledWith({
      path: '.workspace/schemas/db_123456.json',
      reason: 'schema-change',
      source: '{"schemaVersion":1}\n',
    })
    expect(fileSystem.writeTextFile).toHaveBeenCalled()
  })

  it('does not write the Schema when its Backup Snapshot fails', async () => {
    const backups: BackupApplicationService = {
      createTextSnapshot: vi.fn(async () => {
        throw new Error('백업 저장 공간이 부족합니다.')
      }),
    }
    const { fileSystem, service } = createService({
      backups,
      properties: {
        prop_existing: property('prop_existing', '설명', 'text', 1),
      },
    })
    vi.mocked(fileSystem.readTextFile).mockResolvedValueOnce(
      '{"schemaVersion":1}\n',
    )

    await expect(
      service.createProperty('db_123456', '완료', 'checkbox'),
    ).rejects.toThrow('백업 저장 공간이 부족합니다.')
    expect(fileSystem.writeTextFile).not.toHaveBeenCalled()
  })

  it('renames, soft deletes, and restores without writing Item files', async () => {
    const { fileSystem, getSchema, service } = createService({
      properties: {
        prop_status: property('prop_status', '상태', 'text', 1),
      },
    })

    await service.renameProperty('db_123456', 'prop_status', '진행 상태')
    await service.softDeleteProperty('db_123456', 'prop_status')
    await service.restoreProperty('db_123456', 'prop_status')

    expect(getSchema().properties.prop_status).toMatchObject({
      id: 'prop_status',
      name: '진행 상태',
      deleted: false,
    })
    expect(
      vi
        .mocked(fileSystem.writeTextFile)
        .mock.calls.every(([, path]) =>
          String(path).startsWith('.workspace/schemas/'),
        ),
    ).toBe(true)
  })

  it('blocks incompatible type changes but allows compatible date strings', async () => {
    const textProperty = property('prop_value', '값', 'text', 1)
    const incompatible = createService({
      properties: { prop_value: textProperty },
      items: [
        {
          id: 'item_1',
          path: 'Databases/프로젝트/items/item_1.md',
          title: '문자 항목',
          properties: { prop_value: '숫자 아님' },
          body: '# 문자 항목',
          lastModified: 1,
          source: '# 문자 항목',
        },
      ],
    })

    await expect(
      incompatible.service.changePropertyType(
        'db_123456',
        'prop_value',
        'number',
      ),
    ).rejects.toMatchObject({ code: 'incompatible-property-type' })
    expect(incompatible.fileSystem.writeTextFile).not.toHaveBeenCalled()

    const compatible = createService({
      properties: { prop_value: textProperty },
      items: [
        {
          id: 'item_2',
          path: 'Databases/프로젝트/items/item_2.md',
          title: '날짜 항목',
          properties: { prop_value: '2026-09-11' },
          body: '# 날짜 항목',
          lastModified: 1,
          source: '# 날짜 항목',
        },
      ],
    })
    await expect(
      compatible.service.changePropertyType('db_123456', 'prop_value', 'date'),
    ).resolves.toMatchObject({
      properties: { prop_value: { id: 'prop_value', type: 'date' } },
    })
  })

  it('manages Select options with stable IDs and soft deletion', async () => {
    const { getSchema, service } = createService({
      properties: {
        prop_status: property('prop_status', '상태', 'select', 1),
      },
    })

    await service.addOption('db_123456', 'prop_status', '예정')
    await service.renameOption('db_123456', 'prop_status', 'opt_first', '할 일')
    await service.softDeleteOption('db_123456', 'prop_status', 'opt_first')
    await service.restoreOption('db_123456', 'prop_status', 'opt_first')

    expect(getSchema().properties.prop_status).toMatchObject({
      options: [{ id: 'opt_first', name: '할 일', deleted: false }],
    })
  })

  it('moves visible Properties by swapping their stable order values', async () => {
    const { service } = createService({
      properties: {
        prop_first: property('prop_first', '첫째', 'text', 1),
        prop_second: property('prop_second', '둘째', 'number', 2),
      },
    })

    const schema = await service.moveProperty('db_123456', 'prop_second', 'up')
    expect(schema.properties.prop_first.order).toBe(2)
    expect(schema.properties.prop_second.order).toBe(1)
  })

  it('rejects duplicate active or deleted Property names', async () => {
    const { service } = createService({
      properties: {
        prop_existing: {
          ...property('prop_existing', 'Priority', 'text', 1),
          deleted: true,
        },
      },
    })

    await expect(
      service.createProperty('db_123456', 'priority', 'number'),
    ).rejects.toMatchObject({ code: 'duplicate-property-name' })
  })
})
