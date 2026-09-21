import {
  currentDatabaseSchemaVersion,
  type DatabaseSchema,
} from '@/domain/database'
import {
  currentDatabaseViewVersion,
  titleViewPropertyId,
} from '@/domain/database-view'
import {
  type HealthCheckReport,
  type HealthIssue,
  MigrationError,
  type MigrationResult,
} from '@/domain/health-check'
import type { WorkspaceEntry } from '@/domain/file-system'
import {
  currentTrashEntryVersion,
  currentWorkspaceVersion,
} from '@/domain/workspace'
import type { FileSystemService } from '@/services/file-system.service'
import { markdownService } from '@/services/markdown.service'
import type { BackupApplicationService } from '@/services/backup.service'
import type { WorkspaceApplicationService } from '@/services/workspace.service'
import { normalizeWorkspacePath } from '@/utils/path'

const schemasPath = '.workspace/schemas'
const viewsPath = '.workspace/views'
const trashPath = '.workspace/trash'
const manifestPath = '.workspace/workspace.json'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function issue(
  code: HealthIssue['code'],
  path: string,
  message: string,
  severity: HealthIssue['severity'] = 'error',
): HealthIssue {
  return { code, message, path, severity }
}

function parseJson(source: string) {
  try {
    return JSON.parse(source) as unknown
  } catch {
    return null
  }
}

function idFromFileName(name: string, prefix: string, suffix: string) {
  if (!name.startsWith(prefix) || !name.endsWith(suffix)) return null
  const id = name.slice(prefix.length, -suffix.length)
  return id || null
}

function directoryOf(path: string) {
  const segments = path.split('/')
  segments.pop()
  return segments.join('/')
}

function resolveRelativePath(sourcePath: string, target: string) {
  const cleanTarget = target.split(/[?#]/, 1)[0]?.trim() ?? ''
  if (
    !cleanTarget ||
    cleanTarget.startsWith('#') ||
    cleanTarget.startsWith('/') ||
    /^[a-z][a-z\d+.-]*:/i.test(cleanTarget)
  ) {
    return null
  }

  const base = directoryOf(sourcePath)
  const segments = `${base}/${cleanTarget}`.replaceAll('\\', '/').split('/')
  const resolved: string[] = []
  for (const segment of segments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (resolved.length === 0) return null
      resolved.pop()
    } else {
      resolved.push(segment)
    }
  }
  return normalizeWorkspacePath(resolved.join('/'))
}

function attachmentTargets(source: string) {
  return [...source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(
    (match) => match[1] ?? '',
  )
}

function propertyReferences(value: Record<string, unknown>) {
  const references = new Set<string>()
  for (const collection of [value.filters, value.sorts]) {
    if (Array.isArray(collection)) {
      for (const item of collection) {
        if (isRecord(item) && typeof item.propertyId === 'string') {
          references.add(item.propertyId)
        }
      }
    }
  }
  for (const key of ['hiddenProperties', 'propertyOrder']) {
    if (Array.isArray(value[key])) {
      for (const item of value[key]) {
        if (typeof item === 'string') references.add(item)
      }
    }
  }
  if (typeof value.groupBy === 'string') references.add(value.groupBy)
  return references
}

export interface HealthCheckApplicationService {
  run(): Promise<HealthCheckReport>
  migrate(targetVersion: number): Promise<MigrationResult>
}

export class HealthCheckService<
  DirectoryHandle,
> implements HealthCheckApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly workspace: Pick<
      WorkspaceApplicationService,
      'scanWorkspace'
    >,
    private readonly backup?: Pick<
      BackupApplicationService,
      'createTextSnapshot'
    >,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run() {
    const root = this.getRoot()
    const issues: HealthIssue[] = []
    const schemas = new Map<string, DatabaseSchema>()
    const itemIds = new Set<string>()

    await this.checkManifest(root, issues)
    await this.checkSchemas(root, issues, schemas, itemIds)
    await this.checkViews(root, issues, schemas)
    await this.checkAttachments(root, issues)
    await this.checkTrash(root, issues)

    return {
      checkedAt: this.now().toISOString(),
      healthy: issues.length === 0,
      issues,
    } satisfies HealthCheckReport
  }

  async migrate(targetVersion: number) {
    if (targetVersion !== currentWorkspaceVersion) {
      throw new MigrationError(
        'invalid-target-version',
        `지원하는 Workspace 목표 버전은 ${currentWorkspaceVersion}입니다.`,
      )
    }

    const root = this.getRoot()
    const source = await this.fileSystem.readTextFile(root, manifestPath)
    const parsed = parseJson(source)
    const fromVersion =
      isRecord(parsed) && typeof parsed.workspaceVersion === 'number'
        ? parsed.workspaceVersion
        : NaN

    if (!Number.isInteger(fromVersion)) {
      throw new MigrationError(
        'unsupported-source-version',
        'Migration을 시작할 수 있도록 Workspace Version을 읽지 못했습니다.',
      )
    }
    if (fromVersion > currentWorkspaceVersion) {
      throw new MigrationError(
        'unsupported-source-version',
        `미래 Workspace Version(${fromVersion})은 현재 버전으로 되돌릴 수 없습니다.`,
      )
    }
    if (fromVersion < currentWorkspaceVersion) {
      if (fromVersion !== 0 || !this.isLegacyManifest(parsed)) {
        throw new MigrationError(
          'migration-unavailable',
          `${fromVersion}에서 ${currentWorkspaceVersion}으로 가는 Migration 경로가 없습니다. 원본은 변경하지 않았습니다.`,
        )
      }
      if (!this.backup) {
        throw new MigrationError(
          'migration-unavailable',
          'Migration 전에 원본 Backup을 만들 수 없어 중단했습니다.',
        )
      }

      await this.backup.createTextSnapshot({
        path: manifestPath,
        reason: 'workspace-migration',
        source,
      })
      const migratedSource = `${JSON.stringify(
        { ...parsed, workspaceVersion: currentWorkspaceVersion },
        null,
      )}\n`
      await this.fileSystem.writeTextFile(root, manifestPath, migratedSource, {
        allowProtected: true,
      })

      const validation = await this.run()
      if (!validation.healthy) {
        await this.fileSystem.writeTextFile(root, manifestPath, source, {
          allowProtected: true,
        })
        throw new MigrationError(
          'migration-validation-failed',
          'Migration 후 Health Check에 실패해 원본 Manifest를 복원했습니다.',
        )
      }

      return {
        changed: true,
        fromVersion,
        toVersion: targetVersion,
      }
    }

    return { changed: false, fromVersion, toVersion: targetVersion }
  }

  private isLegacyManifest(value: unknown): value is Record<string, unknown> {
    return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      /^ws_[a-zA-Z0-9]+$/.test(value.id) &&
      typeof value.name === 'string' &&
      Boolean(value.name.trim()) &&
      typeof value.createdAt === 'string' &&
      !Number.isNaN(Date.parse(value.createdAt))
    )
  }

  private async checkManifest(root: DirectoryHandle, issues: HealthIssue[]) {
    let parsed: unknown
    try {
      parsed = parseJson(await this.fileSystem.readTextFile(root, manifestPath))
    } catch {
      issues.push(
        issue(
          'invalid-manifest',
          manifestPath,
          'Workspace Manifest를 읽을 수 없습니다.',
        ),
      )
      return
    }
    if (
      !isRecord(parsed) ||
      parsed.workspaceVersion !== currentWorkspaceVersion ||
      typeof parsed.id !== 'string' ||
      !/^ws_[a-zA-Z0-9]+$/.test(parsed.id) ||
      typeof parsed.name !== 'string' ||
      !parsed.name.trim() ||
      typeof parsed.createdAt !== 'string' ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      issues.push(
        issue(
          parsed &&
            isRecord(parsed) &&
            parsed.workspaceVersion !== currentWorkspaceVersion
            ? 'unsupported-version'
            : 'invalid-manifest',
          manifestPath,
          'Workspace Manifest 형식 또는 Version이 올바르지 않습니다.',
        ),
      )
    }
  }

  private async checkSchemas(
    root: DirectoryHandle,
    issues: HealthIssue[],
    schemas: Map<string, DatabaseSchema>,
    itemIds: Set<string>,
  ) {
    let entries: WorkspaceEntry[]
    try {
      entries = await this.fileSystem.listDirectory(root, schemasPath)
    } catch {
      issues.push(
        issue('missing-directory', schemasPath, 'Schema 폴더가 없습니다.'),
      )
      return
    }

    const seenSchemaIds = new Set<string>()
    for (const entry of entries.filter(
      (candidate) => candidate.kind === 'file',
    )) {
      const idSuffix = idFromFileName(entry.name, 'db_', '.json')
      if (!idSuffix) continue
      const id = `db_${idSuffix}`
      let parsed: unknown
      try {
        parsed = parseJson(await this.fileSystem.readTextFile(root, entry.path))
      } catch {
        issues.push(
          issue(
            'unreadable-file',
            entry.path,
            'Schema 파일을 읽을 수 없습니다.',
          ),
        )
        continue
      }
      const path = entry.path
      if (
        !isRecord(parsed) ||
        parsed.schemaVersion !== currentDatabaseSchemaVersion ||
        parsed.id !== id ||
        typeof parsed.name !== 'string' ||
        !parsed.name.trim() ||
        typeof parsed.folder !== 'string' ||
        !isRecord(parsed.properties)
      ) {
        issues.push(
          issue(
            parsed &&
              isRecord(parsed) &&
              parsed.schemaVersion !== currentDatabaseSchemaVersion
              ? 'unsupported-version'
              : 'invalid-schema',
            path,
            'Schema 형식 또는 Version이 올바르지 않습니다.',
          ),
        )
        continue
      }
      if (seenSchemaIds.has(id)) {
        issues.push(
          issue('duplicate-id', path, `중복된 Database ID가 있습니다: ${id}`),
        )
        continue
      }
      seenSchemaIds.add(id)
      const properties = parsed.properties
      const propertyIds = new Set(Object.keys(properties))
      let validProperties = true
      for (const [propertyId, property] of Object.entries(properties)) {
        if (
          !isRecord(property) ||
          property.id !== propertyId ||
          typeof property.name !== 'string'
        ) {
          validProperties = false
          issues.push(
            issue(
              'invalid-schema',
              path,
              `Property 형식이 올바르지 않습니다: ${propertyId}`,
            ),
          )
        }
        if (
          isRecord(property) &&
          (property.type === 'select' || property.type === 'multi_select') &&
          Array.isArray(property.options)
        ) {
          const optionIds = new Set<string>()
          for (const option of property.options) {
            if (!isRecord(option) || typeof option.id !== 'string') continue
            if (optionIds.has(option.id))
              issues.push(
                issue(
                  'duplicate-id',
                  path,
                  `중복된 Option ID가 있습니다: ${option.id}`,
                ),
              )
            optionIds.add(option.id)
          }
        }
      }
      if (!validProperties) continue
      const schema = parsed as unknown as DatabaseSchema
      schemas.set(id, schema)
      await this.checkItems(root, schema, propertyIds, itemIds, issues)
    }
  }

  private async checkItems(
    root: DirectoryHandle,
    schema: DatabaseSchema,
    propertyIds: Set<string>,
    itemIds: Set<string>,
    issues: HealthIssue[],
  ) {
    let entries: WorkspaceEntry[]
    try {
      entries = await this.fileSystem.listDirectory(root, schema.folder)
    } catch {
      issues.push(
        issue(
          'missing-directory',
          schema.folder,
          `Database Item 폴더가 없습니다: ${schema.id}`,
        ),
      )
      return
    }
    for (const entry of entries.filter(
      (candidate) =>
        candidate.kind === 'file' && candidate.name.endsWith('.md'),
    )) {
      let document
      try {
        document = markdownService.parseDocument(
          await this.fileSystem.readTextFile(root, entry.path),
        )
      } catch {
        issues.push(
          issue(
            'invalid-item',
            entry.path,
            'Item Markdown 또는 YAML이 올바르지 않습니다.',
          ),
        )
        continue
      }
      const id = document.frontmatter?.id
      if (typeof id !== 'string' || !/^item_[a-zA-Z0-9]+$/.test(id)) {
        issues.push(
          issue('invalid-item', entry.path, 'Item ID가 올바르지 않습니다.'),
        )
      } else {
        if (itemIds.has(id))
          issues.push(
            issue(
              'duplicate-id',
              entry.path,
              `중복된 Item ID가 있습니다: ${id}`,
            ),
          )
        itemIds.add(id)
      }
      for (const [propertyId, value] of Object.entries(
        document.frontmatter ?? {},
      )) {
        if (propertyId === 'id') continue
        if (!propertyIds.has(propertyId)) {
          issues.push(
            issue(
              'missing-reference',
              entry.path,
              `존재하지 않는 Property를 참조합니다: ${propertyId}`,
            ),
          )
          continue
        }
        const property =
          schema.properties[propertyId as keyof typeof schema.properties]
        if (property.type === 'select' || property.type === 'multi_select') {
          const values = Array.isArray(value) ? value : [value]
          const optionIds = new Set<string>(
            property.options.map((option) => option.id),
          )
          for (const optionId of values) {
            if (typeof optionId === 'string' && !optionIds.has(optionId)) {
              issues.push(
                issue(
                  'missing-reference',
                  entry.path,
                  `존재하지 않는 Option을 참조합니다: ${optionId}`,
                ),
              )
            }
          }
        }
      }
    }
  }

  private async checkViews(
    root: DirectoryHandle,
    issues: HealthIssue[],
    schemas: Map<string, DatabaseSchema>,
  ) {
    let entries: WorkspaceEntry[]
    try {
      entries = await this.fileSystem.listDirectory(root, viewsPath)
    } catch {
      issues.push(
        issue(
          'missing-directory',
          viewsPath,
          'View 폴더가 없습니다.',
          'warning',
        ),
      )
      return
    }
    const seen = new Set<string>()
    for (const entry of entries.filter(
      (candidate) =>
        candidate.kind === 'file' && candidate.name.endsWith('.json'),
    )) {
      const idSuffix = idFromFileName(entry.name, 'view_', '.json')
      if (!idSuffix) continue
      const id = `view_${idSuffix}`
      const parsed = parseJson(
        await this.fileSystem.readTextFile(root, entry.path).catch(() => ''),
      )
      if (
        !isRecord(parsed) ||
        parsed.version !== currentDatabaseViewVersion ||
        parsed.id !== id ||
        typeof parsed.databaseId !== 'string' ||
        !schemas.has(parsed.databaseId)
      ) {
        issues.push(
          issue(
            parsed &&
              isRecord(parsed) &&
              parsed.version !== currentDatabaseViewVersion
              ? 'unsupported-version'
              : 'invalid-view',
            entry.path,
            'View 형식, Database 참조 또는 Version이 올바르지 않습니다.',
          ),
        )
        continue
      }
      if (seen.has(id))
        issues.push(
          issue('duplicate-id', entry.path, `중복된 View ID가 있습니다: ${id}`),
        )
      seen.add(id)
      const schema = schemas.get(parsed.databaseId)
      if (!schema) continue
      for (const reference of propertyReferences(parsed)) {
        if (
          reference !== titleViewPropertyId &&
          !schema.properties[reference as keyof typeof schema.properties]
        ) {
          issues.push(
            issue(
              'missing-reference',
              entry.path,
              `존재하지 않는 Property를 View가 참조합니다: ${reference}`,
            ),
          )
        }
      }
    }
  }

  private async checkAttachments(root: DirectoryHandle, issues: HealthIssue[]) {
    let markdownEntries: WorkspaceEntry[]
    try {
      markdownEntries = await this.workspace.scanWorkspace()
    } catch {
      issues.push(
        issue('unreadable-file', '', 'Markdown 파일을 검사할 수 없습니다.'),
      )
      return
    }
    for (const entry of markdownEntries.filter(
      (candidate) => candidate.kind === 'file',
    )) {
      let source: string
      try {
        source = await this.fileSystem.readTextFile(root, entry.path)
      } catch {
        issues.push(
          issue(
            'unreadable-file',
            entry.path,
            'Markdown 파일을 읽을 수 없습니다.',
          ),
        )
        continue
      }
      for (const target of attachmentTargets(source)) {
        const resolved = resolveRelativePath(entry.path, target)
        if (!resolved || !resolved.toLowerCase().startsWith('attachments/'))
          continue
        try {
          await this.fileSystem.getFileMetadata(root, resolved)
        } catch {
          issues.push(
            issue(
              'broken-attachment',
              entry.path,
              `첨부 파일을 찾을 수 없습니다: ${target}`,
            ),
          )
        }
      }
    }
  }

  private async checkTrash(root: DirectoryHandle, issues: HealthIssue[]) {
    let entries: WorkspaceEntry[]
    try {
      entries = await this.fileSystem.listDirectory(root, trashPath)
    } catch {
      issues.push(
        issue(
          'missing-directory',
          trashPath,
          '휴지통 폴더가 없습니다.',
          'warning',
        ),
      )
      return
    }
    for (const entry of entries.filter(
      (candidate) => candidate.kind === 'directory',
    )) {
      const metadataPath = `${entry.path}/metadata.json`
      const parsed = parseJson(
        await this.fileSystem.readTextFile(root, metadataPath).catch(() => ''),
      )
      if (
        !isRecord(parsed) ||
        parsed.version !== currentTrashEntryVersion ||
        parsed.id !== entry.name ||
        typeof parsed.payloadPath !== 'string' ||
        !parsed.payloadPath.startsWith(`${entry.path}/payload/`)
      ) {
        issues.push(
          issue(
            'invalid-trash',
            entry.path,
            '휴지통 Metadata가 올바르지 않습니다.',
          ),
        )
        continue
      }
      try {
        await this.fileSystem.getFileMetadata(
          root,
          normalizeWorkspacePath(parsed.payloadPath),
        )
      } catch {
        issues.push(
          issue(
            'invalid-trash',
            entry.path,
            '휴지통 Payload를 복원할 수 없습니다.',
          ),
        )
      }
    }
  }
}
