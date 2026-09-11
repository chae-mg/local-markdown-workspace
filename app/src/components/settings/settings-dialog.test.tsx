import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { SettingsDialog } from '@/components/settings/settings-dialog'
import { createDefaultPreferences } from '@/domain/preferences'
import { usePreferencesStore } from '@/stores/preferences.store'

describe('SettingsDialog', () => {
  beforeEach(() => {
    window.localStorage.clear()
    usePreferencesStore.setState({
      preferences: createDefaultPreferences(),
      storageError: null,
    })
  })

  it('does not render when closed', () => {
    render(<SettingsDialog isOpen={false} onClose={vi.fn()} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('changes autosave preferences and disables the delay control', async () => {
    const user = userEvent.setup()
    render(<SettingsDialog isOpen onClose={vi.fn()} />)

    const autosaveToggle = screen.getByRole('checkbox', {
      name: '자동 저장 사용',
    })
    const delaySelect = screen.getByRole('combobox', {
      name: '자동 저장 간격',
    })

    await user.selectOptions(delaySelect, '5000')
    await user.click(autosaveToggle)

    expect(usePreferencesStore.getState().preferences.autosave).toEqual({
      enabled: false,
      delayMs: 5000,
    })
    expect(delaySelect).toBeDisabled()
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SettingsDialog isOpen onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
