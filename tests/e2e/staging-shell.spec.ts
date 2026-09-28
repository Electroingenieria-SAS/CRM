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

      const layout = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const offenders = Array.from(document.querySelectorAll<HTMLElement>('*'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              className: element.className,
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })
          .filter((item) => item.right > viewportWidth + 0.5 || item.left < -0.5)
          .slice(0, 10);

        return { viewportWidth, documentWidth, offenders };
      });

      expect(layout.documentWidth > layout.viewportWidth, JSON.stringify(layout, null, 2)).toBe(
        false,
      );
    });
  }
});
