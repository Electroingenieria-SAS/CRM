import { expect, test, type Page } from '@playwright/test';

const coordinatorEmail = 'qa-coordinator-a@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for Orders-Workforce tests.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(coordinatorEmail);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

test('integration health is visible and reconciliation detection is explicit', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The diagnostic action runs once; other projects use the responsive smoke.',
  );

  await login(page);
  await page.goto('/operations/orders-workforce');

  await expect(page.getByRole('heading', { level: 1, name: 'Orders ↔ Workforce' })).toBeVisible();
  await expect(page.getByText('Procesando')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pedidos en operación' })).toBeVisible();\n  await expect(page.getByRole('heading', { name: 'Ocupación por persona' })).toBeVisible();

  await page.getByRole('button', { name: 'Revisar inconsistencias' }).click();
  await expect(page.getByRole('status')).toContainText('Revisión terminada');
});

test('integration health remains usable at reference widths', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Reference-width sweep runs once; project matrix supplies cross-browser smoke.',
  );

  await login(page);

  for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: width <= 430 ? 760 : 900 });
    await page.goto('/operations/orders-workforce');
    await expect(page.getByRole('heading', { level: 1, name: 'Orders ↔ Workforce' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, 'horizontal overflow at ' + width + 'px').toBe(false);
  }
});

test('integration health cross-browser smoke', async ({ page }) => {
  await login(page);
  await page.goto('/operations/orders-workforce');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders ↔ Workforce' })).toBeVisible();
  await expect(page.getByLabel('Estado de integración')).toBeVisible();
});
