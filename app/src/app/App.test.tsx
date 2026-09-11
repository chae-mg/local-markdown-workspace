import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, vi } from 'vitest'

import { App } from '@/app/App'
import { useWorkspaceStore } from '@/stores/workspace.store'

describe('App', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: vi.fn(),
    })
    useWorkspaceStore.setState({
      entries: [],
      errorMessage: null,
      mutationErrorMessage: null,
      mutationStatus: 'idle',
      selectedDirectoryPath: 'Documents',
      selectedPath: null,
      status: 'checking',
      treeErrorMessage: null,
      treeStatus: 'idle',
      trashEntries: [],
      trashErrorMessage: null,
      trashStatus: 'idle',
      workspace: null,
    })
  })

  it('renders the Phase 8 workspace entry screen', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: '워크스페이스 열기' }),
    ).toBeEnabled()
    expect(screen.getByText('Phase 8 · Schema Engine')).toBeInTheDocument()
  })

  it('asks before initializing a folder that already contains files', () => {
    useWorkspaceStore.setState({
      status: 'initialization-required',
      workspace: {
        initialized: false,
        lastOpened: '2026-09-09T12:00:00.000Z',
        manifest: null,
        name: '기존 문서',
        permission: 'granted',
      },
    })

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: /이 폴더를 Workspace로/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Workspace로 초기화' }),
    ).toBeEnabled()
    expect(
      screen.getByText(
        /초기화 전에는 기존 파일을 수정하거나 이동하지 않습니다/,
      ),
    ).toBeInTheDocument()
  })
})
