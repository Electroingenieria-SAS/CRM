import { expect, test, type Page } from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(sellerEmail);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

test('customer intelligence main journey is explainable and filterable', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'The exhaustive Customer Intelligence journey runs once; cross-browser projects use smoke coverage.',
  );

  await login(page);
  await page.goto('/customers/intelligence');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Ranking y Pareto de clientes' }),
  ).toBeVisible();
  await expect(page.getByText('Cliente Sintético Urgente')).toBeVisible();
  await expect(page.getByText('Cliente Sintético Premium')).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Concentración Pareto real' })).toBeVisible();
  await expect(page.getByText('Top 20 % · valor pagado')).toBeVisible();

  await page
    .getByRole('button', { name: /Abrir Cliente Sintético Premium/ })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Cliente Sintético Premium' }),
  ).toBeVisible();
  await expect(page.getByText(/cantidad de pedidos/i)).toBeVisible();
  await expect(page.getByText(/facturas registradas, netas de reversión/i)).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Evolución de segmento' })).toBeVisible();

  await page.getByLabel('Segmento').selectOption('PREMIUM');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('Cliente Sintético Premium')).toBeVisible();
  await expect(page.getByText('Cliente Sintético Básico')).toHaveCount(0);

  await page.getByLabel('Buscar cliente').fill('900001');
  await page.getByLabel('Segmento').selectOption('');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByText('Cliente Sintético Urgente')).toBeVisible();
});

test('customer intelligence smoke has no accidental horizontal overflow', async ({ page }) => {
  await login(page);
  await page.goto('/customers/intelligence');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Ranking y Pareto de clientes' }),
  ).toBeVisible();
  await expect(page.getByLabel('Ranking de clientes')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
