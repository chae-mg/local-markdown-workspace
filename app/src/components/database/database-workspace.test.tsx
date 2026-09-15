import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { DatabaseWorkspace } from '@/components/database/database-workspace'
import type { DatabaseView } from '@/domain/database-view'
import type { DatabaseApplicationService } from '@/services/database.service'
import type { ViewApplicationService } from '@/services/view.service'

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

const view: DatabaseView = {
  version: 1,
  id: 'view_123456',
  databaseId: schema.id,
  name: '전체 항목',
  type: 'table',
  filters: [],
  sorts: [],
  hiddenProperties: [],
  propertyOrder: [],
}

function createService(options?: { empty?: boolean }) {
  return {
    createDatabase: vi.fn(async () => schema),
    createItem: vi.fn(async () => item),
    deleteItem: vi.fn(async () => undefined),
    listDatabases: vi.fn(async () => (options?.empty ? [] : [schema])),
    loadDatabase: vi.fn(async () => schema),
    loadItems: vi.fn(async () => (options?.empty ? [] : [item])),
    updateProperty: vi.fn(async () => item),
  } satisfies DatabaseApplicationService
}

function createViewService(options?: { empty?: boolean }) {
  return {
    createView: vi.fn(async () => view),
    deleteView: vi.fn(async () => undefined),
    listViews: vi.fn(async () => (options?.empty ? [] : [view])),
    updateView: vi.fn(async (updatedView) => updatedView),
  } satisfies ViewApplicationService
}

describe('DatabaseWorkspace', () => {
  it('lists database items and opens their Markdown file', async () => {
    const user = userEvent.setup()
    const service = createService()
    const viewApplicationService = createViewService()
    const onOpenItem = vi.fn()

    render(
      <DatabaseWorkspace
        onOpenItem={onOpenItem}
        onWorkspaceChanged={vi.fn()}
        service={service}
        viewApplicationService={viewApplicationService}
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
    const viewApplicationService = createViewService({ empty: true })
    const onWorkspaceChanged = vi.fn()

    render(
      <DatabaseWorkspace
        onOpenItem={vi.fn()}
        onWorkspaceChanged={onWorkspaceChanged}
        service={service}
        viewApplicationService={viewApplicationService}
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

  it('persists the selected View type instead of keeping local-only UI state', async () => {
    const user = userEvent.setup()
    const service = createService()
    const viewApplicationService = createViewService()

    render(
      <DatabaseWorkspace
        onOpenItem={vi.fn()}
        onWorkspaceChanged={vi.fn()}
        service={service}
        viewApplicationService={viewApplicationService}
      />,
    )

    await screen.findByRole('heading', { name: '프로젝트' })
    await user.click(screen.getByRole('button', { name: '칸반 보기' }))

    expect(viewApplicationService.updateView).toHaveBeenCalledWith({
      ...view,
      type: 'kanban',
    })
    expect(
      await screen.findByText('칸반에 사용할 Select 속성이 없습니다.'),
    ).toBeVisible()
  })
})
