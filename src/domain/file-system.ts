export type FileSystemAccessMode = 'read' | 'readwrite'

export type WorkspaceEntryKind = 'file' | 'directory'

export interface WorkspaceEntry {
  kind: WorkspaceEntryKind
  name: string
  path: string
}

export interface FileMetadata extends WorkspaceEntry {
  lastModified: number | null
  mimeType: string | null
  size: number | null
}

export interface FileMutationOptions {
  allowProtected?: boolean
}

export interface DeleteEntryOptions extends FileMutationOptions {
  recursive?: boolean
}

export interface RecentWorkspace<DirectoryHandle> {
  handle: DirectoryHandle
  lastOpened: string
  name: string
}

export interface WorkspaceSummary {
  lastOpened: string
  name: string
  permission: PermissionState
}
