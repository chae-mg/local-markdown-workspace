import { expect, test } from '@playwright/test'

test('shows the initial workspace entry screen', async ({ page }) => {
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '워크스페이스 열기' }),
  ).toBeEnabled()
  await expect(page.getByText('Phase 6 · Attachment')).toBeVisible()
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
  await expect(
    page.getByRole('heading', { name: '작업 일지.md' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Markdown 원문' })
    .fill('# 작업 일지\n\n첫 기록')
  await expect(page.getByText('자동 저장 대기')).toBeVisible()
  await expect(page.getByText('저장됨')).toBeVisible()

  await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    const file = await documents.getFileHandle('작업 일지.md')
    const writable = await file.createWritable()
    await writable.write('# 외부 수정')
    await writable.close()
  })
  await page
    .getByRole('textbox', { name: 'Markdown 원문' })
    .fill('# 내 두 번째 수정')
  await expect(
    page.getByRole('button', { name: '현재 편집본으로 덮어쓰기' }),
  ).toBeVisible()

  const conflictedDocumentContent = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    return (
      await (await documents.getFileHandle('작업 일지.md')).getFile()
    ).text()
  })
  expect(conflictedDocumentContent).toBe('# 외부 수정')

  await page.getByRole('button', { name: '현재 편집본으로 덮어쓰기' }).click()
  await expect(page.getByText('저장됨')).toBeVisible()

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '첨부', exact: true }).click()
  const fileChooser = await fileChooserPromise
  const pixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  await fileChooser.setFiles({
    buffer: pixelPng,
    mimeType: 'image/png',
    name: 'pixel.png',
  })
  await expect(
    page.getByRole('textbox', { name: 'Markdown 원문' }),
  ).toHaveValue(/!\[pixel\]\(\.\.\/Attachments\/img_[a-f\d]+\.png\)/)

  const sourceEditor = page.getByRole('textbox', { name: 'Markdown 원문' })
  await sourceEditor.evaluate((element) => {
    const transfer = new DataTransfer()
    transfer.items.add(
      new File([new Uint8Array([137, 80, 78, 71])], 'pasted.png', {
        type: 'image/png',
      }),
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      }),
    )
  })
  await expect(sourceEditor).toHaveValue(
    /!\[pasted\]\(\.\.\/Attachments\/img_[a-f\d]+\.png\)/,
  )

  const droppedFiles = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(
      new File(['attachment note'], 'notes.txt', { type: 'text/plain' }),
    )
    return transfer
  })
  await sourceEditor.dispatchEvent('drop', { dataTransfer: droppedFiles })
  await droppedFiles.dispose()
  await expect(sourceEditor).toHaveValue(
    /\[notes\.txt\]\(\.\.\/Attachments\/file_[a-f\d]+\.txt\)/,
  )
  await expect(page.getByText('저장됨')).toBeVisible()

  const createdDocumentContent = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    return (
      await (await documents.getFileHandle('작업 일지.md')).getFile()
    ).text()
  })
  expect(createdDocumentContent).toMatch(
    /^# 내 두 번째 수정\n\n!\[pixel\]\(\.\.\/Attachments\/img_[a-f\d]+\.png\)\n\n!\[pasted\]\(\.\.\/Attachments\/img_[a-f\d]+\.png\)\n\n\[notes\.txt\]\(\.\.\/Attachments\/file_[a-f\d]+\.txt\)$/,
  )

  const storedAttachments = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const attachments = await workspace.getDirectoryHandle('Attachments')
    const names: string[] = []
    for await (const entry of attachments.values()) {
      names.push(entry.name)
    }
    const metadata = []
    for (const name of names) {
      const file = await (await attachments.getFileHandle(name)).getFile()
      metadata.push({ name, size: file.size, type: file.type })
    }
    return metadata.sort((left, right) => left.name.localeCompare(right.name))
  })
  expect(storedAttachments).toHaveLength(3)
  expect(storedAttachments).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ size: pixelPng.byteLength, type: 'image/png' }),
      expect.objectContaining({
        name: expect.stringMatching(/^file_.*\.txt$/),
      }),
    ]),
  )

  await page.getByRole('button', { name: '에디터', exact: true }).click()
  const localImage = page.locator('.ProseMirror img').first()
  await expect(localImage).toBeVisible()
  await expect(localImage).toHaveAttribute('src', /^blob:/)
  const attachmentDownloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'notes.txt' }).click()
  const attachmentDownload = await attachmentDownloadPromise
  expect(attachmentDownload.suggestedFilename()).toBe('notes.txt')
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  const saveAfterVisualRoundTrip = page.getByRole('button', {
    name: '저장',
    exact: true,
  })
  if (await saveAfterVisualRoundTrip.isEnabled()) {
    await saveAfterVisualRoundTrip.click()
    await expect(page.getByText('저장됨')).toBeVisible()
  }
  const finalDocumentContent = await page
    .getByRole('textbox', { name: 'Markdown 원문' })
    .inputValue()

  await page.getByRole('button', { name: '작업 일지.md 작업' }).click()
  await page.getByRole('button', { name: '이름 변경', exact: true }).click()
  await page.getByRole('textbox', { name: '변경할 이름' }).fill('업무 일지')
  await page.getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(
    page.getByRole('treeitem', { name: '업무 일지.md' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '업무 일지.md 작업' }).click()
  await page.getByRole('button', { name: '휴지통으로 이동' }).click()
  await expect(page.getByText(/휴지통으로 이동할까요/)).toBeVisible()
  await page.getByRole('button', { name: '휴지통으로 이동' }).click()
  await expect(
    page.getByRole('treeitem', { name: '업무 일지.md' }),
  ).not.toBeVisible()

  const trashedDocument = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    let sourceExists = true
    try {
      await documents.getFileHandle('업무 일지.md')
    } catch {
      sourceExists = false
    }

    const metadataRoot = await workspace.getDirectoryHandle('.workspace')
    const trashRoot = await metadataRoot.getDirectoryHandle('trash')
    const trashEntries: FileSystemHandle[] = []
    for await (const entry of trashRoot.values()) {
      trashEntries.push(entry)
    }
    const trashEntry = trashEntries[0] as FileSystemDirectoryHandle
    const metadataFile = await (
      await trashEntry.getFileHandle('metadata.json')
    ).getFile()
    const metadata = JSON.parse(await metadataFile.text()) as {
      id: string
      originalPath: string
      payloadPath: string
      kind: string
      deletedAt: string
    }
    const payload = await trashEntry.getDirectoryHandle('payload')
    const payloadText = await (
      await (await payload.getFileHandle('업무 일지.md')).getFile()
    ).text()

    return { metadata, payloadText, sourceExists }
  })

  expect(trashedDocument.sourceExists).toBe(false)
  expect(trashedDocument.payloadText).toBe(finalDocumentContent)
  expect(trashedDocument.metadata).toMatchObject({
    originalPath: 'Documents/업무 일지.md',
    kind: 'file',
  })
  expect(trashedDocument.metadata.id).toMatch(/^trash_/)
  expect(trashedDocument.metadata.payloadPath).toContain(
    `${trashedDocument.metadata.id}/payload/업무 일지.md`,
  )
  expect(Date.parse(trashedDocument.metadata.deletedAt)).not.toBeNaN()

  await page.getByRole('button', { name: '업무 일지.md 복원' }).click()
  await page.getByRole('textbox', { name: '복원할 이름' }).fill('복원 일지')
  await page.getByRole('button', { name: '복원', exact: true }).click()
  await expect(
    page.getByRole('treeitem', { name: '복원 일지.md' }),
  ).toBeVisible()

  const restoredDocument = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    const content = await (
      await documents.getFileHandle('복원 일지.md')
    ).getFile()
    const metadataRoot = await workspace.getDirectoryHandle('.workspace')
    const trashRoot = await metadataRoot.getDirectoryHandle('trash')
    const trashEntries: string[] = []
    for await (const entry of trashRoot.values()) {
      trashEntries.push(entry.name)
    }

    return { content: await content.text(), trashEntries }
  })

  expect(restoredDocument.content).toBe(finalDocumentContent)
  expect(restoredDocument.trashEntries).toEqual([])

  await page
    .getByRole('button', { name: 'Documents에 새 Markdown 문서' })
    .click()
  await page
    .getByRole('textbox', { name: '새 문서 이름' })
    .fill('영구 삭제 대상')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await page.getByRole('button', { name: '영구 삭제 대상.md 작업' }).click()
  await page.getByRole('button', { name: '휴지통으로 이동' }).click()
  await page.getByRole('button', { name: '휴지통으로 이동' }).click()
  await page.getByRole('button', { name: '휴지통 비우기' }).click()
  await expect(
    page.getByText('휴지통의 1개 항목을 영구 삭제할까요?'),
  ).toBeVisible()
  await page.getByRole('button', { name: '영구 삭제', exact: true }).click()
  await expect(page.getByText('휴지통이 비어 있습니다.').first()).toBeVisible()

  const emptyTrashEntries = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const metadataRoot = await workspace.getDirectoryHandle('.workspace')
    const trashRoot = await metadataRoot.getDirectoryHandle('trash')
    const entries: string[] = []
    for await (const entry of trashRoot.values()) {
      entries.push(entry.name)
    }
    return entries
  })
  expect(emptyTrashEntries).toEqual([])

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

  await page
    .getByRole('button', {
      name: 'Documents/프로젝트에 새 Markdown 문서',
    })
    .click()
  await page.getByRole('textbox', { name: '새 문서 이름' }).fill('이동 테스트')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  const dragData = await page.evaluateHandle(() => new DataTransfer())
  const draggedEntry = page.getByRole('treeitem', { name: '이동 테스트.md' })
  const destinationDirectory = page.getByRole('treeitem', {
    name: 'Documents',
  })
  await draggedEntry.dispatchEvent('dragstart', { dataTransfer: dragData })
  await destinationDirectory.dispatchEvent('dragover', {
    dataTransfer: dragData,
  })
  await destinationDirectory.dispatchEvent('drop', { dataTransfer: dragData })
  await dragData.dispose()
  await expect(page.getByText('Documents/이동 테스트.md')).toBeVisible()

  const draggedDocumentLocation = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    const project = await documents.getDirectoryHandle('프로젝트')
    let oldLocationExists = true
    try {
      await project.getFileHandle('이동 테스트.md')
    } catch {
      oldLocationExists = false
    }

    const file = await (
      await documents.getFileHandle('이동 테스트.md')
    ).getFile()
    return { content: await file.text(), oldLocationExists }
  })
  expect(draggedDocumentLocation.content).toBe('')
  expect(draggedDocumentLocation.oldLocationExists).toBe(false)

  await page.getByRole('button', { name: '이동 테스트.md 작업' }).click()
  await page.getByRole('button', { name: '폴더로 이동' }).click()
  await page
    .getByRole('combobox', { name: '이동할 폴더' })
    .selectOption('Documents/프로젝트')
  await page.getByRole('button', { name: '이동', exact: true }).click()
  await expect(
    page.getByText('Documents/프로젝트/이동 테스트.md'),
  ).toBeVisible()

  const menuMovedDocumentLocation = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    const project = await documents.getDirectoryHandle('프로젝트')
    let oldLocationExists = true
    try {
      await documents.getFileHandle('이동 테스트.md')
    } catch {
      oldLocationExists = false
    }

    const file = await (await project.getFileHandle('이동 테스트.md')).getFile()
    return { content: await file.text(), oldLocationExists }
  })
  expect(menuMovedDocumentLocation.content).toBe('')
  expect(menuMovedDocumentLocation.oldLocationExists).toBe(false)

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
  await expect(page.getByRole('heading', { name: '기존문서.md' })).toBeVisible()
  await expect(page.getByLabel('시각적 Markdown 편집기')).toBeVisible()

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
