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
}

test('anonymous users are redirected away from Freight Intelligence', async ({ page }) => {
  await page.goto('/freight');
  await expect(page).toHaveURL(/\/login\/?$/);
});

test('freight workspace renders across configured browsers without horizontal overflow', async ({ page }) => {
  await login(page, sellerEmail);
  await page.getByRole('link', { name: 'Fletes' }).click();
  await expect(page).toHaveURL(/\/freight\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Freight Intelligence' })).toBeVisible();
  await expect(page.getByText('749')).toBeVisible();
  await expect(page.getByText('despachos históricos')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('seller obtains an explainable Armenia estimate and relevant history', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full prediction journey runs once.');
  await login(page, sellerEmail);
  await page.getByRole('link', { name: 'Fletes' }).click();
  await page.getByLabel('Buscar destino').fill('Armenia');
  await page.getByLabel('Destino').selectOption({ label: /Armenia/i });
  await page.getByLabel('Transportadora').selectOption({ label: /Colvanes/i });
  await page.getByRole('button', { name: 'Estimar flete' }).click();
  const result = page.getByTestId('freight-result').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText(/observaciones compatibles/i);
  await expect(result).toContainText(/fallback CITY/i);
  await expect(result).not.toContainText(/Sin evidencia suficiente/i);
  await expect(result.getByLabel('Rango histórico esperado')).toBeVisible();
  await page.getByLabel('Destino', { exact: true }).nth(1).selectOption({ label: /Armenia/i });
  await page.getByLabel('Transportadora').nth(1).selectOption({ label: /Colvanes/i });
  await page.getByRole('button', { name: 'Filtrar histórico' }).click();
  await expect(page.getByRole('table')).toContainText(/Armenia/i);
  await expect(page.getByRole('table')).toContainText(/Colvanes/i);
});

test('auditor can inspect freight history but cannot request predictions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Authorization scenario runs once.');
  await login(page, auditorEmail);
  await page.getByRole('link', { name: 'Fletes' }).click();
  await expect(page.getByText('Tu perfil tiene acceso de lectura, no de predicción.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Estimar flete' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Histórico relevante' })).toBeVisible();
});