import type {
  FileSystemAccessMode,
  RecentWorkspace,
  WorkspaceSummary,
} from '@/domain/file-system'
import { WorkspaceError } from '@/domain/errors'
import type { FileSystemService } from '@/services/file-system.service'
import type { RecentWorkspaceStore } from '@/services/recent-workspace.store'

export interface WorkspaceApplicationService {
  isSupported(): boolean
  restoreRecentWorkspace(): Promise<WorkspaceSummary | null>
  selectWorkspace(): Promise<WorkspaceSummary>
  requestRecentWorkspacePermission(): Promise<WorkspaceSummary>
}

export class WorkspaceService<
  DirectoryHandle,
> implements WorkspaceApplicationService {
  private currentHandle: DirectoryHandle | null = null

  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly recentWorkspaceStore: RecentWorkspaceStore<DirectoryHandle>,
    private readonly now: () => Date = () => new Date(),
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

    if (permission === 'granted') {
      this.currentHandle = recentWorkspace.handle
    }

    return this.toSummary(recentWorkspace, permission)
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
    await this.recentWorkspaceStore.save(recentWorkspace)
    this.currentHandle = handle

    return this.toSummary(recentWorkspace, permission)
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
    await this.recentWorkspaceStore.save(refreshedWorkspace)
    this.currentHandle = recentWorkspace.handle

    return this.toSummary(refreshedWorkspace, permission)
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
  ): WorkspaceSummary {
    return {
      name: workspace.name,
      lastOpened: workspace.lastOpened,
      permission,
    }
  }
}
