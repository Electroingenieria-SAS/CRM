import { expect, test } from '@playwright/test';

test('staging shell renders without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'CRM empresarial' })).toBeVisible();
  await expect(page.getByText('staging seguro')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('semantic landmarks and language are present', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5);
});

test('keyboard navigation exposes a visible focus target', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const focused = page.locator(':focus');
  await expect(focused).toHaveCount(1);
  await expect(focused).toBeVisible();
});

test.describe('reference responsive widths', () => {
  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    test(`no accidental horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
