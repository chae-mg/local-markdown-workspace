import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { UnsavedChangesDialog } from '@/components/editor/unsaved-changes-dialog'

function renderDialog(
  overrides: { isOpen?: boolean; isSaving?: boolean } = {},
) {
  const handlers = {
    onCancel: vi.fn(),
    onDiscard: vi.fn(),
    onSave: vi.fn(),
  }

  render(
    <UnsavedChangesDialog
      documentName="메모.md"
      isOpen={overrides.isOpen ?? true}
      isSaving={overrides.isSaving ?? false}
      {...handlers}
    />,
  )

  return handlers
}

describe('UnsavedChangesDialog', () => {
  it('offers save, discard, and cancel choices for the current document', async () => {
    const user = userEvent.setup()
    const handlers = renderDialog()

    expect(
      screen.getByRole('dialog', {
        name: '저장하지 않은 변경사항이 있습니다',
      }),
    ).toHaveTextContent('메모.md')

    await user.click(screen.getByRole('button', { name: '저장하고 이동' }))
    expect(handlers.onSave).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: '저장하지 않고 이동' }))
    expect(handlers.onDiscard).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(handlers.onCancel).toHaveBeenCalledOnce()
  })

  it('cancels with Escape and locks choices while saving', async () => {
    const user = userEvent.setup()
    const handlers = renderDialog({ isSaving: true })

    await user.keyboard('{Escape}')
    expect(handlers.onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '저장 중' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: '저장하지 않고 이동' }),
    ).toBeDisabled()
  })
})
