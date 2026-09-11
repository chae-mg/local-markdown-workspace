const root = document.documentElement
const appShell = document.querySelector('#app-shell')
const banner = document.querySelector('.prototype-banner')
const settingsDialog = document.querySelector('#settings-dialog')
const toast = document.querySelector('#toast')
const autosaveToggle = document.querySelector('#autosave-toggle')
const autosaveDelayRow = document.querySelector('#autosave-delay-row')
const mobileQuery = window.matchMedia('(max-width: 760px)')

let toastTimer

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
    const theme = button.dataset.themeChoice
    document.querySelectorAll('[data-theme-choice]').forEach((option) => {
      option.classList.toggle('active', option === button)
    })

    const resolvedTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme

    root.dataset.theme = resolvedTheme
  })
})

mobileQuery.addEventListener('change', setSidebarInitialState)
setSidebarInitialState()
