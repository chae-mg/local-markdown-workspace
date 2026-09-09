import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from '@/app/App'

describe('App', () => {
  it('renders the Phase 0 workspace entry screen', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '워크스페이스 열기' }),
    ).toBeDisabled()
    expect(screen.getByText('Phase 0 · 준비됨')).toBeInTheDocument()
  })
})
