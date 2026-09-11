import {
  createDefaultPreferences,
  DEFAULT_PREFERENCES,
} from '@/domain/preferences'
import {
  createPreferencesStore,
  PREFERENCES_STORAGE_KEY,
  type PreferencesStorage,
} from '@/stores/preferences.store'

function createMemoryStorage(initialValue?: string) {
  const values = new Map<string, string>()
  if (initialValue) {
    values.set(PREFERENCES_STORAGE_KEY, initialValue)
  }

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  } satisfies PreferencesStorage
}

describe('preferences store', () => {
  it('uses defaults when no saved preferences exist', () => {
    const store = createPreferencesStore(createMemoryStorage())

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(store.getState().storageError).toBeNull()
  })

  it('persists updates and restores them in a new store', () => {
    const storage = createMemoryStorage()
    const store = createPreferencesStore(storage)

    store.getState().setAutosaveEnabled(false)
    store.getState().setAutosaveDelay(5000)
    store.getState().setTheme('dark')
    store.getState().setDocumentFont('serif')
    store.getState().setDefaultEditorMode('source')
    expect(store.getState().setCustomAccent('#e11d48')).toBe(true)

    const restoredStore = createPreferencesStore(storage)
    expect(restoredStore.getState().preferences).toEqual({
      version: 1,
      autosave: { enabled: false, delayMs: 5000 },
      theme: 'dark',
      accent: { preset: 'custom', customHex: '#E11D48' },
      documentFont: 'serif',
      defaultEditorMode: 'source',
    })
  })

  it('rejects an invalid custom accent without changing preferences', () => {
    const storage = createMemoryStorage()
    const store = createPreferencesStore(storage)
    const previousPreferences = store.getState().preferences

    expect(store.getState().setCustomAccent('#bad')).toBe(false)
    expect(store.getState().preferences).toBe(previousPreferences)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('recovers from malformed saved JSON without blocking startup', () => {
    const store = createPreferencesStore(createMemoryStorage('{broken'))

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(store.getState().storageError).toContain(
      '환경설정을 브라우저에서 불러오지 못했습니다.',
    )
  })

  it('keeps updates in memory when browser storage fails', () => {
    const storage: PreferencesStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    const store = createPreferencesStore(storage)

    store.getState().setTheme('dark')

    expect(store.getState().preferences.theme).toBe('dark')
    expect(store.getState().storageError).toContain('quota exceeded')
  })

  it('resets all preferences and persists the defaults', () => {
    const storage = createMemoryStorage()
    const changedPreferences = createDefaultPreferences()
    changedPreferences.theme = 'dark'
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(changedPreferences))

    const changedStore = createPreferencesStore(storage)
    changedStore.getState().resetPreferences()

    expect(changedStore.getState().preferences).toEqual(DEFAULT_PREFERENCES)
    expect(JSON.parse(storage.setItem.mock.lastCall?.[1] ?? '')).toEqual(
      DEFAULT_PREFERENCES,
    )
  })
})
