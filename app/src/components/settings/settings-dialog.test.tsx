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

  it('changes the theme and accent preset', async () => {
    const user = userEvent.setup()
    render(<SettingsDialog isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: '다크' }))
    await user.click(screen.getByRole('radio', { name: '보라' }))

    expect(usePreferencesStore.getState().preferences).toMatchObject({
      theme: 'dark',
      accent: { preset: 'purple' },
    })
  })

  it('validates and saves a reusable custom accent color', async () => {
    const user = userEvent.setup()
    render(<SettingsDialog isOpen onClose={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: '커스텀' }))
    const hexInput = screen.getByLabelText('HEX')
    await user.clear(hexInput)
    await user.type(hexInput, '#BAD')
    await user.click(screen.getByRole('button', { name: '컬러 저장' }))
    expect(screen.getByRole('alert')).toHaveTextContent('여섯 자리 HEX')

    await user.clear(hexInput)
    await user.type(hexInput, '#12abef')
    await user.click(screen.getByRole('button', { name: '컬러 저장' }))

    expect(usePreferencesStore.getState().preferences.accent).toEqual({
      preset: 'custom',
      customHex: '#12ABEF',
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SettingsDialog isOpen onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
