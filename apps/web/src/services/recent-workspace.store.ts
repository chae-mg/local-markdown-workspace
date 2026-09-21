import type { RecentWorkspace } from '@/domain/file-system'

export interface RecentWorkspaceStore<DirectoryHandle> {
  load(): Promise<RecentWorkspace<DirectoryHandle> | null>
  save(workspace: RecentWorkspace<DirectoryHandle>): Promise<void>
  clear(): Promise<void>
}
