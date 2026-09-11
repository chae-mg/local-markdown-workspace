const root = document.documentElement
const appShell = document.querySelector('#app-shell')
const banner = document.querySelector('.prototype-banner')
const settingsDialog = document.querySelector('#settings-dialog')
const toast = document.querySelector('#toast')
const autosaveToggle = document.querySelector('#autosave-toggle')
const autosaveDelayRow = document.querySelector('#autosave-delay-row')
const customAccentEditor = document.querySelector('#custom-accent-editor')
const customAccentPicker = document.querySelector('#custom-accent-picker')
const customAccentHex = document.querySelector('#custom-accent-hex')
const customAccentError = document.querySelector('#custom-accent-error')
const mobileQuery = window.matchMedia('(max-width: 760px)')
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
const preferenceStorageKey = 'local-markdown-ui-prototype-v1'

const accentPresets = {
  blue: '#2383E2',
  orange: '#D9730D',
  purple: '#9065B0',
}

const defaultPreferences = {
  theme: 'system',
  accent: 'blue',
  customAccent: '#2F80ED',
}

let preferences = readPreferences()
let toastTimer

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(preferenceStorageKey))
    const theme = ['system', 'light', 'dark'].includes(stored?.theme)
      ? stored.theme
      : defaultPreferences.theme
    const accent = [
      'blue',
      'orange',
      'purple',
      'monochrome',
      'custom',
    ].includes(stored?.accent)
      ? stored.accent
      : defaultPreferences.accent
    const customAccent = isHexColor(stored?.customAccent)
      ? stored.customAccent.toUpperCase()
      : defaultPreferences.customAccent

    return { theme, accent, customAccent }
  } catch {
    return { ...defaultPreferences }
  }
}

function persistPreferences(nextPreferences) {
  preferences = { ...preferences, ...nextPreferences }
  localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences))
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value)
}

function getContrastColor(hexColor) {
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

function resolveAccentColor(accent, customAccent = preferences.customAccent) {
  if (accent === 'monochrome') {
    return root.dataset.theme === 'dark' ? '#F1F1EF' : '#2F2F2D'
  }

  if (accent === 'custom') return customAccent
  return accentPresets[accent] ?? accentPresets.blue
}

function setAccentColor(color) {
  root.style.setProperty('--accent', color)
  root.style.setProperty('--accent-contrast', getContrastColor(color))
}

function applyAccentChoice(accent, options = {}) {
  const { customAccent = preferences.customAccent, persist = true } = options
  const color = resolveAccentColor(accent, customAccent)

  document.querySelectorAll('[data-accent-choice]').forEach((button) => {
    const isActive = button.dataset.accentChoice === accent
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })

  customAccentEditor.hidden = accent !== 'custom'
  customAccentPicker.value = customAccent
  customAccentHex.value = customAccent.toUpperCase()
  document.querySelector('.custom-swatch').style.background = customAccent
  setAccentColor(color)

  if (persist) persistPreferences({ accent, customAccent })
}

function applyThemeChoice(theme, persist = true) {
  const resolvedTheme =
    theme === 'system' ? (systemThemeQuery.matches ? 'dark' : 'light') : theme

  root.dataset.theme = resolvedTheme
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const isActive = button.dataset.themeChoice === theme
    button.classList.toggle('active', isActive)
    button.setAttribute('aria-pressed', String(isActive))
  })

  applyAccentChoice(preferences.accent, { persist: false })
  if (persist) persistPreferences({ theme })
}

function showToast(message) {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.add('visible')
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 1800)
}

function setSidebarInitialState() {
  appShell.classList.toggle('sidebar-collapsed', mobileQuery.matches)
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `${viewName}-view`)
  })

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName)
  })

  const isDocument = viewName === 'document'
  document.querySelector('#breadcrumbs').innerHTML = isDocument
    ? '<span>개인 문서</span><b>/</b><strong>제품 로드맵</strong>'
    : '<span>데이터베이스</span><b>/</b><strong>프로젝트</strong>'

  if (mobileQuery.matches) {
    appShell.classList.add('sidebar-collapsed')
  }
}

function closeSettings() {
  settingsDialog.hidden = true
  document.querySelector('#open-settings').focus()
}

function saveCustomAccent() {
  const value = customAccentHex.value.trim().toUpperCase()

  if (!isHexColor(value)) {
    customAccentHex.classList.add('invalid')
    customAccentError.textContent = '# 뒤에 여섯 자리 HEX 색상을 입력해 주세요.'
    customAccentHex.focus()
    return
  }

  customAccentHex.classList.remove('invalid')
  customAccentError.textContent = ''
  applyAccentChoice('custom', { customAccent: value })
  showToast('커스텀 키 컬러를 저장했습니다.')
}

document.querySelector('#close-banner').addEventListener('click', () => {
  banner.remove()
  appShell.classList.add('banner-closed')
})

document.querySelector('#toggle-sidebar').addEventListener('click', () => {
  appShell.classList.toggle('sidebar-collapsed')
})

document.querySelector('#sidebar-scrim').addEventListener('click', () => {
  appShell.classList.add('sidebar-collapsed')
})

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view))
})

document.querySelectorAll('[data-action="placeholder"]').forEach((button) => {
  button.addEventListener('click', () =>
    showToast('구조 확인용 예시 항목입니다.'),
  )
})

document
  .querySelector('[data-action="search"]')
  .addEventListener('click', () => {
    showToast('검색 화면은 다음 시안에서 연결할 수 있어요.')
  })

document.querySelector('#open-settings').addEventListener('click', () => {
  settingsDialog.hidden = false
  document.querySelector('#close-settings').focus()
})

document
  .querySelector('#close-settings')
  .addEventListener('click', closeSettings)

settingsDialog.addEventListener('click', (event) => {
  if (event.target === settingsDialog) closeSettings()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !settingsDialog.hidden) closeSettings()
})

autosaveToggle.addEventListener('change', () => {
  autosaveDelayRow.classList.toggle('disabled', !autosaveToggle.checked)
  autosaveDelayRow.querySelector('select').disabled = !autosaveToggle.checked
})

document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    applyThemeChoice(button.dataset.themeChoice)
  })
})

document.querySelectorAll('[data-accent-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    applyAccentChoice(button.dataset.accentChoice)
  })
})

customAccentPicker.addEventListener('input', () => {
  const value = customAccentPicker.value.toUpperCase()
  customAccentHex.value = value
  customAccentHex.classList.remove('invalid')
  customAccentError.textContent = ''
  document.querySelector('.custom-swatch').style.background = value
  setAccentColor(value)
})

customAccentHex.addEventListener('input', () => {
  const value = customAccentHex.value.trim().toUpperCase()
  customAccentHex.classList.remove('invalid')
  customAccentError.textContent = ''

  if (isHexColor(value)) {
    customAccentPicker.value = value
    document.querySelector('.custom-swatch').style.background = value
    setAccentColor(value)
  }
})

document
  .querySelector('#save-custom-accent')
  .addEventListener('click', saveCustomAccent)

systemThemeQuery.addEventListener('change', () => {
  if (preferences.theme === 'system') applyThemeChoice('system', false)
})
mobileQuery.addEventListener('change', setSidebarInitialState)

applyThemeChoice(preferences.theme, false)
applyAccentChoice(preferences.accent, {
  customAccent: preferences.customAccent,
  persist: false,
})
setSidebarInitialState()
