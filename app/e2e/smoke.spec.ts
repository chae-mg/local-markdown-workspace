import { expect, test } from '@playwright/test'

test('shows the initial workspace entry screen', async ({ page }) => {
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '워크스페이스 열기' }),
  ).toBeEnabled()
  await expect(page.getByText('Phase 1 · File System')).toBeVisible()
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
