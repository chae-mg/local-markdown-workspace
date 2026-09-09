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
      errorMessage: null,
      status: 'checking',
      workspace: null,
    })
  })

  it('renders the Phase 1 workspace entry screen', async () => {
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
    expect(screen.getByText('Phase 1 · File System')).toBeInTheDocument()
  })
})
