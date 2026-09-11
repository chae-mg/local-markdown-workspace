import {
  currentDatabaseSchemaVersion,
  DatabaseError,
  type DatabaseItem,
  type DatabaseSchema,
} from '@/domain/database'
import { WorkspaceError } from '@/domain/errors'
import type { MarkdownFrontmatter } from '@/domain/markdown'
import {
  markdownService,
  type MarkdownApplicationService,
} from '@/services/markdown.service'
import type { FileSystemService } from '@/services/file-system.service'
import { parsePropertyDefinitions } from '@/services/schema-validation'
import {
  joinWorkspacePath,
  normalizeWorkspaceEntryName,
  normalizeWorkspacePath,
} from '@/utils/path'

const schemasPath = '.workspace/schemas'
const databasesPath = 'Databases'

interface ItemTrashService {
  moveEntryToTrash(path: string): Promise<unknown>
}

export interface DatabaseApplicationService {
  createDatabase(name: string): Promise<DatabaseSchema>
  createItem(databaseId: string, title?: string): Promise<DatabaseItem>
  deleteItem(databaseId: string, itemId: string): Promise<void>
  listDatabases(): Promise<DatabaseSchema[]>
  loadDatabase(databaseId: string): Promise<DatabaseSchema>
  loadItems(databaseId: string): Promise<DatabaseItem[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertDatabaseId(value: string) {
  if (!/^db_[a-zA-Z0-9]+$/.test(value)) {
    throw new DatabaseError(
      'invalid-database',
      '유효하지 않은 Database ID입니다.',
    )
  }
  return value
}

function assertItemId(value: string) {
  if (!/^item_[a-zA-Z0-9]+$/.test(value)) {
    throw new DatabaseError('invalid-item', '유효하지 않은 Item ID입니다.')
  }
  return value
}

function parseSchema(source: string, expectedId: string): DatabaseSchema {
  let value: unknown

  try {
    value = JSON.parse(source)
  } catch (error) {
    throw new DatabaseError(
      'invalid-database',
      `${expectedId} Schema JSON을 읽을 수 없습니다.`,
      { cause: error },
    )
  }

  if (
    !isRecord(value) ||
    value.schemaVersion !== currentDatabaseSchemaVersion ||
    value.id !== expectedId ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    typeof value.folder !== 'string' ||
    !isRecord(value.properties)
  ) {
    throw new DatabaseError(
      'invalid-database',
      `${expectedId} Schema 형식이 올바르지 않습니다.`,
    )
  }

  let folder: string
  try {
    folder = normalizeWorkspacePath(value.folder)
  } catch (error) {
    throw new DatabaseError(
      'invalid-database',
      `${expectedId} Item 경로가 올바르지 않습니다.`,
      { cause: error },
    )
  }

  if (!folder.startsWith(`${databasesPath}/`) || !folder.endsWith('/items')) {
    throw new DatabaseError(
      'invalid-database',
      `${expectedId} Item 경로는 Databases 내부의 items 폴더여야 합니다.`,
    )
  }

  return {
    schemaVersion: currentDatabaseSchemaVersion,
    id: expectedId,
    name: value.name,
    folder,
    properties: parsePropertyDefinitions(value.properties),
  }
}

function titleFromBody(body: string) {
  for (const line of body.split(/\r?\n/)) {
    const match = /^#\s+(.+?)\s*$/.exec(line)
    if (match?.[1]) {
      return match[1]
    }
  }
  return '제목 없음'
}

export class DatabaseService<
  DirectoryHandle,
> implements DatabaseApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly trashService: ItemTrashService,
    private readonly markdown: MarkdownApplicationService = markdownService,
    private readonly createDatabaseId: () => string = () =>
      `db_${crypto.randomUUID().replaceAll('-', '')}`,
    private readonly createItemId: () => string = () =>
      `item_${crypto.randomUUID().replaceAll('-', '')}`,
  ) {}

  async createDatabase(name: string) {
    const root = this.getRoot()
    const normalizedName = normalizeWorkspaceEntryName(name)
    const databaseDirectory = joinWorkspacePath(databasesPath, normalizedName)

    await this.fileSystem.createDirectory(root, schemasPath, {
      allowProtected: true,
    })

    const databaseEntries = await this.fileSystem.listDirectory(
      root,
      databasesPath,
    )
    const comparableName = normalizedName.toLocaleLowerCase()
    if (
      databaseEntries.some(
        (entry) =>
          entry.name.normalize('NFC').toLocaleLowerCase() === comparableName,
      )
    ) {
      throw new WorkspaceError(
        'entry-already-exists',
        '같은 이름의 Database 폴더가 이미 있습니다.',
      )
    }

    const schemaEntries = await this.fileSystem.listDirectory(root, schemasPath)
    let id = this.createDatabaseId()
    let attempts = 0
    while (schemaEntries.some((entry) => entry.name === `${id}.json`)) {
      if (++attempts >= 10) {
        throw new DatabaseError(
          'invalid-database',
          '고유한 Database ID를 만들지 못했습니다.',
        )
      }
      id = this.createDatabaseId()
    }
    assertDatabaseId(id)

    const schema: DatabaseSchema = {
      schemaVersion: currentDatabaseSchemaVersion,
      id,
      name: normalizedName,
      folder: `${databaseDirectory}/items`,
      properties: {},
    }

    await this.fileSystem.createDirectory(root, schema.folder)
    try {
      await this.fileSystem.writeTextFile(
        root,
        `${schemasPath}/${id}.json`,
        `${JSON.stringify(schema, null, 2)}\n`,
        { allowProtected: true },
      )
    } catch (error) {
      await this.fileSystem
        .deleteEntry(root, databaseDirectory, { recursive: true })
        .catch(() => undefined)
      throw error
    }

    return schema
  }

  async listDatabases() {
    const root = this.getRoot()
    let entries
    try {
      entries = await this.fileSystem.listDirectory(root, schemasPath)
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === 'entry-not-found') {
        return []
      }
      throw error
    }

    const schemas = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.kind === 'file' && /^db_[a-zA-Z0-9]+\.json$/.test(entry.name),
        )
        .map(async (entry) => {
          const id = entry.name.slice(0, -'.json'.length)
          return parseSchema(
            await this.fileSystem.readTextFile(root, entry.path),
            id,
          )
        }),
    )
    return schemas.sort((left, right) =>
      left.name.localeCompare(right.name, 'ko'),
    )
  }

  async loadDatabase(databaseId: string) {
    const id = assertDatabaseId(databaseId)
    const root = this.getRoot()
    try {
      const source = await this.fileSystem.readTextFile(
        root,
        `${schemasPath}/${id}.json`,
      )
      return parseSchema(source, id)
    } catch (error) {
      if (error instanceof WorkspaceError && error.code === 'entry-not-found') {
        throw new DatabaseError(
          'database-not-found',
          'Database를 찾을 수 없습니다.',
          {
            cause: error,
          },
        )
      }
      throw error
    }
  }

  async createItem(databaseId: string, title = 'New Item') {
    const schema = await this.loadDatabase(databaseId)
    const normalizedTitle = title.trim()
    if (!normalizedTitle || /[\r\n]/.test(normalizedTitle)) {
      throw new DatabaseError('invalid-item', 'Item 제목을 입력해주세요.')
    }

    const root = this.getRoot()
    const entries = await this.fileSystem.listDirectory(root, schema.folder)
    let id = this.createItemId()
    let attempts = 0
    while (entries.some((entry) => entry.name === `${id}.md`)) {
      if (++attempts >= 10) {
        throw new DatabaseError(
          'invalid-item',
          '고유한 Item ID를 만들지 못했습니다.',
        )
      }
      id = this.createItemId()
    }
    assertItemId(id)

    const path = `${schema.folder}/${id}.md`
    const source = this.markdown.updateFrontmatter(`# ${normalizedTitle}\n`, {
      id,
    })
    await this.fileSystem.writeTextFile(root, path, source)
    const metadata = await this.fileSystem.getFileMetadata(root, path)
    return this.toItem(path, source, metadata.lastModified)
  }

  async loadItems(databaseId: string) {
    const schema = await this.loadDatabase(databaseId)
    const root = this.getRoot()
    const entries = await this.fileSystem.listDirectory(root, schema.folder)
    const items = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md'),
        )
        .map(async (entry) => {
          const [source, metadata] = await Promise.all([
            this.fileSystem.readTextFile(root, entry.path),
            this.fileSystem.getFileMetadata(root, entry.path),
          ])
          return this.toItem(entry.path, source, metadata.lastModified)
        }),
    )

    const seenIds = new Set<string>()
    for (const item of items) {
      if (seenIds.has(item.id)) {
        throw new DatabaseError(
          'duplicate-item-id',
          `중복된 Item ID가 있습니다: ${item.id}`,
        )
      }
      seenIds.add(item.id)
    }

    return items.sort(
      (left, right) =>
        right.lastModified - left.lastModified ||
        left.title.localeCompare(right.title, 'ko'),
    )
  }

  async deleteItem(databaseId: string, itemId: string) {
    const id = assertItemId(itemId)
    const item = (await this.loadItems(databaseId)).find(
      (candidate) => candidate.id === id,
    )
    if (!item) {
      throw new DatabaseError('invalid-item', '삭제할 Item을 찾을 수 없습니다.')
    }
    await this.trashService.moveEntryToTrash(item.path)
  }

  private toItem(
    path: string,
    source: string,
    lastModified: number | null,
  ): DatabaseItem {
    if (lastModified === null) {
      throw new DatabaseError(
        'invalid-item',
        `${path}의 수정 시간을 확인할 수 없습니다.`,
      )
    }

    const document = this.markdown.parseDocument(source)
    const frontmatter = document.frontmatter
    const id = frontmatter?.id
    if (typeof id !== 'string') {
      throw new DatabaseError('invalid-item', `${path}에 Item ID가 없습니다.`)
    }
    assertItemId(id)

    const properties = Object.assign(
      Object.create(null) as MarkdownFrontmatter,
      frontmatter,
    )
    delete properties.id
    return {
      id,
      path,
      title: titleFromBody(document.body),
      properties,
      body: document.body,
      lastModified,
    }
  }
}
