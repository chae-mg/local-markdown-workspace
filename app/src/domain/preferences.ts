export type ThemePreference = 'system' | 'light' | 'dark'
export type AccentPreset =
  'blue' | 'orange' | 'purple' | 'monochrome' | 'custom'
export type DocumentFontPreference = 'notion' | 'pretendard' | 'serif' | 'mono'
export type DefaultEditorMode = 'visual' | 'source'
export type AutosaveDelayMs = 1000 | 3000 | 5000

export interface UserPreferences {
  version: 1
  autosave: {
    enabled: boolean
    delayMs: AutosaveDelayMs
  }
  theme: ThemePreference
  accent: {
    preset: AccentPreset
    customHex: string
  }
  documentFont: DocumentFontPreference
  defaultEditorMode: DefaultEditorMode
}

export const DEFAULT_CUSTOM_ACCENT = '#2383E2'

export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = {
  version: 1,
  autosave: {
    enabled: true,
    delayMs: 1000,
  },
  theme: 'system',
  accent: {
    preset: 'blue',
    customHex: DEFAULT_CUSTOM_ACCENT,
  },
  documentFont: 'notion',
  defaultEditorMode: 'visual',
}

const themePreferences = new Set<ThemePreference>(['system', 'light', 'dark'])
const accentPresets = new Set<AccentPreset>([
  'blue',
  'orange',
  'purple',
  'monochrome',
  'custom',
])
const documentFontPreferences = new Set<DocumentFontPreference>([
  'notion',
  'pretendard',
  'serif',
  'mono',
])
const defaultEditorModes = new Set<DefaultEditorMode>(['visual', 'source'])
const autosaveDelays = new Set<AutosaveDelayMs>([1000, 3000, 5000])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMember<T extends string | number>(
  values: ReadonlySet<T>,
  value: unknown,
): value is T {
  return values.has(value as T)
}

export function normalizeHexColor(value: unknown) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    return null
  }

  return value.toUpperCase()
}

export function createDefaultPreferences(): UserPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    accent: { ...DEFAULT_PREFERENCES.accent },
    autosave: { ...DEFAULT_PREFERENCES.autosave },
  }
}

export function parsePreferences(value: unknown): UserPreferences {
  const defaults = createDefaultPreferences()

  if (!isRecord(value) || value.version !== 1) {
    return defaults
  }

  const autosave = isRecord(value.autosave) ? value.autosave : {}
  const accent = isRecord(value.accent) ? value.accent : {}

  return {
    version: 1,
    autosave: {
      enabled:
        typeof autosave.enabled === 'boolean'
          ? autosave.enabled
          : defaults.autosave.enabled,
      delayMs: isMember(autosaveDelays, autosave.delayMs)
        ? autosave.delayMs
        : defaults.autosave.delayMs,
    },
    theme: isMember(themePreferences, value.theme)
      ? value.theme
      : defaults.theme,
    accent: {
      preset: isMember(accentPresets, accent.preset)
        ? accent.preset
        : defaults.accent.preset,
      customHex:
        normalizeHexColor(accent.customHex) ?? defaults.accent.customHex,
    },
    documentFont: isMember(documentFontPreferences, value.documentFont)
      ? value.documentFont
      : defaults.documentFont,
    defaultEditorMode: isMember(defaultEditorModes, value.defaultEditorMode)
      ? value.defaultEditorMode
      : defaults.defaultEditorMode,
  }
}
