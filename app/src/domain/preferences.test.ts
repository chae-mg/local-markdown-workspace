import {
  createDefaultPreferences,
  DEFAULT_PREFERENCES,
  normalizeHexColor,
  parsePreferences,
} from '@/domain/preferences'

describe('preferences', () => {
  it('returns independent default preference objects', () => {
    const first = createDefaultPreferences()
    const second = createDefaultPreferences()

    first.autosave.enabled = false
    first.accent.customHex = '#FFFFFF'

    expect(second).toEqual(DEFAULT_PREFERENCES)
  })

  it('keeps valid fields and repairs missing or invalid fields', () => {
    expect(
      parsePreferences({
        version: 1,
        autosave: { enabled: false, delayMs: 7000 },
        theme: 'dark',
        accent: { preset: 'purple', customHex: '#aabbcc' },
        documentFont: 'unknown',
        defaultEditorMode: 'source',
      }),
    ).toEqual({
      version: 1,
      autosave: { enabled: false, delayMs: 1000 },
      theme: 'dark',
      accent: { preset: 'purple', customHex: '#AABBCC' },
      documentFont: 'notion',
      defaultEditorMode: 'source',
    })
  })

  it('uses defaults for unsupported future versions', () => {
    expect(parsePreferences({ version: 2, theme: 'dark' })).toEqual(
      DEFAULT_PREFERENCES,
    )
  })

  it('accepts only six digit hex colors', () => {
    expect(normalizeHexColor('#e11d48')).toBe('#E11D48')
    expect(normalizeHexColor('#fff')).toBeNull()
    expect(normalizeHexColor('2383E2')).toBeNull()
  })
})
