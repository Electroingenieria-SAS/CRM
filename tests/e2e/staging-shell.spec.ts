import { expect, test } from '@playwright/test';

test('staging shell renders without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'CRM empresarial' })).toBeVisible();
  await expect(page.getByText('staging seguro')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('semantic landmarks and language are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
});
