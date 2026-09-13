import { act, render } from '@testing-library/react'

import { PreferenceEffects } from '@/app/preference-effects'
import {
  applyVisualPreferences,
  contrastColor,
  resolveAccentColor,
  resolveTheme,
} from '@/app/theme-preferences'
import { createDefaultPreferences } from '@/domain/preferences'
import { usePreferencesStore } from '@/stores/preferences.store'

const originalMatchMedia = window.matchMedia

describe('preference effects', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
    } else {
      Reflect.deleteProperty(window, 'matchMedia')
    }
    vi.restoreAllMocks()
  })

  it('resolves system themes and theme-aware monochrome accents', () => {
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(
      resolveAccentColor(
        { customHex: '#2383E2', preset: 'monochrome' },
        'light',
      ),
    ).toBe('#2F2F2D')
    expect(
      resolveAccentColor(
        { customHex: '#2383E2', preset: 'monochrome' },
        'dark',
      ),
    ).toBe('#F1F1EF')
  })

  it('chooses a readable black or white accent foreground', () => {
    expect(contrastColor('#000000')).toBe('#FFFFFF')
    expect(contrastColor('#FFFFFF')).toBe('#111111')
  })

  it('applies the resolved theme and custom accent tokens', () => {
    const preferences = createDefaultPreferences()
    preferences.theme = 'dark'
    preferences.accent = { customHex: '#FACC15', preset: 'custom' }

    applyVisualPreferences(preferences, false)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--ui-accent')).toBe(
      '#FACC15',
    )
    expect(
      document.documentElement.style.getPropertyValue('--ui-accent-contrast'),
    ).toBe('#111111')
  })

  it('follows system theme changes and removes its listener on unmount', () => {
    let matches = true
    const listeners = new Set<() => void>()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            addEventListener: (_type: string, listener: () => void) => {
              listeners.add(listener)
            },
            addListener: vi.fn(),
            dispatchEvent: vi.fn(),
            get matches() {
              return matches
            },
            media: '(prefers-color-scheme: dark)',
            onchange: null,
            removeEventListener: (_type: string, listener: () => void) => {
              listeners.delete(listener)
            },
            removeListener: vi.fn(),
          }) as unknown as MediaQueryList,
      ),
    })
    usePreferencesStore.setState({ preferences: createDefaultPreferences() })

    const { unmount } = render(<PreferenceEffects />)
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => {
      matches = false
      listeners.forEach((listener) => listener())
    })
    expect(document.documentElement.dataset.theme).toBe('light')

    unmount()
    expect(listeners).toHaveLength(0)
  })
})
