import { expect, test } from '@playwright/test'

test('shows the initial workspace entry screen', async ({ page }) => {
  await page.goto('/#/')

  await expect(
    page.getByRole('heading', { name: /내 파일은 내 폴더에/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '워크스페이스 열기' }),
  ).toBeDisabled()
  await expect(page.getByText('Phase 0 · 준비됨')).toBeVisible()
})
