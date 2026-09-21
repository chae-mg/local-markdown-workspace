import {
  currentBackupVersion,
  type BackupSnapshotMetadata,
} from '@/domain/backup'
import type { FileSystemService } from '@/services/file-system.service'
import {
  assertMutableWorkspacePath,
  normalizeWorkspacePath,
} from '@/utils/path'

export interface BackupTextSnapshotRequest {
  path: string
  reason: string
  source: string
}

export interface BackupApplicationService {
  createTextSnapshot(
    request: BackupTextSnapshotRequest,
  ): Promise<BackupSnapshotMetadata>
}

export class BackupService<
  DirectoryHandle,
> implements BackupApplicationService {
  constructor(
    private readonly fileSystem: FileSystemService<DirectoryHandle>,
    private readonly getRoot: () => DirectoryHandle,
    private readonly now: () => Date = () => new Date(),
    private readonly createBackupId: () => string = () =>
      `backup_${crypto.randomUUID().replaceAll('-', '')}`,
  ) {}

  async createTextSnapshot({
    path,
    reason,
    source,
  }: BackupTextSnapshotRequest) {
    const root = this.getRoot()
    const originalPath = assertMutableWorkspacePath(path, true)
    const id = this.createBackupId()
    const backupPath = `.workspace/backup/${id}`
    const payloadPath = `${backupPath}/payload/${originalPath}`
    const metadataPath = `${backupPath}/metadata.json`
    const metadata: BackupSnapshotMetadata = {
      version: currentBackupVersion,
      id,
      originalPath,
      payloadPath: normalizeWorkspacePath(payloadPath),
      reason: reason.trim() || 'snapshot',
      createdAt: this.now().toISOString(),
      size: new TextEncoder().encode(source).byteLength,
    }

    await this.fileSystem.createDirectory(
      root,
      `${backupPath}/payload/${originalPath.split('/').slice(0, -1).join('/')}`,
      { allowProtected: true },
    )
    await this.fileSystem.writeTextFile(root, metadata.payloadPath, source, {
      allowProtected: true,
    })
    await this.fileSystem.writeTextFile(
      root,
      metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      { allowProtected: true },
    )

    return metadata
  }
}
