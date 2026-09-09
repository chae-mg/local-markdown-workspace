import type {
  FileSystemAccessMode,
  RecentWorkspace,
  WorkspaceEntry,
} from '@/domain/file-system'
import { WorkspaceError } from '@/domain/errors'
import {
  currentWorkspaceVersion,
  type WorkspaceManifest,
  type WorkspaceSummary,
} from '@/domain/workspace'
import type { FileSystemService } from '@/services/file-system.service'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'

const workspaceManifestPath = '.workspace/workspace.json'
const workspaceDirectories = ['Documents', 'Databases', 'Attachments'] as const

export interface WorkspaceApplicationService {
  isSupported(): boolean
  restoreRecentWorkspace(): Promise<WorkspaceSummary | null>
  selectWorkspace(): Promise<WorkspaceSummary>
  initializeWorkspace(): Promise<WorkspaceSummary>
  requestRecentWorkspacePermission(): Promise<WorkspaceSummary>
  scanWorkspace(): Promise<WorkspaceEntry[]>
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
