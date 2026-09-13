import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import { App } from '@/app/App'
import { PreferenceEffects } from '@/app/preference-effects'
import {
  applyVisualPreferences,
  systemPrefersDark,
} from '@/app/theme-preferences'
import { usePreferencesStore } from '@/stores/preferences.store'
import '@/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found')
}

applyVisualPreferences(
  usePreferencesStore.getState().preferences,
  systemPrefersDark(),
)

createRoot(rootElement).render(
  <StrictMode>
    <HashRouter>
      <PreferenceEffects />
      <App />
    </HashRouter>
  </StrictMode>,
)
