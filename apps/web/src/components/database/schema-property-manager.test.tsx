import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'

import { SchemaPropertyManager } from '@/components/database/schema-property-manager'
import type { DatabaseSchema } from '@/domain/database'
import type { SchemaApplicationService } from '@/services/schema.service'

const emptySchema: DatabaseSchema = {
  schemaVersion: 1,
  id: 'db_123456',
  name: '프로젝트',
  folder: 'Databases/프로젝트/items',
  properties: {},
}

function createService() {
  const selectSchema: DatabaseSchema = {
    ...emptySchema,
    properties: {
      prop_status: {
        id: 'prop_status',
        name: '상태',
        type: 'select',
        deleted: false,
        order: 1,
        options: [],
      },
    },
  }
  const optionSchema: DatabaseSchema = {
    ...selectSchema,
    properties: {
      prop_status: {
        ...selectSchema.properties.prop_status,
        type: 'select',
        options: [{ id: 'opt_todo', name: '예정' }],
      },
    },
  }
  return {
    addOption: vi.fn(async () => optionSchema),
    changePropertyType: vi.fn(async () => selectSchema),
    createProperty: vi.fn(async () => selectSchema),
    moveProperty: vi.fn(async () => selectSchema),
    renameOption: vi.fn(async () => optionSchema),
    renameProperty: vi.fn(async () => selectSchema),
    restoreOption: vi.fn(async () => optionSchema),
    restoreProperty: vi.fn(async () => selectSchema),
    softDeleteOption: vi.fn(async () => optionSchema),
    softDeleteProperty: vi.fn(async () => selectSchema),
  } satisfies SchemaApplicationService
}

describe('SchemaPropertyManager', () => {
  it('creates a typed Property and adds a stable Select Option', async () => {
    const user = userEvent.setup()
    const service = createService()

    function Harness() {
      const [schema, setSchema] = useState(emptySchema)
      return (
        <SchemaPropertyManager
          database={schema}
          onChange={setSchema}
          service={service}
        />
      )
    }

    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '속성 추가' }))
    await user.type(
      screen.getByRole('textbox', { name: '새 속성 이름' }),
      '상태',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '새 속성 타입' }),
      'select',
    )
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(service.createProperty).toHaveBeenCalledWith(
      'db_123456',
      '상태',
      'select',
    )
    await user.click(
      await screen.findByRole('button', { name: '상태 Option 펼치기' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: '상태 새 Option 이름' }),
      '예정',
    )
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(service.addOption).toHaveBeenCalledWith(
      'db_123456',
      'prop_status',
      '예정',
    )
    expect(await screen.findByText('예정')).toBeInTheDocument()
  })
})
