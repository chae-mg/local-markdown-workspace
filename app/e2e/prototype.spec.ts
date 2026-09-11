import { expect, test } from '@playwright/test'

test.describe('Notion-style UI prototype', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/prototypes/notion-shell-v1/index.html')
  })

  test('switches between the document and database shells', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: '제품 로드맵' }),
    ).toBeVisible()

    await page
      .getByRole('button', { name: '데이터베이스', exact: true })
      .click()

    await expect(page.getByRole('heading', { name: '프로젝트' })).toBeVisible()
    await expect(
      page.getByRole('cell', { name: /환경설정 화면/ }),
    ).toBeVisible()
  })

  test('previews autosave and theme preferences', async ({ page }) => {
    await page.getByRole('button', { name: '설정', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: '나에게 맞게 조정하기' })
    const delaySelect = dialog.getByRole('combobox', {
      name: '자동 저장 간격',
    })

    await expect(dialog).toBeVisible()
    await dialog.getByRole('checkbox', { name: '자동 저장 사용' }).uncheck()
    await expect(delaySelect).toBeDisabled()

    await dialog.getByRole('button', { name: '다크' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('uses a drawer sidebar on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()

    await expect(page.locator('#app-shell')).toHaveClass(/sidebar-collapsed/)
    await page.getByRole('button', { name: '사이드바 전환' }).click()
    await expect(page.locator('#app-shell')).not.toHaveClass(
      /sidebar-collapsed/,
    )
  })
})
