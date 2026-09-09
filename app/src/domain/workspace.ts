export const currentWorkspaceVersion = 1

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
