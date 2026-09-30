import { expect, test, type Page } from '@playwright/test';

const auditorEmail = 'qa-auditor@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(auditorEmail);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

test('supply workspace exposes the four certified operational queues', async ({ page }) => {
  await login(page);
  await page.goto('/supply');

  await expect(
    page.getByRole('heading', { name: 'Compras, recepción, alistamiento y corte' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compras' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recepción' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alistamiento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corte' })).toBeVisible();
  await expect(page.getByText('SUP-E2E-PVE')).toBeVisible();

  await page.getByRole('button', { name: 'Recepción' }).click();
  await expect(page.getByText('SUP-E2E-REC')).toBeVisible();

  await page.getByRole('button', { name: 'Alistamiento' }).click();
  await expect(page.getByText('INV-E2E-ORDER')).toBeVisible();

  await page.getByRole('button', { name: 'Corte' }).click();
  await expect(page.getByText('INV-CONC-A')).toBeVisible();
});

test('supply workspace has no page overflow at required widths', async ({ page }) => {
  await login(page);
  await page.goto('/supply');

  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole('heading', { name: 'Compras, recepción, alistamiento y corte' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      'horizontal overflow at width ' + width,
    ).toBe(false);
  }
});
