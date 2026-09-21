import { AttachmentService } from '@/services/attachment.service'
import { BackupService } from '@/services/backup.service'
import { BrowserFileSystemService } from '@/services/browser-file-system.service'
import { DocumentService } from '@/services/document.service'
import { DatabaseService } from '@/services/database.service'
import { IndexedDbRecentWorkspaceStore } from '@/services/indexed-db-recent-workspace.store'
import { HealthCheckService } from '@/services/health-check.service'
import { SchemaService } from '@/services/schema.service'
import { SearchService } from '@/services/search.service'
import { ViewService } from '@/services/view.service'
import { WorkspaceService } from '@/services/workspace.service'

const browserFileSystemService = new BrowserFileSystemService()
const recentWorkspaceStore =
  new IndexedDbRecentWorkspaceStore<FileSystemDirectoryHandle>()

export const workspaceService = new WorkspaceService(
  browserFileSystemService,
  recentWorkspaceStore,
)

export const searchService = new SearchService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
  workspaceService,
)

export const documentService = new DocumentService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
)

export const attachmentService = new AttachmentService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
)

export const backupService = new BackupService(browserFileSystemService, () =>
  workspaceService.getCurrentHandle(),
)

export const healthCheckService = new HealthCheckService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
  workspaceService,
  backupService,
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
  undefined,
  undefined,
  backupService,
)

export const viewService = new ViewService(
  browserFileSystemService,
  () => workspaceService.getCurrentHandle(),
  databaseService,
)
