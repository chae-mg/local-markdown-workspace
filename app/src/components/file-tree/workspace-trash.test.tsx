import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { WorkspaceTrash } from '@/components/file-tree/workspace-trash'
import type { TrashEntryMetadata } from '@/domain/workspace'

const entries: TrashEntryMetadata[] = [
  {
    version: 1,
    id: 'trash_123456',
    originalPath: 'Documents/회의록.md',
    payloadPath: '.workspace/trash/trash_123456/payload/회의록.md',
    kind: 'file',
    deletedAt: '2026-09-10T12:00:00.000Z',
  },
]

function renderTrash(
  overrides: Partial<React.ComponentProps<typeof WorkspaceTrash>> = {},
) {
  const props: React.ComponentProps<typeof WorkspaceTrash> = {
    entries,
    errorMessage: null,
    isLoading: false,
    isMutating: false,
    mutationErrorMessage: null,
    onClearMutationError: vi.fn(),
    onEmpty: vi.fn(async () => true),
    onRefresh: vi.fn(),
    onRestore: vi.fn(async () => true),
    ...overrides,
  }

  render(<WorkspaceTrash {...props} />)
  return props
}

describe('WorkspaceTrash', () => {
  it('shows its empty state and supports refreshing', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    renderTrash({ entries: [], onRefresh })

    expect(screen.getByText('휴지통이 비어 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '휴지통 비우기' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '휴지통 새로고침' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('restores an entry under an alternate name', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn(async () => true)
    renderTrash({ onRestore })

    await user.click(screen.getByRole('button', { name: '회의록.md 복원' }))
    const input = screen.getByRole('textbox', { name: '복원할 이름' })
    expect(input).toHaveValue('회의록.md')

    await user.clear(input)
    await user.type(input, '복원 회의록')
    await user.click(screen.getByRole('button', { name: /^복원$/ }))

    expect(onRestore).toHaveBeenCalledWith('trash_123456', '복원 회의록')
  })

  it('requires explicit confirmation before permanently emptying trash', async () => {
    const user = userEvent.setup()
    const onEmpty = vi.fn(async () => true)
    renderTrash({ onEmpty })

    await user.click(screen.getByRole('button', { name: '휴지통 비우기' }))

    expect(
      screen.getByText('휴지통의 1개 항목을 영구 삭제할까요?'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('이 작업은 되돌릴 수 없습니다.'),
    ).toBeInTheDocument()
    expect(onEmpty).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '영구 삭제' }))
    expect(onEmpty).toHaveBeenCalledOnce()
  })
})
