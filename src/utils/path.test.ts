import { describe, expect, it } from 'vitest'

import { WorkspaceError } from '@/domain/errors'
import {
  assertMutableWorkspacePath,
  joinWorkspacePath,
  normalizeWorkspacePath,
  splitWorkspacePath,
} from '@/utils/path'

describe('workspace path utilities', () => {
  it('normalizes separators and joins relative paths', () => {
    expect(normalizeWorkspacePath('Documents\\회의록.md')).toBe(
      'Documents/회의록.md',
    )
    expect(joinWorkspacePath('Documents', '회의록.md')).toBe(
      'Documents/회의록.md',
    )
    expect(splitWorkspacePath('/Documents/회의록.md/')).toEqual([
      'Documents',
      '회의록.md',
    ])
  })

  it('rejects traversal and protected application metadata', () => {
    expect(() => normalizeWorkspacePath('../secret.md')).toThrow(WorkspaceError)
    expect(() =>
      assertMutableWorkspacePath('.workspace/workspace.json'),
    ).toThrow(WorkspaceError)
    expect(assertMutableWorkspacePath('.workspace/workspace.json', true)).toBe(
      '.workspace/workspace.json',
    )
  })
})
