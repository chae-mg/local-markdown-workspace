import type {
  AccentPreset,
  ThemePreference,
  UserPreferences,
} from '@/domain/preferences'

export type ResolvedTheme = 'light' | 'dark'

const ACCENT_COLORS: Record<
  Exclude<AccentPreset, 'monochrome' | 'custom'>,
  Record<ResolvedTheme, string>
> = {
  blue: { light: '#2383E2', dark: '#529CCA' },
  orange: { light: '#D9730D', dark: '#E58A32' },
  purple: { light: '#9065B0', dark: '#A67CC5' },
}

function systemThemeQuery() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
}

export function subscribeToSystemTheme(onStoreChange: () => void) {
  const query = systemThemeQuery()
  query?.addEventListener('change', onStoreChange)
  return () => query?.removeEventListener('change', onStoreChange)
}

export function systemPrefersDark() {
  return systemThemeQuery()?.matches ?? false
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
}

export function contrastColor(hexColor: string) {
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hexColor.slice(index, index + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  const whiteContrast = 1.05 / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / 0.05

  return whiteContrast >= blackContrast ? '#FFFFFF' : '#111111'
}

export function resolveAccentColor(
  accent: UserPreferences['accent'],
  theme: ResolvedTheme,
) {
  if (accent.preset === 'monochrome') {
    return theme === 'dark' ? '#F1F1EF' : '#2F2F2D'
  }
  if (accent.preset === 'custom') {
    return accent.customHex
  }
  return ACCENT_COLORS[accent.preset][theme]
}

export function applyVisualPreferences(
  preferences: UserPreferences,
  prefersDark: boolean,
) {
  const root = document.documentElement
  const theme = resolveTheme(preferences.theme, prefersDark)
  const accent = resolveAccentColor(preferences.accent, theme)

  root.dataset.theme = theme
  root.style.setProperty('--ui-accent', accent)
  root.style.setProperty('--ui-accent-contrast', contrastColor(accent))
  root.style.setProperty(
    '--ui-accent-hover',
    `color-mix(in srgb, ${accent} 84%, ${theme === 'dark' ? '#FFFFFF' : '#000000'})`,
  )
  root.style.setProperty(
    '--ui-accent-soft',
    `color-mix(in srgb, ${accent} 14%, transparent)`,
  )

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#202020' : '#FFFFFF')
}
