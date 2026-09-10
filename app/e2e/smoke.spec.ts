import { expect, test } from '@playwright/test'

test('shows the initial workspace entry screen', async ({ page }) => {
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '워크스페이스 열기' }),
  ).toBeEnabled()
  await expect(page.getByText('Phase 3 · File Tree')).toBeVisible()
})

test('opens and persists a real serializable directory handle', async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.CI) && process.platform === 'linux',
    'Linux headless Chromium exits when serializing an OPFS directory handle.',
  )

  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const originPrivateRoot = await navigator.storage.getDirectory()
      return originPrivateRoot.getDirectoryHandle('E2E Workspace', {
        create: true,
      })
    }
  })
  await page.goto('/#/')

  await page.getByRole('button', { name: '워크스페이스 열기' }).click()
  await expect(page.getByText('E2E Workspace · 연결됨')).toBeVisible()

  const initializedWorkspace = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const entries: string[] = []

    for await (const entry of workspace.values()) {
      entries.push(entry.name)
    }

    const metadata = await workspace.getDirectoryHandle('.workspace')
    const manifestFile = await (
      await metadata.getFileHandle('workspace.json')
    ).getFile()
    const manifest = JSON.parse(await manifestFile.text()) as {
      id?: string
      workspaceVersion?: number
    }

    return { entries: entries.sort(), manifest }
  })

  expect(initializedWorkspace.entries).toEqual([
    '.workspace',
    'Attachments',
    'Databases',
    'Documents',
  ])
  expect(initializedWorkspace.manifest.workspaceVersion).toBe(1)
  expect(initializedWorkspace.manifest.id).toMatch(/^ws_/)
  await expect(
    page.getByRole('tree', { name: 'E2E Workspace 파일 트리' }),
  ).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'Documents' })).toBeVisible()
  await expect(page.getByRole('treeitem', { name: 'Databases' })).toBeVisible()
  await expect(
    page.getByRole('treeitem', { name: 'Attachments' }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Documents에 새 Markdown 문서' })
    .click()
  await page.getByRole('textbox', { name: '새 문서 이름' }).fill('작업 일지')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await expect(
    page.getByRole('treeitem', { name: '작업 일지.md' }),
  ).toBeVisible()

  const createdDocumentContent = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    return (
      await (await documents.getFileHandle('작업 일지.md')).getFile()
    ).text()
  })
  expect(createdDocumentContent).toBe('')

  await page.getByRole('button', { name: 'Documents에 새 폴더' }).click()
  await page.getByRole('textbox', { name: '새 폴더 이름' }).fill('프로젝트')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await expect(page.getByRole('treeitem', { name: '프로젝트' })).toBeVisible()

  const createdDirectoryName = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    return (await documents.getDirectoryHandle('프로젝트')).name
  })
  expect(createdDirectoryName).toBe('프로젝트')

  const persistedHandleName = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('local-markdown-workspace', 1)
      request.addEventListener('success', () => resolve(request.result), {
        once: true,
      })
      request.addEventListener('error', () => reject(request.error), {
        once: true,
      })
    })
    const transaction = database.transaction('workspace-handles', 'readonly')
    const storedWorkspace = await new Promise<
      { handle?: { name?: string } } | undefined
    >((resolve, reject) => {
      const request = transaction
        .objectStore('workspace-handles')
        .get('recent-workspace')
      request.addEventListener('success', () => resolve(request.result), {
        once: true,
      })
      request.addEventListener('error', () => reject(request.error), {
        once: true,
      })
    })
    database.close()
    return storedWorkspace?.handle?.name
  })

  expect(persistedHandleName).toBe('E2E Workspace')

  await page.reload()
  await expect(page.getByText('E2E Workspace · 연결됨')).toBeVisible()
})

test('asks before initializing a folder with existing files', async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.CI) && process.platform === 'linux',
    'Linux headless Chromium exits when serializing an OPFS directory handle.',
  )

  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const originPrivateRoot = await navigator.storage.getDirectory()
      const workspace = await originPrivateRoot.getDirectoryHandle(
        'Existing E2E Workspace',
        { create: true },
      )
      const existingFile = await workspace.getFileHandle('기존문서.md', {
        create: true,
      })
      const writable = await existingFile.createWritable()
      await writable.write('# 기존 문서')
      await writable.close()
      return workspace
    }
  })
  await page.goto('/#/')

  await page.getByRole('button', { name: '워크스페이스 열기' }).click()
  await expect(
    page.getByRole('heading', { name: /이 폴더를 Workspace로/ }),
  ).toBeVisible()
  await expect(
    page.getByText('Existing E2E Workspace · 초기화 필요'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Workspace로 초기화' }).click()
  await expect(page.getByText('Existing E2E Workspace · 연결됨')).toBeVisible()
  await expect(
    page.getByRole('treeitem', { name: '기존문서.md' }),
  ).toBeVisible()
  await page.getByRole('treeitem', { name: '기존문서.md' }).click()
  await expect(page.getByText(/기존문서\.md 문서를 선택했습니다/)).toBeVisible()

  const existingContent = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace = await originPrivateRoot.getDirectoryHandle(
      'Existing E2E Workspace',
    )
    return (
      await (await workspace.getFileHandle('기존문서.md')).getFile()
    ).text()
  })
  expect(existingContent).toBe('# 기존 문서')
})
