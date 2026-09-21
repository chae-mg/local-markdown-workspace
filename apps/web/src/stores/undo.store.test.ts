import { describe, expect, it, vi } from 'vitest'

import { useUndoStore } from '@/stores/undo.store'

describe('undo store', () => {
  it('undoes the most recent command and removes it from the session stack', async () => {
    const undoFirst = vi.fn(async () => undefined)
    const undoSecond = vi.fn(async () => undefined)

    useUndoStore.getState().clear()
    useUndoStore.getState().push({
      kind: 'document-edit',
      label: '첫 번째 변경 되돌리기',
      undo: undoFirst,
    })
    useUndoStore.getState().push({
      kind: 'kanban-move',
      label: '두 번째 이동 되돌리기',
      undo: undoSecond,
    })

    await expect(useUndoStore.getState().undo()).resolves.toBe(true)

    expect(undoSecond).toHaveBeenCalledOnce()
    expect(undoFirst).not.toHaveBeenCalled()
    expect(useUndoStore.getState().entries).toHaveLength(1)
    expect(useUndoStore.getState().entries[0]?.label).toBe(
      '첫 번째 변경 되돌리기',
    )
  })

  it('keeps a command when its undo operation fails', async () => {
    useUndoStore.getState().clear()
    useUndoStore.getState().push({
      kind: 'property-edit',
      label: '실패한 변경 되돌리기',
      undo: async () => {
        throw new Error('외부 변경으로 되돌릴 수 없습니다.')
      },
    })

    await expect(useUndoStore.getState().undo()).resolves.toBe(false)

    expect(useUndoStore.getState().entries).toHaveLength(1)
    expect(useUndoStore.getState().errorMessage).toBe(
      '외부 변경으로 되돌릴 수 없습니다.',
    )
    expect(useUndoStore.getState().isUndoing).toBe(false)
  })

  it('clears a previous error when a new command is added', async () => {
    useUndoStore.getState().clear()
    useUndoStore.getState().push({
      kind: 'document-edit',
      label: '실패',
      undo: async () => {
        throw new Error('실패')
      },
    })
    await useUndoStore.getState().undo()

    useUndoStore.getState().push({
      kind: 'document-edit',
      label: '새 변경',
      undo: async () => undefined,
    })

    expect(useUndoStore.getState().errorMessage).toBeNull()
  })
})
