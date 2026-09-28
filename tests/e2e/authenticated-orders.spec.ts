import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!email || !password) {
    throw new Error('E2E user credentials were not provided by CI.');
  }

  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Control integral de pedidos' })).toBeVisible();
});

test('authenticated sales user can create and find an order', async ({ page }, testInfo) => {
  const orderNumber = `E2E-${testInfo.project.name}-${Date.now()}`;

  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await page.getByLabel('Número de pedido *').fill(orderNumber);
  await page.getByLabel('Cliente *').fill('Cliente Sintético E2E');
  await page.getByLabel('Ciudad *').fill('Cali');
  await page.getByLabel('Dirección de entrega *').fill('Calle 10 # 20-30');
  await page.getByLabel('Descripción *').fill('Cable sintético E2E');
  await page.getByLabel('Cantidad *').fill('2');
  await page.getByRole('button', { name: 'Crear pedido', exact: true }).last().click();

  await expect(page.getByText(orderNumber)).toBeVisible();

  await page.getByLabel('Buscar').fill(orderNumber);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText('Prioridad automática')).toBeVisible();
});

test('orders workspace has no accidental horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
