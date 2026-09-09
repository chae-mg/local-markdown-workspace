import { create } from 'zustand'

import type { WorkspaceSummary } from '@/domain/file-system'
import { isPickerCancellation } from '@/domain/errors'
import { workspaceService } from '@/app/composition-root'
import type { WorkspaceApplicationService } from '@/services/workspace.service'

export type WorkspaceStatus =
  | 'checking'
  | 'idle'
  | 'opening'
  | 'permission-required'
  | 'ready'
  | 'unsupported'
  | 'error'

export interface WorkspaceStore {
  errorMessage: string | null
  status: WorkspaceStatus
  workspace: WorkspaceSummary | null
  initialize(): Promise<void>
  openWorkspace(): Promise<void>
  reconnectWorkspace(): Promise<void>
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Workspace를 여는 중 알 수 없는 오류가 발생했습니다.'
}

export function createWorkspaceStore(service: WorkspaceApplicationService) {
  return create<WorkspaceStore>((set, get) => ({
    errorMessage: null,
    status: 'checking',
    workspace: null,

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
          status:
            workspace.permission === 'granted'
              ? 'ready'
              : 'permission-required',
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

      set({ status: 'opening', errorMessage: null })

      try {
        const workspace = await service.selectWorkspace()
        set({ status: 'ready', workspace })
      } catch (error) {
        if (isPickerCancellation(error)) {
          set({ status: 'idle' })
          return
        }

        set({ status: 'error', errorMessage: messageFromError(error) })
      }
    },

    async reconnectWorkspace() {
      if (get().status === 'opening') {
        return
      }

      set({ status: 'opening', errorMessage: null })

      try {
        const workspace = await service.requestRecentWorkspacePermission()
        set({ status: 'ready', workspace })
      } catch (error) {
        set({
          status: 'permission-required',
          errorMessage: messageFromError(error),
        })
      }
    },
  }))
}

export const useWorkspaceStore = createWorkspaceStore(workspaceService)
