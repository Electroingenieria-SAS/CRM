import { expect, test, type Page } from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';
const auditorEmail = 'qa-auditor@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Control integral de pedidos' }),
  ).toBeVisible();
}

test('sales user logs in, creates, filters and opens an order', async ({ page }, testInfo) => {
  await login(page, sellerEmail);

  const suffix = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toUpperCase();
  const orderNumber = `E2E-${suffix}-${testInfo.retry}-${Date.now()}`;

  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await page.getByLabel('Número de pedido *').fill(orderNumber);
  await page.getByLabel('Cliente *').fill('Cliente Sintético E2E');
  await page.getByLabel('Ciudad *').fill('Cali');
  await page.getByLabel('Dirección de entrega *').fill('Calle QA 10 # 20-30');
  await page.getByLabel('Descripción *').fill('Cable sintético E2E');
  await page.getByLabel('Cantidad *').fill('2');
  await page.getByRole('button', { name: 'Crear pedido', exact: true }).last().click();

  await expect(page.getByText(orderNumber)).toBeVisible();

  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();

  const row = page.getByRole('button', { name: new RegExp(orderNumber) });
  await expect(row).toBeVisible();
  await expect(page.getByText('Prioridad automática')).toBeVisible();
  await row.click();

  await expect(page.getByRole('heading', { level: 2, name: orderNumber })).toBeVisible();
  await expect(page.getByText('Cable sintético E2E')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('auditor can read orders but cannot create them', async ({ page }) => {
  await login(page, auditorEmail);
  await expect(page.getByRole('button', { name: 'Crear pedido' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Lista de pedidos' })).toBeVisible();
});

test('logout invalidates the local session and returns to login', async ({ page }) => {
  await login(page, sellerEmail);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ingresar al CRM' })).toBeVisible();
});
