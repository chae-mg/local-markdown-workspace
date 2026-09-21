import { describe, expect, it } from 'vitest'

import { parsePropertyDefinitions } from '@/services/schema-validation'

describe('parsePropertyDefinitions', () => {
  it('parses every MVP Property type', () => {
    expect(
      parsePropertyDefinitions({
        prop_text: {
          id: 'prop_text',
          name: '설명',
          type: 'text',
          deleted: false,
          order: 1,
        },
        prop_number: {
          id: 'prop_number',
          name: '점수',
          type: 'number',
          deleted: false,
          order: 2,
        },
        prop_select: {
          id: 'prop_select',
          name: '상태',
          type: 'select',
          deleted: false,
          order: 3,
          options: [{ id: 'opt_todo', name: '예정' }],
        },
        prop_multi: {
          id: 'prop_multi',
          name: '태그',
          type: 'multi_select',
          deleted: false,
          order: 4,
          options: [{ id: 'opt_work', name: '업무', deleted: true }],
        },
        prop_check: {
          id: 'prop_check',
          name: '완료',
          type: 'checkbox',
          deleted: false,
          order: 5,
        },
        prop_date: {
          id: 'prop_date',
          name: '마감일',
          type: 'date',
          deleted: false,
          order: 6,
        },
      }),
    ).toMatchObject({
      prop_select: { type: 'select', options: [{ id: 'opt_todo' }] },
      prop_multi: {
        type: 'multi_select',
        options: [{ id: 'opt_work', deleted: true }],
      },
    })
  })

  it('rejects mismatched IDs and duplicate order values', () => {
    expect(() =>
      parsePropertyDefinitions({
        prop_one: {
          id: 'prop_other',
          name: '하나',
          type: 'text',
          deleted: false,
          order: 1,
        },
      }),
    ).toThrow(/형식이 올바르지 않습니다/)

    expect(() =>
      parsePropertyDefinitions({
        prop_one: {
          id: 'prop_one',
          name: '하나',
          type: 'text',
          deleted: false,
          order: 1,
        },
        prop_two: {
          id: 'prop_two',
          name: '둘',
          type: 'date',
          deleted: false,
          order: 1,
        },
      }),
    ).toThrow(/중복된 Property 순서/)
  })
})
