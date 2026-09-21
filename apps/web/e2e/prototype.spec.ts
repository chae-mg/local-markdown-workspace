import { expect, test } from '@playwright/test'

const prototypePath = `${process.env.GITHUB_ACTIONS ? '/local-markdown-workspace' : ''}/prototypes/notion-shell-v1/index.html`

test.describe('Notion-style UI prototype', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(prototypePath)
  })

  test('switches between the document and database shells', async ({
    page,
  }) => {
    await expect(
      page.getByRole('heading', { name: '제품 로드맵' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '공유', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: '즐겨찾기' })).toHaveCount(0)

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

  test('stores a reusable custom accent color', async ({ page }) => {
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await page.getByRole('button', { name: '커스텀' }).click()
    await page.getByRole('textbox', { name: 'HEX' }).fill('#E11D48')
    await page.getByRole('button', { name: '컬러 저장' }).click()

    const accent = await page
      .locator('html')
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--accent').trim(),
      )
    expect(accent).toBe('#E11D48')
    await expect(page.getByRole('status')).toContainText(
      '커스텀 키 컬러를 저장했습니다.',
    )

    await page.reload()
    await page.getByRole('button', { name: '설정', exact: true }).click()

    await expect(page.getByRole('button', { name: '커스텀' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('textbox', { name: 'HEX' })).toHaveValue(
      '#E11D48',
    )
  })

  test('changes and restores the document font', async ({ page }) => {
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await page.getByRole('button', { name: '명조' }).click()

    const contentFont = await page
      .locator('html')
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--content-font').trim(),
      )
    expect(contentFont).toContain('Noto Serif KR')

    await page.reload()
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.getByRole('button', { name: '명조' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
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
