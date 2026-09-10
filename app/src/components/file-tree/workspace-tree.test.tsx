import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { WorkspaceTree } from '@/components/file-tree/workspace-tree'
import type { WorkspaceEntry } from '@/domain/file-system'

const entries: WorkspaceEntry[] = [
  { kind: 'directory', name: 'Documents', path: 'Documents' },
  {
    kind: 'file',
    name: '회의록.md',
    path: 'Documents/회의록.md',
  },
  { kind: 'directory', name: 'Projects', path: 'Projects' },
  {
    kind: 'file',
    name: '기획.md',
    path: 'Projects/기획.md',
  },
]

function renderTree(
  overrides: Partial<React.ComponentProps<typeof WorkspaceTree>> = {},
) {
  const props: React.ComponentProps<typeof WorkspaceTree> = {
    entries,
    errorMessage: null,
    isLoading: false,
    isMutating: false,
    mutationErrorMessage: null,
    onClearMutationError: vi.fn(),
    onCreateFolder: vi.fn(async () => true),
    onCreateMarkdownFile: vi.fn(async () => true),
    onDirectorySelect: vi.fn(),
    onRefresh: vi.fn(),
    onSelect: vi.fn(),
    selectedDirectoryPath: 'Documents',
    selectedPath: null,
    workspaceName: '업무 문서',
    ...overrides,
  }

  render(<WorkspaceTree {...props} />)
  return props
}

describe('WorkspaceTree', () => {
  it('shows default folders and toggles nested entries', async () => {
    const user = userEvent.setup()
    renderTree()

    expect(
      screen.getByRole('tree', { name: '업무 문서 파일 트리' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: '회의록.md' })).toBeVisible()
    expect(
      screen.queryByRole('treeitem', { name: '기획.md' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('treeitem', { name: 'Projects' }))

    expect(screen.getByRole('treeitem', { name: '기획.md' })).toBeVisible()
  })

  it('selects Markdown files without treating folders as files', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderTree({ onSelect })

    await user.click(screen.getByRole('treeitem', { name: 'Documents' }))
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('treeitem', { name: 'Documents' }))
    await user.click(screen.getByRole('treeitem', { name: '회의록.md' }))
    expect(onSelect).toHaveBeenCalledWith('Documents/회의록.md')
  })

  it('refreshes the tree and communicates its empty state', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    renderTree({ entries: [], onRefresh })

    expect(
      screen.getByText('아직 Markdown 문서가 없습니다.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '파일 트리 새로고침' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('shows scan errors without hiding the last known entries', () => {
    renderTree({ errorMessage: '폴더를 읽을 수 없습니다.' })

    expect(screen.getByText('폴더를 읽을 수 없습니다.')).toBeInTheDocument()
    expect(screen.getByRole('treeitem', { name: 'Documents' })).toBeVisible()
  })

  it('creates a Markdown document in the selected folder', async () => {
    const user = userEvent.setup()
    const onCreateMarkdownFile = vi.fn(async () => true)
    renderTree({ onCreateMarkdownFile })

    await user.click(
      screen.getByRole('button', {
        name: 'Documents에 새 Markdown 문서',
      }),
    )
    await user.type(
      screen.getByRole('textbox', { name: '새 문서 이름' }),
      '일지',
    )
    await user.click(screen.getByRole('button', { name: '생성' }))

    expect(onCreateMarkdownFile).toHaveBeenCalledWith('Documents', '일지')
    expect(
      screen.queryByRole('textbox', { name: '새 문서 이름' }),
    ).not.toBeInTheDocument()
  })

  it('selects a folder as the next creation target', async () => {
    const user = userEvent.setup()
    const onDirectorySelect = vi.fn()
    renderTree({ onDirectorySelect })

    await user.click(screen.getByRole('treeitem', { name: 'Projects' }))

    expect(onDirectorySelect).toHaveBeenCalledWith('Projects')
  })
})
