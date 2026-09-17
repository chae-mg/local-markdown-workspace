import { expect, test } from '@playwright/test'

test('shows the initial workspace entry screen', async ({ page }) => {
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '워크스페이스 열기' }),
  ).toBeEnabled()
  await expect(
    page.getByRole('complementary', { name: '워크스페이스 사이드바' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '사이드바 전환' }),
  ).toBeVisible()
})

test('opens the workspace sidebar as a drawer on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/#/')

  const sidebar = page.getByRole('complementary', {
    name: '워크스페이스 사이드바',
  })
  const hiddenPosition = await sidebar.boundingBox()
  expect(hiddenPosition?.x).toBeLessThan(0)

  await page.getByRole('button', { name: '사이드바 전환' }).click()

  await expect(sidebar).toBeInViewport()
  await expect(sidebar).toHaveCSS('width', '252px')
})

test('applies and restores theme and accent preferences', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/#/')
  await page.getByRole('button', { name: '설정', exact: true }).click()

  const settingsDialog = page.getByRole('dialog', {
    name: '나에게 맞게 조정하기',
  })
  await settingsDialog.getByRole('radio', { name: '다크' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(
    page.getByRole('complementary', { name: '워크스페이스 사이드바' }),
  ).toHaveCSS('background-color', 'rgb(37, 37, 37)')

  await settingsDialog.getByRole('radio', { name: '주황' }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--ui-accent'),
      ),
    )
    .toBe('#E58A32')

  await settingsDialog.getByRole('radio', { name: '커스텀' }).click()
  await settingsDialog.getByLabel('HEX').fill('#12abef')
  await settingsDialog.getByRole('button', { name: '컬러 저장' }).click()
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--ui-accent'),
      ),
    )
    .toBe('#12ABEF')

  await settingsDialog.getByRole('button', { name: '완료' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--ui-accent'),
    ),
  ).toBe('#12ABEF')

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await settingsDialog.getByRole('radio', { name: '시스템' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('uses a real directory handle for the complete workspace flow', async ({
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

  await page.getByRole('button', { name: '데이터베이스' }).click()
  await expect(
    page.getByRole('heading', { name: '데이터베이스' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '새 데이터베이스' }).click()
  await page
    .getByRole('textbox', { name: '새 데이터베이스 이름' })
    .fill('업무 보드')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await expect(page.getByRole('heading', { name: '업무 보드' })).toBeVisible()

  await page.getByRole('button', { name: '속성', exact: true }).click()
  await expect(page.getByRole('heading', { name: '속성 관리' })).toBeVisible()
  await page.getByRole('button', { name: '속성 추가' }).click()
  await page.getByRole('textbox', { name: '새 속성 이름' }).fill('상태')
  await page
    .getByRole('combobox', { name: '새 속성 타입' })
    .selectOption('select')
  await page.getByRole('textbox', { name: '새 속성 이름' }).press('Enter')

  await page.getByRole('button', { name: '상태 Option 펼치기' }).click()
  await page.getByRole('textbox', { name: '상태 새 Option 이름' }).fill('예정')
  await page
    .getByRole('textbox', { name: '상태 새 Option 이름' })
    .press('Enter')
  await expect(page.getByText('예정', { exact: true })).toBeVisible()
  await page
    .getByRole('textbox', { name: '상태 새 Option 이름' })
    .fill('진행 중')
  await page
    .getByRole('textbox', { name: '상태 새 Option 이름' })
    .press('Enter')
  await expect(page.getByText('진행 중', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '속성 추가' }).click()
  await page.getByRole('textbox', { name: '새 속성 이름' }).fill('완료')
  await page
    .getByRole('combobox', { name: '새 속성 타입' })
    .selectOption('checkbox')
  await page.getByRole('textbox', { name: '새 속성 이름' }).press('Enter')

  await page.getByRole('button', { name: '완료 이름 변경' }).click()
  await page.getByRole('textbox', { name: '새 이름' }).fill('완료 여부')
  await page.getByRole('button', { name: '이름 변경 저장' }).click()
  await page.getByRole('button', { name: '완료 여부 위로 이동' }).click()
  await page.getByRole('button', { name: '완료 여부 속성 삭제' }).click()
  await page.getByRole('button', { name: '삭제된 속성 1개' }).click()
  await page.getByRole('button', { name: '완료 여부 속성 복원' }).click()
  await expect(
    page.getByRole('combobox', { name: '완료 여부 타입' }),
  ).toBeEnabled()
  await page.getByRole('button', { name: '속성', exact: true }).click()

  await page.getByRole('button', { name: '새 항목' }).click()
  await page
    .getByRole('textbox', { name: '새 항목 제목' })
    .fill('대시보드 개선')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await expect(page.getByText('대시보드 개선')).toBeVisible()

  const statusCell = page.getByRole('combobox', {
    name: '대시보드 개선 상태',
  })
  await statusCell.selectOption({ label: '예정' })
  await expect(statusCell.locator('option:checked')).toHaveText('예정')
  const completedCell = page.getByRole('checkbox', {
    name: '대시보드 개선 완료 여부',
  })
  await completedCell.check()
  await expect(completedCell).toBeChecked()

  await page.getByRole('button', { name: '이름', exact: true }).click()
  await page.getByRole('textbox', { name: '테이블 필터' }).fill('없는 항목')
  await expect(
    page.getByText('검색 조건에 맞는 항목이 없습니다.'),
  ).toBeVisible()
  await page.getByRole('textbox', { name: '테이블 필터' }).clear()
  await page.getByRole('checkbox', { name: '대시보드 개선 선택' }).check()
  await expect(page.getByText(/1개 선택/)).toBeVisible()
  await page.getByText('열', { exact: true }).click()
  await page.getByRole('checkbox', { name: '상태 열 표시' }).uncheck()
  await expect(
    page.getByRole('columnheader', { name: /상태/ }),
  ).not.toBeVisible()
  await page.getByRole('checkbox', { name: '상태 열 표시' }).check()

  await page.getByRole('button', { name: 'View 설정' }).click()
  const viewNameInput = page.getByRole('textbox', { name: 'View 이름 변경' })
  await viewNameInput.fill('기본 테이블')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '기본 테이블', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('combobox', { name: '필터 속성' })
    .selectOption({ label: '완료 여부' })
  await page.getByRole('button', { name: '추가', exact: true }).first().click()
  await expect(page.getByText(/완료 여부 체크됨/)).toBeVisible()
  await page.getByRole('combobox', { name: '정렬 방향' }).selectOption('desc')
  await page.getByRole('button', { name: '추가', exact: true }).last().click()
  await expect(page.getByText(/이름 · 내림차순/)).toBeVisible()
  await page.getByRole('button', { name: 'View 설정' }).click()

  await page.getByRole('button', { name: '새 View 추가' }).click()
  await page.getByRole('textbox', { name: '새 View 이름' }).fill('상태 보드')
  await page
    .getByRole('combobox', { name: '새 View 타입' })
    .selectOption('kanban')
  await page.getByRole('button', { name: '생성', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '상태 보드', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const groupBySelect = page.getByRole('combobox', {
    name: '칸반 그룹 속성',
  })
  await expect(groupBySelect.locator('option:checked')).toHaveText('상태')
  const cardHandle = page.getByRole('button', {
    name: '대시보드 개선 카드 이동',
  })
  const doingColumn = page.getByRole('region', { name: '진행 중 칸반 열' })
  const startBox = await cardHandle.boundingBox()
  const targetBox = await doingColumn.boundingBox()
  if (!startBox || !targetBox) {
    throw new Error('칸반 카드 또는 대상 열의 위치를 확인할 수 없습니다.')
  }
  await page.mouse.move(
    startBox.x + startBox.width / 2,
    startBox.y + startBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  )
  await page.mouse.up()
  await expect(doingColumn.getByText('대시보드 개선')).toBeVisible()

  await page.getByRole('button', { name: '기본 테이블', exact: true }).click()
  await expect(
    page
      .getByRole('combobox', { name: '대시보드 개선 상태' })
      .locator('option:checked'),
  ).toHaveText('진행 중')

  await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const items = await (
      await (
        await workspace.getDirectoryHandle('Databases')
      ).getDirectoryHandle('업무 보드')
    ).getDirectoryHandle('items')
    for await (const entry of items.values()) {
      if (entry.kind === 'file') {
        const handle = await items.getFileHandle(entry.name)
        const source = await (await handle.getFile()).text()
        const writable = await handle.createWritable()
        await writable.write(`${source}\n외부 메모 1\n`)
        await writable.close()
      }
    }
  })
  await page.getByRole('checkbox', { name: '대시보드 개선 완료 여부' }).click()
  await expect(page.getByText(/항목이 외부에서 변경되었습니다/)).toBeVisible()
  const databaseSourceDuringConflict = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const items = await (
      await (
        await workspace.getDirectoryHandle('Databases')
      ).getDirectoryHandle('업무 보드')
    ).getDirectoryHandle('items')
    for await (const entry of items.values()) {
      if (entry.kind === 'file') {
        return (await (await items.getFileHandle(entry.name)).getFile()).text()
      }
    }
    return ''
  })
  expect(databaseSourceDuringConflict).toContain('외부 메모 1')
  expect(databaseSourceDuringConflict).toContain('prop_')
  await page.getByRole('button', { name: '디스크 버전 다시 불러오기' }).click()
  await expect(
    page.getByRole('checkbox', { name: '대시보드 개선 완료 여부' }),
  ).toBeChecked()

  await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const items = await (
      await (
        await workspace.getDirectoryHandle('Databases')
      ).getDirectoryHandle('업무 보드')
    ).getDirectoryHandle('items')
    for await (const entry of items.values()) {
      if (entry.kind === 'file') {
        const handle = await items.getFileHandle(entry.name)
        const source = await (await handle.getFile()).text()
        const writable = await handle.createWritable()
        await writable.write(`${source}\n외부 메모 2\n`)
        await writable.close()
      }
    }
  })
  await page
    .getByRole('combobox', { name: '대시보드 개선 상태' })
    .evaluate((select) => {
      const element = select as HTMLSelectElement
      const option = [...element.options].find(
        (candidate) => candidate.text === '예정',
      )
      if (!option) {
        throw new Error('예정 Option을 찾을 수 없습니다.')
      }
      element.value = option.value
      element.dispatchEvent(new Event('change', { bubbles: true }))
    })
  await expect(page.getByText(/항목이 외부에서 변경되었습니다/)).toBeVisible()
  await page.getByRole('button', { name: '현재 변경 적용' }).click()
  await expect(
    page
      .getByRole('combobox', { name: '대시보드 개선 상태' })
      .locator('option:checked'),
  ).toHaveText('예정')

  const databaseFiles = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const metadata = await workspace.getDirectoryHandle('.workspace')
    const schemas = await metadata.getDirectoryHandle('schemas')
    const backupDirectory = await metadata.getDirectoryHandle('backup')
    const viewsDirectory = await metadata.getDirectoryHandle('views')
    const backupEntries: string[] = []
    for await (const entry of backupDirectory.values()) {
      backupEntries.push(entry.name)
    }
    const schemaFiles: string[] = []
    for await (const entry of schemas.values()) {
      schemaFiles.push(entry.name)
    }
    const schemaFile = await (
      await schemas.getFileHandle(schemaFiles[0] ?? '')
    ).getFile()
    const schema = JSON.parse(await schemaFile.text()) as {
      folder?: string
      id?: string
      name?: string
      properties?: Record<
        string,
        {
          deleted?: boolean
          id?: string
          name?: string
          options?: Array<{ deleted?: boolean; id?: string; name?: string }>
          order?: number
          type?: string
        }
      >
    }
    const viewFiles: string[] = []
    const views: Array<{
      databaseId?: string
      filters?: Array<{
        operator?: string
        propertyId?: string
        value?: unknown
      }>
      groupBy?: string
      hiddenProperties?: string[]
      id?: string
      name?: string
      propertyOrder?: string[]
      sorts?: Array<{ direction?: string; propertyId?: string }>
      type?: string
      version?: number
    }> = []
    for await (const entry of viewsDirectory.values()) {
      viewFiles.push(entry.name)
      const file = await (
        await viewsDirectory.getFileHandle(entry.name)
      ).getFile()
      views.push(JSON.parse(await file.text()))
    }
    const databases = await workspace.getDirectoryHandle('Databases')
    const board = await databases.getDirectoryHandle('업무 보드')
    const items = await board.getDirectoryHandle('items')
    const itemFiles: string[] = []
    for await (const entry of items.values()) {
      itemFiles.push(entry.name)
    }
    const itemSource = await (
      await items.getFileHandle(itemFiles[0] ?? '')
    ).getFile()
    return {
      itemFiles,
      itemSource: await itemSource.text(),
      backupEntries,
      schema,
      schemaFiles,
      viewFiles,
      views,
    }
  })

  expect(databaseFiles.schemaFiles).toHaveLength(1)
  expect(databaseFiles.backupEntries.length).toBeGreaterThan(0)
  expect(databaseFiles.backupEntries).toEqual(
    expect.arrayContaining([expect.stringMatching(/^backup_[a-f0-9]+$/)]),
  )
  expect(databaseFiles.schemaFiles[0]).toMatch(/^db_[a-f0-9]+\.json$/)
  expect(databaseFiles.schema).toMatchObject({
    folder: 'Databases/업무 보드/items',
    name: '업무 보드',
  })
  expect(databaseFiles.schema.id).toMatch(/^db_[a-f0-9]+$/)
  const storedProperties = Object.values(databaseFiles.schema.properties ?? {})
  expect(storedProperties).toHaveLength(2)
  expect(storedProperties).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        deleted: false,
        name: '상태',
        order: 2,
        type: 'select',
        options: [
          expect.objectContaining({
            id: expect.stringMatching(/^opt_/),
            name: '예정',
          }),
          expect.objectContaining({
            id: expect.stringMatching(/^opt_/),
            name: '진행 중',
          }),
        ],
      }),
      expect.objectContaining({
        deleted: false,
        name: '완료 여부',
        order: 1,
        type: 'checkbox',
      }),
    ]),
  )
  expect(databaseFiles.itemFiles).toHaveLength(1)
  expect(databaseFiles.itemFiles[0]).toMatch(/^item_[a-f0-9]+\.md$/)
  const storedStatus = storedProperties.find(
    (property) => property.name === '상태',
  )
  const storedCompleted = storedProperties.find(
    (property) => property.name === '완료 여부',
  )
  const storedTodoOption = storedStatus?.options?.find(
    (option) => option.name === '예정',
  )
  expect(databaseFiles.itemSource).toContain(
    `${storedStatus?.id}: ${storedTodoOption?.id}`,
  )
  expect(databaseFiles.itemSource).toContain(`${storedCompleted?.id}: true`)
  expect(databaseFiles.itemSource).toContain('\n---\n\n# 대시보드 개선\n')
  expect(databaseFiles.itemSource).toContain('외부 메모 1')
  expect(databaseFiles.itemSource).toContain('외부 메모 2')

  expect(databaseFiles.viewFiles).toHaveLength(2)
  expect(databaseFiles.viewFiles).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^view_[a-f0-9]+\.json$/),
      expect.stringMatching(/^view_[a-f0-9]+\.json$/),
    ]),
  )
  const storedTableView = databaseFiles.views.find(
    (view) => view.name === '기본 테이블',
  )
  const storedKanbanView = databaseFiles.views.find(
    (view) => view.name === '상태 보드',
  )
  expect(storedTableView).toMatchObject({
    databaseId: databaseFiles.schema.id,
    filters: [
      {
        operator: 'is_true',
        propertyId: storedCompleted?.id,
      },
    ],
    hiddenProperties: [],
    name: '기본 테이블',
    sorts: [{ direction: 'desc', propertyId: 'title' }],
    type: 'table',
    version: 1,
  })
  expect(storedTableView?.propertyOrder).toEqual([
    storedCompleted?.id,
    storedStatus?.id,
  ])
  expect(storedKanbanView).toMatchObject({
    databaseId: databaseFiles.schema.id,
    filters: [],
    groupBy: storedStatus?.id,
    hiddenProperties: [],
    name: '상태 보드',
    sorts: [],
    type: 'kanban',
    version: 1,
  })

  await page
    .getByRole('button', { name: '대시보드 개선 Markdown 열기' })
    .click()
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Markdown 원문' }),
  ).toHaveValue(databaseFiles.itemSource)

  await page.getByRole('treeitem', { name: 'Documents' }).click()
  const settingsDialog = page.getByRole('dialog', {
    name: '나에게 맞게 조정하기',
  })
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await settingsDialog.getByRole('radio', { name: '명조' }).click()
  await settingsDialog.getByRole('radio', { name: 'Markdown' }).click()
  await settingsDialog.getByRole('button', { name: '완료' }).click()

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
  await expect(
    page.getByRole('button', { name: 'Markdown', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  const sourceEditor = page.getByRole('textbox', { name: 'Markdown 원문' })
  await expect(sourceEditor).toBeVisible()
  expect(
    await sourceEditor.evaluate(
      (element) => window.getComputedStyle(element).fontFamily,
    ),
  ).toContain('Georgia')

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await settingsDialog.getByRole('radio', { name: '에디터' }).click()
  await settingsDialog
    .getByRole('checkbox', { name: '자동 저장 사용' })
    .uncheck()
  await settingsDialog.getByRole('button', { name: '완료' }).click()
  await expect(
    page.getByRole('button', { name: 'Markdown', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(sourceEditor).toBeVisible()

  await sourceEditor.fill('# 작업 일지\n\n첫 기록')
  await expect(page.getByText('저장 안 됨')).toBeVisible()
  await page.waitForTimeout(1200)

  const contentBeforeManualSave = await page.evaluate(async () => {
    const originPrivateRoot = await navigator.storage.getDirectory()
    const workspace =
      await originPrivateRoot.getDirectoryHandle('E2E Workspace')
    const documents = await workspace.getDirectoryHandle('Documents')
    return (
      await (await documents.getFileHandle('작업 일지.md')).getFile()
    ).text()
  })
  expect(contentBeforeManualSave).toBe('')

  await page.keyboard.press('Control+s')
  await expect(page.getByText('저장됨')).toBeVisible()

  await page.getByRole('button', { name: '마지막 변경 실행 취소' }).click()
  await expect(sourceEditor).toHaveValue('')
  await expect(
    page.getByRole('button', { name: '마지막 변경 실행 취소' }),
  ).toBeEnabled()

  await sourceEditor.fill('# 이동 취소 확인')
  await page.getByRole('button', { name: '데이터베이스' }).click()
  const unsavedDialog = page.getByRole('dialog', {
    name: '저장하지 않은 변경사항이 있습니다',
  })
  await expect(unsavedDialog).toContainText('작업 일지.md')
  await unsavedDialog.getByRole('button', { name: '취소' }).click()
  await expect(sourceEditor).toHaveValue('# 이동 취소 확인')

  await page.getByRole('button', { name: '데이터베이스' }).click()
  await unsavedDialog.getByRole('button', { name: '저장하고 이동' }).click()
  await expect(
    page.getByRole('heading', { name: '데이터베이스' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '기본 테이블', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'View 설정' }).click()
  await expect(page.getByText(/완료 여부 체크됨/)).toBeVisible()
  await page.getByRole('button', { name: 'View 설정' }).click()
  await page.getByRole('treeitem', { name: '작업 일지.md' }).click()
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Markdown 원문' }),
  ).toHaveValue('# 이동 취소 확인')

  await page
    .getByRole('textbox', { name: 'Markdown 원문' })
    .fill('# 저장하지 않을 변경')
  await page.getByRole('button', { name: '데이터베이스' }).click()
  await unsavedDialog
    .getByRole('button', { name: '저장하지 않고 이동' })
    .click()
  await expect(
    page.getByRole('heading', { name: '데이터베이스' }),
  ).toBeVisible()
  await page.getByRole('treeitem', { name: '작업 일지.md' }).click()
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Markdown 원문' }),
  ).toHaveValue('# 이동 취소 확인')

  await page.getByRole('button', { name: '설정', exact: true }).click()
  await settingsDialog.getByRole('checkbox', { name: '자동 저장 사용' }).check()
  await settingsDialog.getByRole('button', { name: '완료' }).click()

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
