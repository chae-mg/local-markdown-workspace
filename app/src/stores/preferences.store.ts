import { create } from 'zustand'

import {
  type AccentPreset,
  type AutosaveDelayMs,
  createDefaultPreferences,
  type DefaultEditorMode,
  type DocumentFontPreference,
  normalizeHexColor,
  parsePreferences,
  type ThemePreference,
  type UserPreferences,
} from '@/domain/preferences'

export const PREFERENCES_STORAGE_KEY = 'local-markdown-workspace.preferences'

export interface PreferencesStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface PreferencesStore {
  preferences: UserPreferences
  storageError: string | null
  resetPreferences(): void
  setAccentPreset(preset: AccentPreset): void
  setAutosaveDelay(delayMs: AutosaveDelayMs): void
  setAutosaveEnabled(enabled: boolean): void
  setCustomAccent(value: string): boolean
  setDefaultEditorMode(mode: DefaultEditorMode): void
  setDocumentFont(font: DocumentFontPreference): void
  setTheme(theme: ThemePreference): void
}

function storageErrorMessage(error: unknown, operation: 'load' | 'save') {
  const operationLabel = operation === 'load' ? '불러오지' : '저장하지'
  return error instanceof Error
    ? `환경설정을 브라우저에서 ${operationLabel} 못했습니다. ${error.message}`
    : `환경설정을 브라우저에서 ${operationLabel} 못했습니다.`
}

function loadPreferences(storage: PreferencesStorage | null) {
  if (!storage) {
    return {
      preferences: createDefaultPreferences(),
      storageError: null,
    }
  }

  try {
    const storedValue = storage.getItem(PREFERENCES_STORAGE_KEY)
    return {
      preferences: storedValue
        ? parsePreferences(JSON.parse(storedValue))
        : createDefaultPreferences(),
      storageError: null,
    }
  } catch (error) {
    return {
      preferences: createDefaultPreferences(),
      storageError: storageErrorMessage(error, 'load'),
    }
  }
}

export function createPreferencesStore(storage: PreferencesStorage | null) {
  const initialState = loadPreferences(storage)

  return create<PreferencesStore>((set, get) => {
    const replacePreferences = (preferences: UserPreferences) => {
      let storageError: string | null = null

      if (storage) {
        try {
          storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
        } catch (error) {
          storageError = storageErrorMessage(error, 'save')
        }
      }

      set({ preferences, storageError })
    }

    return {
      ...initialState,

      resetPreferences() {
        replacePreferences(createDefaultPreferences())
      },

      setAccentPreset(preset) {
        replacePreferences({
          ...get().preferences,
          accent: { ...get().preferences.accent, preset },
        })
      },

      setAutosaveDelay(delayMs) {
        replacePreferences({
          ...get().preferences,
          autosave: { ...get().preferences.autosave, delayMs },
        })
      },

      setAutosaveEnabled(enabled) {
        replacePreferences({
          ...get().preferences,
          autosave: { ...get().preferences.autosave, enabled },
        })
      },

      setCustomAccent(value) {
        const customHex = normalizeHexColor(value)
        if (!customHex) {
          return false
        }

        replacePreferences({
          ...get().preferences,
          accent: { customHex, preset: 'custom' },
        })
        return true
      },

      setDefaultEditorMode(defaultEditorMode) {
        replacePreferences({ ...get().preferences, defaultEditorMode })
      },

      setDocumentFont(documentFont) {
        replacePreferences({ ...get().preferences, documentFont })
      },

      setTheme(theme) {
        replacePreferences({ ...get().preferences, theme })
      },
    }
  })
}

function resolveBrowserStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const usePreferencesStore = createPreferencesStore(
  resolveBrowserStorage(),
)
