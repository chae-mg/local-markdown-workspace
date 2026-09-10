import type {
  FileSystemAccessMode,
  RecentWorkspace,
  WorkspaceEntry,
} from '@/domain/file-system'
import { WorkspaceError } from '@/domain/errors'
import {
  currentTrashEntryVersion,
  currentWorkspaceVersion,
  type TrashEntryMetadata,
  type WorkspaceManifest,
  type WorkspaceSummary,
} from '@/domain/workspace'
import type { FileSystemService } from '@/services/file-system.service'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'
import {
  assertMutableWorkspacePath,
  joinWorkspacePath,
  normalizeWorkspacePath,
  splitWorkspacePath,
} from '@/utils/path'

const workspaceManifestPath = '.workspace/workspace.json'
const workspaceDirectories = ['Documents', 'Databases', 'Attachments'] as const

export interface WorkspaceApplicationService {
  createFolder(parentPath: string, name: string): Promise<string>
  createMarkdownFile(parentPath: string, name: string): Promise<string>
  emptyTrash(): Promise<number>
  isSupported(): boolean
  listTrashEntries(): Promise<TrashEntryMetadata[]>
  restoreRecentWorkspace(): Promise<WorkspaceSummary | null>
  selectWorkspace(): Promise<WorkspaceSummary>
  initializeWorkspace(): Promise<WorkspaceSummary>
  requestRecentWorkspacePermission(): Promise<WorkspaceSummary>
  moveEntryToTrash(path: string): Promise<TrashEntryMetadata>
  renameEntry(path: string, name: string): Promise<WorkspaceEntry>
  restoreTrashEntry(id: string, name: string): Promise<WorkspaceEntry>
  scanWorkspace(): Promise<WorkspaceEntry[]>
}

function normalizeEntryName(name: string) {
  const normalizedName = name.trim().normalize('NFC')
  const windowsDeviceName = normalizedName.split('.')[0]?.toUpperCase()
  const hasControlCharacter = [...normalizedName].some(
    (character) => (character.codePointAt(0) ?? 0) <= 31,
  )

  if (
    !normalizedName ||
    normalizedName === '.' ||
    normalizedName === '..' ||
    normalizedName === '.workspace' ||
    hasControlCharacter ||
    /[<>:"/\\|?*]/.test(normalizedName) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsDeviceName ?? '') ||
    /[. ]$/.test(normalizedName)
  ) {
    throw new WorkspaceError(
      'invalid-path',
      '운영체제에서 사용할 수 없는 이름입니다. 특수문자와 예약된 장치 이름을 제외해주세요.',
    )
  }

  return normalizedName
}

function assertTrashId(id: string) {
  if (!/^trash_[a-zA-Z0-9]+$/.test(id)) {
    throw new WorkspaceError('invalid-path', '유효하지 않은 휴지통 ID입니다.')
  }

  return id
}

function parseTrashEntryMetadata(content: string, expectedId: string) {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new WorkspaceError(
      'invalid-workspace',
      '휴지통 Metadata를 읽을 수 없습니다.',
      { cause: error },
    )
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== currentTrashEntryVersion ||
    parsed.id !== expectedId ||
    typeof parsed.originalPath !== 'string' ||
    typeof parsed.payloadPath !== 'string' ||
    (parsed.kind !== 'file' && parsed.kind !== 'directory') ||
    typeof parsed.deletedAt !== 'string' ||
    Number.isNaN(Date.parse(parsed.deletedAt))
  ) {
    throw new WorkspaceError(
      'invalid-workspace',
      '휴지통 Metadata 형식이 올바르지 않습니다.',
    )
  }

  const originalPath = assertMutableWorkspacePath(parsed.originalPath)
  const payloadPath = normalizeWorkspacePath(parsed.payloadPath)
  const expectedPayloadPrefix = `.workspace/trash/${expectedId}/payload/`

  if (!payloadPath.startsWith(expectedPayloadPrefix)) {
    throw new WorkspaceError(
      'invalid-workspace',
      '휴지통 Payload 경로가 올바르지 않습니다.',
    )
  }

  return {
    version: currentTrashEntryVersion,
    id: expectedId,
    originalPath,
    payloadPath,
    kind: parsed.kind,
    deletedAt: parsed.deletedAt,
  } satisfies TrashEntryMetadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWorkspaceManifest(content: string): WorkspaceManifest {
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch (error) {
    throw new WorkspaceError(
      'invalid-workspace',
      'workspace.json을 읽을 수 없습니다. 원본 파일을 확인해주세요.',
      { cause: error },
    )
  }

  if (!isRecord(parsed)) {
    throw new WorkspaceError(
      'invalid-workspace',
      'workspace.json의 형식이 올바르지 않습니다.',
    )
  }

  if (typeof parsed.workspaceVersion !== 'number') {
    throw new WorkspaceError(
      'invalid-workspace',
      'workspace.json에 Workspace 버전이 없습니다.',
    )
  }

  if (parsed.workspaceVersion !== currentWorkspaceVersion) {
    throw new WorkspaceError(
      'unsupported-workspace-version',
      `지원하지 않는 Workspace 버전입니다: ${String(parsed.workspaceVersion)}`,
    )
  }

  if (
    typeof parsed.id !== 'string' ||
    !parsed.id.startsWith('ws_') ||
    typeof parsed.name !== 'string' ||
    !parsed.name.trim() ||
    typeof parsed.createdAt !== 'string' ||
    Number.isNaN(Date.parse(parsed.createdAt))
  ) {
    throw new WorkspaceError(
      'invalid-workspace',
      'workspace.json에 필수 Workspace 정보가 없습니다.',
    )
  }

  return {
    workspaceVersion: currentWorkspaceVersion,
    id: parsed.id,
    name: parsed.name,
    createdAt: parsed.createdAt,
  }
}

export class WorkspaceService<
  DirectoryHandle,
> implements WorkspaceApplicationService {
  private currentHandle: DirectoryHandle | null = null
  private currentRecentWorkspace: RecentWorkspace<DirectoryHandle> | null = null

  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly recentWorkspaceStore: RecentWorkspaceStore<DirectoryHandle>,
    private readonly now: () => Date = () => new Date(),
    private readonly createWorkspaceId: () => string = () =>
      `ws_${crypto.randomUUID().replaceAll('-', '')}`,
    private readonly createTrashId: () => string = () =>
      `trash_${crypto.randomUUID().replaceAll('-', '')}`,
  ) {}

  isSupported() {
    return this.fileSystem.isSupported()
  }

  async restoreRecentWorkspace() {
    const recentWorkspace = await this.recentWorkspaceStore.load()

    if (!recentWorkspace) {
      return null
    }

    const permission = await this.fileSystem.queryPermission(
      recentWorkspace.handle,
      'readwrite',
    )

    this.currentRecentWorkspace = recentWorkspace

    if (permission !== 'granted') {
      return this.toSummary(recentWorkspace, permission, null)
    }

    this.currentHandle = recentWorkspace.handle
    const manifest = await this.inspectWorkspace(recentWorkspace.handle)
    return this.toSummary(recentWorkspace, permission, manifest)
  }

  async selectWorkspace() {
    if (!this.fileSystem.isSupported()) {
      throw new WorkspaceError(
        'unsupported-browser',
        'Chrome의 안전한 연결(HTTPS 또는 localhost)에서 사용할 수 있습니다.',
      )
    }

    const handle = await this.fileSystem.selectDirectory()
    const permission = await this.ensurePermission(handle, 'readwrite')

    if (permission !== 'granted') {
      throw new WorkspaceError(
        'permission-denied',
        'Workspace를 사용하려면 읽기 및 쓰기 권한이 필요합니다.',
      )
    }

    const recentWorkspace = this.createRecentWorkspace(handle)
    this.currentHandle = handle
    this.currentRecentWorkspace = recentWorkspace

    const rootEntries = await this.fileSystem.listDirectory(handle)
    let manifest = await this.inspectWorkspace(handle, rootEntries)

    if (rootEntries.length === 0) {
      manifest = await this.createWorkspaceStructure(handle, recentWorkspace)
    }

    await this.recentWorkspaceStore.save(recentWorkspace)
    return this.toSummary(recentWorkspace, permission, manifest)
  }

  async initializeWorkspace() {
    const handle = this.getCurrentHandle()
    const recentWorkspace = this.getCurrentRecentWorkspace()
    const existingManifest = await this.inspectWorkspace(handle)
    const manifest =
      existingManifest ??
      (await this.createWorkspaceStructure(handle, recentWorkspace))

    await this.recentWorkspaceStore.save(recentWorkspace)
    return this.toSummary(recentWorkspace, 'granted', manifest)
  }

  async requestRecentWorkspacePermission() {
    const recentWorkspace = await this.recentWorkspaceStore.load()

    if (!recentWorkspace) {
      throw new WorkspaceError(
        'workspace-not-open',
        '다시 연결할 최근 Workspace가 없습니다.',
      )
    }

    const permission = await this.ensurePermission(
      recentWorkspace.handle,
      'readwrite',
    )

    if (permission !== 'granted') {
      throw new WorkspaceError(
        'permission-denied',
        'Workspace 접근 권한이 허용되지 않았습니다.',
      )
    }

    const refreshedWorkspace = {
      ...recentWorkspace,
      lastOpened: this.now().toISOString(),
    }
    this.currentHandle = recentWorkspace.handle
    this.currentRecentWorkspace = refreshedWorkspace
    const manifest = await this.inspectWorkspace(recentWorkspace.handle)

    await this.recentWorkspaceStore.save(refreshedWorkspace)
    return this.toSummary(refreshedWorkspace, permission, manifest)
  }

  async scanWorkspace() {
    const root = this.getCurrentHandle()
    return this.scanDirectory(root)
  }

  async createMarkdownFile(parentPath: string, name: string) {
    const root = this.getCurrentHandle()
    const normalizedParentPath = normalizeWorkspacePath(parentPath)
    const normalizedName = normalizeEntryName(name)
    const fileName = normalizedName.toLowerCase().endsWith('.md')
      ? normalizedName
      : `${normalizedName}.md`

    if (fileName.toLowerCase() === '.md') {
      throw new WorkspaceError('invalid-path', '문서 이름을 입력해주세요.')
    }

    await this.assertEntryAvailable(root, normalizedParentPath, fileName)
    const path = joinWorkspacePath(normalizedParentPath, fileName)
    await this.fileSystem.writeTextFile(root, path, '')
    return path
  }

  async createFolder(parentPath: string, name: string) {
    const root = this.getCurrentHandle()
    const normalizedParentPath = normalizeWorkspacePath(parentPath)
    const folderName = normalizeEntryName(name)

    await this.assertEntryAvailable(root, normalizedParentPath, folderName)
    const path = joinWorkspacePath(normalizedParentPath, folderName)
    await this.fileSystem.createDirectory(root, path)
    return path
  }

  async renameEntry(path: string, name: string) {
    const root = this.getCurrentHandle()
    const normalizedSourcePath = assertMutableWorkspacePath(path)
    const source = await this.fileSystem.getFileMetadata(
      root,
      normalizedSourcePath,
    )
    const sourceSegments = splitWorkspacePath(normalizedSourcePath)
    sourceSegments.pop()
    const parentPath = sourceSegments.join('/')
    const normalizedName = normalizeEntryName(name)
    const destinationName =
      source.kind === 'file' && !normalizedName.toLowerCase().endsWith('.md')
        ? `${normalizedName}.md`
        : normalizedName

    if (source.kind === 'file' && destinationName.toLowerCase() === '.md') {
      throw new WorkspaceError('invalid-path', '문서 이름을 입력해주세요.')
    }

    const destinationPath = joinWorkspacePath(parentPath, destinationName)

    if (destinationPath === normalizedSourcePath) {
      return { kind: source.kind, name: source.name, path: source.path }
    }

    await this.assertEntryAvailable(root, parentPath, destinationName)
    await this.fileSystem.moveEntry(root, normalizedSourcePath, destinationPath)
    return {
      kind: source.kind,
      name: destinationName,
      path: destinationPath,
    }
  }

  async moveEntryToTrash(path: string) {
    const root = this.getCurrentHandle()
    const originalPath = assertMutableWorkspacePath(path)
    const source = await this.fileSystem.getFileMetadata(root, originalPath)
    const id = this.createTrashId()
    const trashEntryPath = `.workspace/trash/${id}`
    const payloadPath = `${trashEntryPath}/payload/${source.name}`
    const metadataPath = `${trashEntryPath}/metadata.json`
    const metadata: TrashEntryMetadata = {
      version: currentTrashEntryVersion,
      id,
      originalPath,
      payloadPath,
      kind: source.kind,
      deletedAt: this.now().toISOString(),
    }

    await this.assertEntryAvailable(root, '.workspace/trash', id)
    await this.fileSystem.createDirectory(root, `${trashEntryPath}/payload`, {
      allowProtected: true,
    })
    await this.fileSystem.writeTextFile(
      root,
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      { allowProtected: true },
    )
    await this.fileSystem.moveEntry(root, originalPath, payloadPath, {
      allowProtected: true,
    })
    return metadata
  }

  async listTrashEntries() {
    const root = this.getCurrentHandle()
    const entries = await this.fileSystem.listDirectory(
      root,
      '.workspace/trash',
    )
    const trashEntries: TrashEntryMetadata[] = []

    for (const entry of entries) {
      if (entry.kind !== 'directory' || !entry.name.startsWith('trash_')) {
        continue
      }

      const id = assertTrashId(entry.name)
      trashEntries.push(await this.readTrashEntryMetadata(root, id))
    }

    return trashEntries.sort(
      (left, right) => Date.parse(right.deletedAt) - Date.parse(left.deletedAt),
    )
  }

  async restoreTrashEntry(id: string, name: string) {
    const root = this.getCurrentHandle()
    const normalizedId = assertTrashId(id)
    const metadata = await this.readTrashEntryMetadata(root, normalizedId)
    const originalSegments = splitWorkspacePath(metadata.originalPath)
    originalSegments.pop()
    const parentPath = originalSegments.join('/')
    const normalizedName = normalizeEntryName(name)
    const restoredName =
      metadata.kind === 'file' && !normalizedName.toLowerCase().endsWith('.md')
        ? `${normalizedName}.md`
        : normalizedName

    if (metadata.kind === 'file' && restoredName.toLowerCase() === '.md') {
      throw new WorkspaceError('invalid-path', '문서 이름을 입력해주세요.')
    }

    const restoredPath = assertMutableWorkspacePath(
      joinWorkspacePath(parentPath, restoredName),
    )

    if (parentPath) {
      await this.fileSystem.createDirectory(root, parentPath)
    }
    await this.assertEntryAvailable(root, parentPath, restoredName)
    await this.fileSystem.moveEntry(root, metadata.payloadPath, restoredPath, {
      allowProtected: true,
    })

    const trashEntryPath = `.workspace/trash/${normalizedId}`
    await this.fileSystem.deleteEntry(root, `${trashEntryPath}/metadata.json`, {
      allowProtected: true,
    })
    await this.fileSystem
      .deleteEntry(root, trashEntryPath, {
        allowProtected: true,
        recursive: true,
      })
      .catch(() => undefined)

    return {
      kind: metadata.kind,
      name: restoredName,
      path: restoredPath,
    }
  }

  async emptyTrash() {
    const root = this.getCurrentHandle()
    const entries = await this.fileSystem.listDirectory(
      root,
      '.workspace/trash',
    )

    for (const entry of entries) {
      await this.fileSystem.deleteEntry(root, entry.path, {
        allowProtected: true,
        recursive: entry.kind === 'directory',
      })
    }

    return entries.length
  }

  getCurrentHandle() {
    if (!this.currentHandle) {
      throw new WorkspaceError(
        'workspace-not-open',
        '먼저 Workspace를 열어주세요.',
      )
    }

    return this.currentHandle
  }

  private getCurrentRecentWorkspace() {
    if (!this.currentRecentWorkspace) {
      throw new WorkspaceError(
        'workspace-not-open',
        '먼저 Workspace를 열어주세요.',
      )
    }

    return this.currentRecentWorkspace
  }

  private async inspectWorkspace(
    handle: DirectoryHandle,
    rootEntries?: WorkspaceEntry[],
  ) {
    const entries = rootEntries ?? (await this.fileSystem.listDirectory(handle))
    const metadataDirectory = entries.find(
      (entry) => entry.path === '.workspace' && entry.kind === 'directory',
    )

    if (!metadataDirectory) {
      return null
    }

    const metadataEntries = await this.fileSystem.listDirectory(
      handle,
      '.workspace',
    )
    const manifestEntry = metadataEntries.find(
      (entry) => entry.path === workspaceManifestPath && entry.kind === 'file',
    )

    if (!manifestEntry) {
      return null
    }

    return parseWorkspaceManifest(
      await this.fileSystem.readTextFile(handle, workspaceManifestPath),
    )
  }

  private async createWorkspaceStructure(
    handle: DirectoryHandle,
    recentWorkspace: RecentWorkspace<DirectoryHandle>,
  ) {
    for (const directory of workspaceDirectories) {
      await this.fileSystem.createDirectory(handle, directory)
    }

    await this.fileSystem.createDirectory(handle, '.workspace/trash', {
      allowProtected: true,
    })

    const manifest: WorkspaceManifest = {
      workspaceVersion: currentWorkspaceVersion,
      id: this.createWorkspaceId(),
      name: recentWorkspace.name,
      createdAt: this.now().toISOString(),
    }

    await this.fileSystem.writeTextFile(
      handle,
      workspaceManifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      { allowProtected: true },
    )

    return manifest
  }

  private async scanDirectory(
    root: DirectoryHandle,
    path = '',
  ): Promise<WorkspaceEntry[]> {
    const entries = await this.fileSystem.listDirectory(root, path)
    const visibleEntries = entries.filter(
      (entry) => entry.path !== '.workspace' && entry.name !== '.workspace',
    )
    const scannedEntries: WorkspaceEntry[] = []

    for (const entry of visibleEntries) {
      if (entry.kind === 'directory') {
        scannedEntries.push(
          entry,
          ...(await this.scanDirectory(root, entry.path)),
        )
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        scannedEntries.push(entry)
      }
    }

    return scannedEntries
  }

  private async assertEntryAvailable(
    root: DirectoryHandle,
    parentPath: string,
    name: string,
  ) {
    const entries = await this.fileSystem.listDirectory(root, parentPath)
    const comparableName = name.normalize('NFC').toLocaleLowerCase()

    if (
      entries.some(
        (entry) =>
          entry.name.normalize('NFC').toLocaleLowerCase() === comparableName,
      )
    ) {
      throw new WorkspaceError(
        'entry-already-exists',
        '같은 위치에 동일한 이름의 파일 또는 폴더가 있습니다.',
      )
    }
  }

  private async readTrashEntryMetadata(root: DirectoryHandle, id: string) {
    const normalizedId = assertTrashId(id)
    const content = await this.fileSystem.readTextFile(
      root,
      `.workspace/trash/${normalizedId}/metadata.json`,
    )
    return parseTrashEntryMetadata(content, normalizedId)
  }

  private async ensurePermission(
    handle: DirectoryHandle,
    mode: FileSystemAccessMode,
  ) {
    const currentPermission = await this.fileSystem.queryPermission(
      handle,
      mode,
    )

    if (currentPermission === 'granted') {
      return currentPermission
    }

    return this.fileSystem.requestPermission(handle, mode)
  }

  private createRecentWorkspace(
    handle: DirectoryHandle,
  ): RecentWorkspace<DirectoryHandle> {
    return {
      handle,
      name: this.fileSystem.getDirectoryName(handle),
      lastOpened: this.now().toISOString(),
    }
  }

  private toSummary(
    workspace: RecentWorkspace<DirectoryHandle>,
    permission: PermissionState,
    manifest: WorkspaceManifest | null,
  ): WorkspaceSummary {
    return {
      manifest,
      initialized: manifest !== null,
      name: workspace.name,
      lastOpened: workspace.lastOpened,
      permission,
    }
  }
}
