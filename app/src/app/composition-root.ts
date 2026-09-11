import { AttachmentService } from '@/services/attachment.service'
import { BrowserFileSystemService } from '@/services/browser-file-system.service'
import { DocumentService } from '@/services/document.service'
import { DatabaseService } from '@/services/database.service'
import { IndexedDbRecentWorkspaceStore } from '@/services/indexed-db-recent-workspace.store'
import { SchemaService } from '@/services/schema.service'
import { WorkspaceService } from '@/services/workspace.service'

const browserFileSystemService = new BrowserFileSystemService()
const recentWorkspaceStore =
  new IndexedDbRecentWorkspaceStore<FileSystemDirectoryHandle>()

export const workspaceService = new WorkspaceService(
  browserFileSystemService,
  recentWorkspaceStore,
)

export const documentService = new DocumentService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
)

export const attachmentService = new AttachmentService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
)

export const databaseService = new DatabaseService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
  workspaceService,
)

export const schemaService = new SchemaService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
  databaseService,
)
