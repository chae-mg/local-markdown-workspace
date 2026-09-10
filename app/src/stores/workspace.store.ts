import { create } from 'zustand'

import { isPickerCancellation } from '@/domain/errors'
import type { WorkspaceEntry } from '@/domain/file-system'
import type { WorkspaceSummary } from '@/domain/workspace'
import { workspaceService } from '@/app/composition-root'
import type { WorkspaceApplicationService } from '@/services/workspace.service'

export type WorkspaceStatus =
  | 'checking'
  | 'idle'
  | 'opening'
  | 'initializing'
  | 'initialization-required'
  | 'permission-required'
  | 'ready'
  | 'unsupported'
  | 'error'

export interface WorkspaceStore {
  entries: WorkspaceEntry[]
  errorMessage: string | null
  mutationErrorMessage: string | null
  mutationStatus: 'idle' | 'creating' | 'renaming' | 'trashing'
  selectedDirectoryPath: string
  selectedPath: string | null
  status: WorkspaceStatus
  treeErrorMessage: string | null
  treeStatus: 'idle' | 'loading' | 'ready' | 'error'
  workspace: WorkspaceSummary | null
  clearMutationError(): void
  createFolder(parentPath: string, name: string): Promise<boolean>
  createMarkdownFile(parentPath: string, name: string): Promise<boolean>
  initialize(): Promise<void>
  initializeWorkspace(): Promise<void>
  openWorkspace(): Promise<void>
  refreshWorkspace(): Promise<void>
  reconnectWorkspace(): Promise<void>
  moveEntryToTrash(path: string): Promise<boolean>
  renameEntry(path: string, name: string): Promise<boolean>
  selectDirectory(path: string): void
  selectEntry(path: string): void
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Workspace를 여는 중 알 수 없는 오류가 발생했습니다.'
}

function statusForWorkspace(workspace: WorkspaceSummary): WorkspaceStatus {
  return workspace.initialized ? 'ready' : 'initialization-required'
}

function parentDirectoryPath(path: string) {
  const segments = path.split('/')
  segments.pop()
  return segments.join('/')
}

function resolveDirectorySelection(
  entries: WorkspaceEntry[],
  preferredPath: string,
) {
  if (
    preferredPath === '' ||
    entries.some(
      (entry) => entry.kind === 'directory' && entry.path === preferredPath,
    )
  ) {
    return preferredPath
  }

  return entries.some(
    (entry) => entry.kind === 'directory' && entry.path === 'Documents',
  )
    ? 'Documents'
    : ''
}

export function createWorkspaceStore(service: WorkspaceApplicationService) {
  return create<WorkspaceStore>((set, get) => ({
    entries: [],
    errorMessage: null,
    mutationErrorMessage: null,
    mutationStatus: 'idle',
    selectedDirectoryPath: 'Documents',
    selectedPath: null,
    status: 'checking',
    treeErrorMessage: null,
    treeStatus: 'idle',
    workspace: null,

    clearMutationError() {
      set({ mutationErrorMessage: null })
    },

    async initialize() {
      if (get().status !== 'checking') {
        return
      }

      if (!service.isSupported()) {
        set({ status: 'unsupported' })
        return
      }

      set({ status: 'opening' })

      try {
        const workspace = await service.restoreRecentWorkspace()

        if (!workspace) {
          set({ status: 'idle' })
          return
        }

        set({
          entries: [],
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: 'Documents',
          selectedPath: null,
          status:
            workspace.permission === 'granted'
              ? statusForWorkspace(workspace)
              : 'permission-required',
          treeErrorMessage: null,
          treeStatus: 'idle',
          workspace,
        })
      } catch (error) {
        set({ status: 'error', errorMessage: messageFromError(error) })
      }
    },

    async openWorkspace() {
      if (get().status === 'opening') {
        return
      }

      const previousStatus = get().status
      set({ status: 'opening', errorMessage: null })

      try {
        const workspace = await service.selectWorkspace()
        set({
          entries: [],
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: 'Documents',
          selectedPath: null,
          status: statusForWorkspace(workspace),
          treeErrorMessage: null,
          treeStatus: 'idle',
          workspace,
        })
      } catch (error) {
        if (isPickerCancellation(error)) {
          set({
            status:
              previousStatus === 'ready' ||
              previousStatus === 'initialization-required' ||
              previousStatus === 'permission-required'
                ? previousStatus
                : 'idle',
          })
          return
        }

        set({ status: 'error', errorMessage: messageFromError(error) })
      }
    },

    async initializeWorkspace() {
      if (get().status !== 'initialization-required') {
        return
      }

      set({ status: 'initializing', errorMessage: null })

      try {
        const workspace = await service.initializeWorkspace()
        set({
          entries: [],
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: 'Documents',
          selectedPath: null,
          status: 'ready',
          treeErrorMessage: null,
          treeStatus: 'idle',
          workspace,
        })
      } catch (error) {
        set({
          status: 'initialization-required',
          errorMessage: messageFromError(error),
        })
      }
    },

    async reconnectWorkspace() {
      if (get().status === 'opening') {
        return
      }

      set({ status: 'opening', errorMessage: null })

      try {
        const workspace = await service.requestRecentWorkspacePermission()
        set({
          entries: [],
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: 'Documents',
          selectedPath: null,
          status: statusForWorkspace(workspace),
          treeErrorMessage: null,
          treeStatus: 'idle',
          workspace,
        })
      } catch (error) {
        set({
          status: 'permission-required',
          errorMessage: messageFromError(error),
        })
      }
    },

    async refreshWorkspace() {
      if (get().status !== 'ready' || get().treeStatus === 'loading') {
        return
      }

      set({ treeErrorMessage: null, treeStatus: 'loading' })
      const workspaceId = get().workspace?.manifest?.id

      try {
        const entries = await service.scanWorkspace()

        if (
          get().status !== 'ready' ||
          get().workspace?.manifest?.id !== workspaceId
        ) {
          return
        }

        set((state) => ({
          entries,
          selectedDirectoryPath: resolveDirectorySelection(
            entries,
            state.selectedDirectoryPath,
          ),
          selectedPath:
            state.selectedPath &&
            entries.some(
              (entry) =>
                entry.kind === 'file' && entry.path === state.selectedPath,
            )
              ? state.selectedPath
              : null,
          treeErrorMessage: null,
          treeStatus: 'ready',
        }))
      } catch (error) {
        if (
          get().status !== 'ready' ||
          get().workspace?.manifest?.id !== workspaceId
        ) {
          return
        }

        set({
          treeErrorMessage: messageFromError(error),
          treeStatus: 'error',
        })
      }
    },

    async createMarkdownFile(parentPath, name) {
      if (get().status !== 'ready' || get().mutationStatus === 'creating') {
        return false
      }

      set({ mutationErrorMessage: null, mutationStatus: 'creating' })

      try {
        const path = await service.createMarkdownFile(parentPath, name)
        const entries = await service.scanWorkspace()
        set({
          entries,
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: parentPath,
          selectedPath: path,
          treeErrorMessage: null,
          treeStatus: 'ready',
        })
        return true
      } catch (error) {
        set({
          mutationErrorMessage: messageFromError(error),
          mutationStatus: 'idle',
        })
        return false
      }
    },

    async createFolder(parentPath, name) {
      if (get().status !== 'ready' || get().mutationStatus === 'creating') {
        return false
      }

      set({ mutationErrorMessage: null, mutationStatus: 'creating' })

      try {
        const path = await service.createFolder(parentPath, name)
        const entries = await service.scanWorkspace()
        set({
          entries,
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: path,
          selectedPath: null,
          treeErrorMessage: null,
          treeStatus: 'ready',
        })
        return true
      } catch (error) {
        set({
          mutationErrorMessage: messageFromError(error),
          mutationStatus: 'idle',
        })
        return false
      }
    },

    async renameEntry(path, name) {
      if (get().status !== 'ready' || get().mutationStatus !== 'idle') {
        return false
      }

      set({ mutationErrorMessage: null, mutationStatus: 'renaming' })

      try {
        const renamedEntry = await service.renameEntry(path, name)
        const entries = await service.scanWorkspace()
        set({
          entries,
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath:
            renamedEntry.kind === 'directory'
              ? renamedEntry.path
              : parentDirectoryPath(renamedEntry.path),
          selectedPath: renamedEntry.kind === 'file' ? renamedEntry.path : null,
          treeErrorMessage: null,
          treeStatus: 'ready',
        })
        return true
      } catch (error) {
        set({
          mutationErrorMessage: messageFromError(error),
          mutationStatus: 'idle',
        })
        return false
      }
    },

    async moveEntryToTrash(path) {
      if (get().status !== 'ready' || get().mutationStatus !== 'idle') {
        return false
      }

      set({ mutationErrorMessage: null, mutationStatus: 'trashing' })

      try {
        await service.moveEntryToTrash(path)
        const entries = await service.scanWorkspace()
        const preferredDirectory = parentDirectoryPath(path)
        set({
          entries,
          mutationErrorMessage: null,
          mutationStatus: 'idle',
          selectedDirectoryPath: resolveDirectorySelection(
            entries,
            preferredDirectory,
          ),
          selectedPath: null,
          treeErrorMessage: null,
          treeStatus: 'ready',
        })
        return true
      } catch (error) {
        set({
          mutationErrorMessage: messageFromError(error),
          mutationStatus: 'idle',
        })
        return false
      }
    },

    selectDirectory(path) {
      const isDirectory = get().entries.some(
        (entry) => entry.kind === 'directory' && entry.path === path,
      )

      if (isDirectory) {
        set({ selectedDirectoryPath: path, selectedPath: null })
      }
    },

    selectEntry(path) {
      const isMarkdownFile = get().entries.some(
        (entry) => entry.kind === 'file' && entry.path === path,
      )

      if (isMarkdownFile) {
        set({
          selectedDirectoryPath: parentDirectoryPath(path),
          selectedPath: path,
        })
      }
    },
  }))
}

export const useWorkspaceStore = createWorkspaceStore(workspaceService)
