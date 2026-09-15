import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { KanbanBoard } from '@/components/database/kanban-board'
import {
  groupKanbanItems,
  kanbanColumnId,
  optionIdFromKanbanColumn,
} from '@/components/database/kanban-model'
import type {
  DatabaseItem,
  DatabaseSchema,
  SelectPropertyDefinition,
} from '@/domain/database'

const statusProperty: SelectPropertyDefinition = {
  id: 'prop_status',
  name: '상태',
  type: 'select',
  deleted: false,
  order: 1,
  options: [
    { id: 'opt_todo', name: '예정' },
    { id: 'opt_doing', name: '진행 중' },
    { id: 'opt_old', name: '예전 상태', deleted: true },
  ],
}

const schema: DatabaseSchema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {
    prop_status: statusProperty,
    prop_priority: {
      id: 'prop_priority',
      name: '우선순위',
      type: 'select',
      deleted: false,
      order: 2,
      options: [{ id: 'opt_high', name: '높음' }],
    },
  },
}

const items: DatabaseItem[] = [
  {
    id: 'item_todo',
    path: 'Databases/프로젝트/items/item_todo.md',
    title: '할 작업',
    properties: { prop_status: 'opt_todo' },
    body: '# 할 작업\n',
    lastModified: 30,
    source: '# 할 작업\n',
  },
  {
    id: 'item_empty',
    path: 'Databases/프로젝트/items/item_empty.md',
    title: '상태 없는 작업',
    properties: {},
    body: '# 상태 없는 작업\n',
    lastModified: 20,
    source: '# 상태 없는 작업\n',
  },
  {
    id: 'item_deleted',
    path: 'Databases/프로젝트/items/item_deleted.md',
    title: '삭제 옵션 작업',
    properties: { prop_status: 'opt_old' },
    body: '# 삭제 옵션 작업\n',
    lastModified: 10,
    source: '# 삭제 옵션 작업\n',
  },
]

describe('KanbanBoard', () => {
  it('groups active options and sends missing or deleted options to unassigned', () => {
    const groups = groupKanbanItems(items, statusProperty)

    expect(groups.get(kanbanColumnId('opt_todo'))).toEqual([items[0]])
    expect(groups.get(kanbanColumnId('opt_doing'))).toEqual([])
    expect(groups.get(kanbanColumnId())).toEqual([items[1], items[2]])
    expect(groups.has(kanbanColumnId('opt_old'))).toBe(false)
    expect(optionIdFromKanbanColumn(kanbanColumnId('opt_doing'))).toBe(
      'opt_doing',
    )
    expect(optionIdFromKanbanColumn(kanbanColumnId())).toBeUndefined()
    expect(optionIdFromKanbanColumn('unrelated')).toBeNull()
  })

  it('renders option columns, switches group property, and opens Markdown', async () => {
    const user = userEvent.setup()
    const onOpenItem = vi.fn()

    render(
      <KanbanBoard
        database={schema}
        items={items}
        onMoveItem={vi.fn()}
        onOpenItem={onOpenItem}
      />,
    )

    const todoColumn = screen.getByRole('region', { name: '예정 칸반 열' })
    const unassignedColumn = screen.getByRole('region', {
      name: '미지정 칸반 열',
    })
    expect(within(todoColumn).getByText('할 작업')).toBeInTheDocument()
    expect(within(unassignedColumn).getByText('상태 없는 작업')).toBeVisible()
    expect(within(unassignedColumn).getByText('삭제 옵션 작업')).toBeVisible()
    expect(
      screen.queryByRole('region', { name: '예전 상태 칸반 열' }),
    ).not.toBeInTheDocument()

    await user.click(
      within(todoColumn).getByRole('button', { name: '할 작업 Markdown 열기' }),
    )
    expect(onOpenItem).toHaveBeenCalledWith(items[0]?.path)

    await user.selectOptions(
      screen.getByRole('combobox', { name: '칸반 그룹 속성' }),
      'prop_priority',
    )
    expect(screen.getByRole('region', { name: '높음 칸반 열' })).toBeVisible()
    expect(
      screen.queryByRole('region', { name: '예정 칸반 열' }),
    ).not.toBeInTheDocument()
  })

  it('explains how to enable Kanban when no Select property exists', () => {
    render(
      <KanbanBoard
        database={{ ...schema, properties: {} }}
        items={items}
        onMoveItem={vi.fn()}
        onOpenItem={vi.fn()}
      />,
    )

    expect(
      screen.getByText('칸반에 사용할 Select 속성이 없습니다.'),
    ).toBeVisible()
  })
})
