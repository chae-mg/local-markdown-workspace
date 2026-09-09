import { BrowserFileSystemService } from '@/services/browser-file-system.service'
import { IndexedDbRecentWorkspaceStore } from '@/services/indexed-db-recent-workspace.store'
import { WorkspaceService } from '@/services/workspace.service'

const browserFileSystemService = new BrowserFileSystemService()
const recentWorkspaceStore =
  new IndexedDbRecentWorkspaceStore<FileSystemDirectoryHandle>()

export const workspaceService = new WorkspaceService(
  browserFileSystemService,
  recentWorkspaceStore,
)
