export const currentBackupVersion = 1

export interface BackupSnapshotMetadata {
  version: typeof currentBackupVersion
  id: string
  originalPath: string
  payloadPath: string
  reason: string
  createdAt: string
  size: number
}
