import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { DatabaseTable } from '@/components/database/database-table'
import type {
  DatabaseItem,
  DatabaseSchema,
  PropertyDefinition,
} from '@/domain/database'
import type { MarkdownValue } from '@/domain/markdown'

const schema: DatabaseSchema = {
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
    prop_tags: {
      id: 'prop_tags',
      name: '태그',
      type: 'multi_select',
      deleted: false,
      order: 2,
      options: [{ id: 'opt_urgent', name: '긴급' }],
    },
    prop_done: {
      id: 'prop_done',
      name: '완료 여부',
      type: 'checkbox',
      deleted: false,
      order: 3,
    },
    prop_score: {
      id: 'prop_score',
      name: '점수',
      type: 'number',
      deleted: false,
      order: 4,
    },
    prop_due: {
      id: 'prop_due',
      name: '마감일',
      type: 'date',
      deleted: false,
      order: 5,
    },
    prop_note: {
      id: 'prop_note',
      name: '메모',
      type: 'text',
      deleted: false,
      order: 6,
    },
  },
}

const firstItem: DatabaseItem = {
  id: 'item_first',
  path: 'Databases/프로젝트/items/item_first.md',
  title: '첫 작업',
  properties: {},
  body: '# 첫 작업\n',
  lastModified: 20,
}

const secondItem: DatabaseItem = {
  id: 'item_second',
  path: 'Databases/프로젝트/items/item_second.md',
  title: '둘째 작업',
  properties: { prop_status: 'opt_done', prop_done: true },
  body: '# 둘째 작업\n',
  lastModified: 10,
}

function renderTable(
  options: {
    items?: DatabaseItem[]
    onUpdateProperty?(
      item: DatabaseItem,
      property: PropertyDefinition,
      value: MarkdownValue | undefined,
    ): void
  } = {},
) {
  const onUpdateProperty = options.onUpdateProperty ?? vi.fn()
  render(
    <DatabaseTable
      database={schema}
      items={options.items ?? [firstItem, secondItem]}
      onDeleteItem={vi.fn()}
      onOpenItem={vi.fn()}
      onUpdateProperty={onUpdateProperty}
    />,
  )
  return { onUpdateProperty }
}

describe('DatabaseTable', () => {
  it('commits values from every property-specific cell editor', async () => {
    const user = userEvent.setup()
    const { onUpdateProperty } = renderTable({ items: [firstItem] })

    await user.selectOptions(
      screen.getByRole('combobox', { name: '첫 작업 상태' }),
      'opt_todo',
    )
    await user.click(
      screen.getByRole('checkbox', { name: '첫 작업 태그 긴급' }),
    )
    await user.click(
      screen.getByRole('checkbox', { name: '첫 작업 완료 여부' }),
    )

    const score = screen.getByRole('spinbutton', { name: '첫 작업 점수' })
    await user.type(score, '42')
    await user.tab()

    fireEvent.change(screen.getByLabelText('첫 작업 마감일'), {
      target: { value: '2026-09-30' },
    })

    const note = screen.getByRole('textbox', { name: '첫 작업 메모' })
    await user.type(note, '확인 필요')
    await user.tab()

    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_status' }),
      'opt_todo',
    )
    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_tags' }),
      ['opt_urgent'],
    )
    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_done' }),
      true,
    )
    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_score' }),
      42,
    )
    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_due' }),
      '2026-09-30',
    )
    expect(onUpdateProperty).toHaveBeenCalledWith(
      firstItem,
      expect.objectContaining({ id: 'prop_note' }),
      '확인 필요',
    )
  })

  it('sorts, filters, selects, hides, and reorders table columns', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole('button', { name: '이름' }))
    const itemLinks = screen.getAllByRole('button', { name: /Markdown 열기$/ })
    expect(itemLinks.map((button) => button.textContent)).toEqual([
      expect.stringContaining('둘째 작업'),
      expect.stringContaining('첫 작업'),
    ])

    await user.type(
      screen.getByRole('textbox', { name: '테이블 필터' }),
      '둘째',
    )
    expect(
      screen.queryByRole('button', { name: '첫 작업 Markdown 열기' }),
    ).not.toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: '테이블 필터' }))

    await user.click(screen.getByRole('checkbox', { name: '첫 작업 선택' }))
    expect(screen.getByText(/1개 선택/)).toBeInTheDocument()

    await user.click(screen.getByText('열', { exact: true }))
    await user.click(screen.getByRole('checkbox', { name: '상태 열 표시' }))
    expect(
      screen.queryByRole('columnheader', { name: /상태/ }),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: '완료 여부 열 왼쪽으로' }),
    )
    const headerText = screen
      .getAllByRole('columnheader')
      .map((header) => within(header).queryByRole('button')?.textContent ?? '')
    expect(headerText.indexOf('완료 여부')).toBeLessThan(
      headerText.indexOf('태그'),
    )
  })
})
