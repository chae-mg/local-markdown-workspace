import { useLayoutEffect, useSyncExternalStore } from 'react'

import {
  applyVisualPreferences,
  subscribeToSystemTheme,
  systemPrefersDark,
} from '@/app/theme-preferences'
import { usePreferencesStore } from '@/stores/preferences.store'

export function PreferenceEffects() {
  const preferences = usePreferencesStore((state) => state.preferences)
  const prefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemPrefersDark,
    () => false,
  )

  useLayoutEffect(() => {
    applyVisualPreferences(preferences, prefersDark)
  }, [preferences, prefersDark])

  return null
}
