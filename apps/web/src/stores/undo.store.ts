import { create } from 'zustand'

import type { UndoCommand } from '@/domain/undo'

const maxUndoEntries = 50

export interface UndoStore {
  entries: UndoCommand[]
  errorMessage: string | null
  isUndoing: boolean
  clear(): void
  clearError(): void
  push(command: UndoCommand): void
  undo(): Promise<boolean>
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message
    : '최근 변경을 되돌리는 중 알 수 없는 오류가 발생했습니다.'
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  entries: [],
  errorMessage: null,
  isUndoing: false,

  clear() {
    set({ entries: [], errorMessage: null, isUndoing: false })
  },

  clearError() {
    set({ errorMessage: null })
  },

  push(command) {
    set((state) => ({
      entries: [...state.entries, command].slice(-maxUndoEntries),
      errorMessage: null,
    }))
  },

  async undo() {
    const entries = get().entries
    const command = entries.at(-1)
    const remaining = entries.slice(0, -1)
    if (!command || get().isUndoing) {
      return false
    }

    set({ errorMessage: null, isUndoing: true })

    try {
      await command.undo()
      set({ entries: remaining, isUndoing: false })
      return true
    } catch (error) {
      set({ errorMessage: messageFromError(error), isUndoing: false })
      return false
    }
  },
}))
