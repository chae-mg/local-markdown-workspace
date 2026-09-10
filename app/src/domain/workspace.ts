import type { WorkspaceEntryKind } from '@/domain/file-system'

export const currentWorkspaceVersion = 1
export const currentTrashEntryVersion = 1

export interface WorkspaceManifest {
  workspaceVersion: typeof currentWorkspaceVersion
  id: string
  name: string
  createdAt: string
}

export interface WorkspaceSummary {
  manifest: WorkspaceManifest | null
  initialized: boolean
  lastOpened: string
  name: string
  permission: PermissionState
}

export interface TrashEntryMetadata {
  version: typeof currentTrashEntryVersion
  id: string
  originalPath: string
  payloadPath: string
  kind: WorkspaceEntryKind
  deletedAt: string
}
