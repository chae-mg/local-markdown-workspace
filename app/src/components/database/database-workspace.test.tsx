import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { DatabaseWorkspace } from '@/components/database/database-workspace'
import type { DatabaseApplicationService } from '@/services/database.service'

const schema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {},
}

const item = {
  id: 'item_123456',
  path: 'Databases/프로젝트/items/item_123456.md',
  title: '대시보드 개선',
  properties: {},
  body: '\n# 대시보드 개선\n',
  lastModified: 10,
}

function createService(options?: { empty?: boolean }) {
  return {
    createDatabase: vi.fn(async () => schema),
    createItem: vi.fn(async () => item),
    deleteItem: vi.fn(async () => undefined),
    listDatabases: vi.fn(async () => (options?.empty ? [] : [schema])),
    loadDatabase: vi.fn(async () => schema),
    loadItems: vi.fn(async () => (options?.empty ? [] : [item])),
  } satisfies DatabaseApplicationService
}

describe('DatabaseWorkspace', () => {
  it('lists database items and opens their Markdown file', async () => {
    const user = userEvent.setup()
    const service = createService()
    const onOpenItem = vi.fn()

    render(
      <DatabaseWorkspace
        onOpenItem={onOpenItem}
        onWorkspaceChanged={vi.fn()}
        service={service}
      />,
    )

    expect(
      await screen.findByRole('heading', { name: '프로젝트' }),
    ).toBeInTheDocument()
    await user.click(await screen.findByText('대시보드 개선'))
    expect(onOpenItem).toHaveBeenCalledWith(item.path)
  })

  it('creates a database and then a Markdown item', async () => {
    const user = userEvent.setup()
    const service = createService({ empty: true })
    const onWorkspaceChanged = vi.fn()

    render(
      <DatabaseWorkspace
        onOpenItem={vi.fn()}
        onWorkspaceChanged={onWorkspaceChanged}
        service={service}
      />,
    )

    await screen.findByText(/첫 데이터베이스를 만들면/)
    await user.click(screen.getByRole('button', { name: '새 데이터베이스' }))
    await user.type(
      screen.getByRole('textbox', { name: '새 데이터베이스 이름' }),
      '프로젝트',
    )
    await user.click(screen.getByRole('button', { name: '생성' }))

    expect(service.createDatabase).toHaveBeenCalledWith('프로젝트')
    expect(
      await screen.findByRole('heading', { name: '프로젝트' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '새 항목' }))
    await user.type(
      screen.getByRole('textbox', { name: '새 항목 제목' }),
      '대시보드 개선',
    )
    await user.click(screen.getByRole('button', { name: '생성' }))

    expect(service.createItem).toHaveBeenCalledWith(
      'db_123456',
      '대시보드 개선',
    )
    expect(await screen.findByText('대시보드 개선')).toBeInTheDocument()
    expect(onWorkspaceChanged).toHaveBeenCalledTimes(2)
  })
})
