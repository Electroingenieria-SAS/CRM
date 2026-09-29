import { expect, test, type Page } from '@playwright/test';

const email = 'qa-superadmin@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for release accessibility tests.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

async function accessibilityViolations(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const named = (element: Element) => {
      const html = element as HTMLElement;
      if (html.getAttribute('aria-label')?.trim()) return true;
      if (html.getAttribute('aria-labelledby')?.trim()) return true;
      if (html.getAttribute('title')?.trim()) return true;
      if (html.id && document.querySelector(`label[for="${CSS.escape(html.id)}"]`)) return true;
      if (html.closest('label')) return true;
      return Boolean(html.innerText?.trim());
    };
    const rgb = (value: string) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const luminance = (color: number[]) => {
      const channel = color.map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channel[0]! + 0.7152 * channel[1]! + 0.0722 * channel[2]!;
    };
    const background = (element: Element) => {
      let current: Element | null = element;
      while (current) {
        const value = getComputedStyle(current).backgroundColor;
        if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return rgb(value);
        current = current.parentElement;
      }
      return [255, 255, 255];
    };

    const issues: string[] = [];
    for (const element of document.querySelectorAll('button,input,select,textarea,a[href],img')) {
      if (!visible(element)) continue;
      if (element instanceof HTMLImageElement && !element.hasAttribute('alt')) {
        issues.push('img-without-alt');
      } else if (!(element instanceof HTMLImageElement) && !named(element)) {
        issues.push(`${element.tagName.toLowerCase()}-without-accessible-name`);
      }
    }

    for (const element of document.querySelectorAll('p,label,button,a,strong,small,h1,h2,h3')) {
      if (!visible(element) || (element as HTMLButtonElement).disabled) continue;
      const text = (element.textContent ?? '').trim();
      if (!text) continue;
      const style = getComputedStyle(element);
      const foreground = rgb(style.color);
      const behind = background(element);
      if (!foreground || !behind) continue;
      const left = luminance(foreground);
      const right = luminance(behind);
      const ratio = (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
      const size = Number.parseFloat(style.fontSize);
      const weight = Number.parseInt(style.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const minimum = large ? 3 : 4.5;
      if (ratio + 0.01 < minimum)
        issues.push(`contrast:${element.tagName.toLowerCase()}:${ratio.toFixed(2)}`);
    }
    return [...new Set(issues)];
  });
}

test('release routes keep a WCAG AA semantic baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Release accessibility gate runs once.');
  await login(page);

  for (const route of ['/orders', '/analytics', '/admin', '/audit']) {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(await accessibilityViolations(page), route).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);

    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.tagName !== 'BODY')).toBe(true);
  }
});
