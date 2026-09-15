import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { DatabaseViewToolbar } from '@/components/database/database-view-toolbar'
import type { DatabaseSchema } from '@/domain/database'
import type { DatabaseView } from '@/domain/database-view'

const database: DatabaseSchema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {
    prop_status: {
      id: 'prop_status',
      name: '상태',
      type: 'select',
      deleted: false,
      order: 1,
      options: [
        { id: 'opt_todo', name: '예정' },
        { id: 'opt_done', name: '완료' },
      ],
    },
  },
}

const tableView: DatabaseView = {
  version: 1,
  id: 'view_table',
  databaseId: database.id,
  name: '전체 항목',
  type: 'table',
  filters: [],
  sorts: [],
  hiddenProperties: [],
  propertyOrder: ['prop_status'],
}

describe('DatabaseViewToolbar', () => {
  it('creates and selects independent views', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn()
    const onSelect = vi.fn()
    const kanbanView: DatabaseView = {
      ...tableView,
      id: 'view_kanban',
      name: '상태별',
      type: 'kanban',
    }

    render(
      <DatabaseViewToolbar
        database={database}
        onCreate={onCreate}
        onDelete={vi.fn()}
        onSelect={onSelect}
        onUpdate={vi.fn()}
        selectedView={tableView}
        views={[tableView, kanbanView]}
      />,
    )

    await user.click(screen.getByRole('button', { name: '상태별' }))
    expect(onSelect).toHaveBeenCalledWith('view_kanban')

    await user.click(screen.getByRole('button', { name: '새 View 추가' }))
    await user.type(
      screen.getByRole('textbox', { name: '새 View 이름' }),
      '완료 업무',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '새 View 타입' }),
      'kanban',
    )
    await user.click(screen.getByRole('button', { name: '생성' }))
    expect(onCreate).toHaveBeenCalledWith('완료 업무', 'kanban')
  })

  it('updates the name, filters, and sorts of the selected view', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()

    render(
      <DatabaseViewToolbar
        database={database}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onSelect={vi.fn()}
        onUpdate={onUpdate}
        selectedView={tableView}
        views={[tableView]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'View 설정' }))
    const rename = screen.getByRole('textbox', { name: 'View 이름 변경' })
    await user.clear(rename)
    await user.type(rename, '중요 업무')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(onUpdate).toHaveBeenCalledWith(tableView, { name: '중요 업무' })

    await user.selectOptions(
      screen.getByRole('combobox', { name: '필터 속성' }),
      'prop_status',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '필터 값' }),
      'opt_todo',
    )
    await user.click(screen.getAllByRole('button', { name: '추가' })[0]!)
    expect(onUpdate).toHaveBeenCalledWith(tableView, {
      filters: [
        {
          propertyId: 'prop_status',
          operator: 'equals',
          value: 'opt_todo',
        },
      ],
    })

    await user.selectOptions(
      screen.getByRole('combobox', { name: '정렬 속성' }),
      'prop_status',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '정렬 방향' }),
      'desc',
    )
    await user.click(screen.getAllByRole('button', { name: '추가' })[1]!)
    expect(onUpdate).toHaveBeenCalledWith(tableView, {
      sorts: [{ propertyId: 'prop_status', direction: 'desc' }],
    })
  })
})
