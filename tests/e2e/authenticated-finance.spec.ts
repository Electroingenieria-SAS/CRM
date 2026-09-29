import { expect, test, type Page } from '@playwright/test';

const sellerEmail = 'qa-seller@example.test';
const carteraEmail = 'qa-cartera@example.test';
const cajaEmail = 'qa-caja-a@example.test';
const gerenciaEmail = 'qa-gerencia@example.test';
const auditorEmail = 'qa-auditor@example.test';

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error('E2E_PASSWORD is required for authenticated tests.');
  return value;
}

async function selectOptionContaining(page: Page, label: string, text: RegExp) {
  const select = page.getByLabel(label, { exact: true });
  const option = select.locator('option').filter({ hasText: text }).first();
  const value = await option.getAttribute('value');
  if (!value) throw new Error('No option matched ' + text.source + ' for ' + label);
  await select.selectOption(value);
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password());
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/orders\/?$/);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login\/?$/);
}

test('finance private routes redirect anonymous users', async ({ page }) => {
  await page.goto('/finance/cash');
  await expect(page).toHaveURL(/\/login\/?$/);
});

test('receivables workspace renders across configured devices without horizontal page overflow', async ({
  page,
}) => {
  await login(page, carteraEmail);
  await page.getByRole('link', { name: 'Cartera' }).click();
  await expect(page).toHaveURL(/\/finance\/receivables\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cartera' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('financial lifecycle is traceable from credit to cash', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Full financial journey runs once.');

  await login(page, sellerEmail);
  await page.getByRole('link', { name: 'Crédito' }).click();
  await page.getByLabel('Buscar cliente').fill('QA-FIN-CREDIT');
  await page.getByRole('button', { name: 'Buscar' }).first().click();
  await selectOptionContaining(page, 'Cliente', /Cliente Crédito E2E/i);
  await page.getByLabel('Valor solicitado (COP)').fill('500000');
  await page.getByLabel('Plazo solicitado (días)').fill('30');
  await page.getByRole('button', { name: 'Radicar crédito' }).click();
  await expect(page.getByRole('status')).toContainText('Solicitud de crédito radicada');
  await logout(page);

  await login(page, carteraEmail);
  await page.getByRole('link', { name: 'Crédito' }).click();
  const creditRow = page
    .getByRole('row')
    .filter({ hasText: 'Cliente Crédito E2E' })
    .filter({ hasText: 'SUBMITTED' })
    .first();
  await expect(creditRow).toBeVisible();
  await creditRow.getByRole('button', { name: 'Tomar' }).click();
  const reviewedRow = page
    .getByRole('row')
    .filter({ hasText: 'Cliente Crédito E2E' })
    .filter({ hasText: 'UNDER_REVIEW' })
    .first();
  await reviewedRow
    .getByLabel('Justificación')
    .fill('Crédito revisado con información disponible.');
  await reviewedRow.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByRole('status')).toContainText('Crédito aprobado');
  const approvedRow = page
    .getByRole('row')
    .filter({ hasText: 'Cliente Crédito E2E' })
    .filter({ hasText: 'APPROVED' })
    .first();
  await expect(approvedRow).toBeVisible();

  await page.getByRole('link', { name: 'Cartera' }).click();
  await page.getByLabel('Buscar en Cartera').fill('FIN-E2E-CARTERA');
  await page.getByRole('button', { name: 'Buscar' }).click();
  const carteraRow = page.getByRole('row').filter({ hasText: 'FIN-E2E-CARTERA' });
  await carteraRow.getByRole('button', { name: 'Revisar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen financiero' })).toBeVisible();
  await page
    .getByLabel('Razón / contexto')
    .fill('Mora reportada externamente; requiere excepción.');
  await page.getByLabel('Exigir aprobación independiente para liberar').check();
  await page.getByRole('button', { name: 'Retener pedido' }).click();
  await expect(page.getByRole('status')).toContainText('Pedido retenido');
  await page
    .getByLabel('Razón / contexto')
    .fill('Solicito liberación con autorización de Gerencia.');
  await page.getByRole('button', { name: 'Solicitar excepción' }).click();
  await expect(page.getByRole('status')).toContainText('Excepción enviada');
  await logout(page);

  await login(page, gerenciaEmail);
  await page.getByRole('link', { name: 'Aprobaciones' }).click();
  const approvalRow = page.getByRole('row').filter({ hasText: 'FIN-E2E-CARTERA' });
  await expect(approvalRow).toBeVisible();
  await approvalRow.getByLabel('Justificación').fill('Excepción autorizada para QA.');
  await approvalRow.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByRole('status')).toContainText('Excepción aprobada');
  await logout(page);

  await login(page, carteraEmail);
  await page.getByRole('link', { name: 'Cartera' }).click();
  await page.getByLabel('Buscar en Cartera').fill('FIN-E2E-CARTERA');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'FIN-E2E-CARTERA' })
    .getByRole('button', { name: 'Revisar' })
    .click();
  await page.getByLabel('Razón / contexto').fill('Liberación aprobada por Gerencia.');
  await page.getByRole('button', { name: 'Liberar con trazabilidad' }).click();
  await expect(page.getByRole('status')).toContainText('Retención liberada');
  await logout(page);

  await login(page, cajaEmail);
  await page.getByRole('link', { name: 'Caja' }).click();
  await page.getByLabel('Buscar en Caja').fill('FIN-E2E-CAJA');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'FIN-E2E-CAJA' })
    .getByRole('button', { name: 'Revisar' })
    .click();
  await page.getByLabel('Referencia del soporte').fill('qa://finance/support-e2e');
  await page.getByRole('button', { name: 'Registrar soporte' }).click();
  await expect(page.getByRole('status')).toContainText('Soporte financiero referenciado');
  await page.getByRole('button', { name: 'Validar soporte' }).click();
  await page.getByLabel('Factura', { exact: true }).fill('FIN-E2E-INV-001');
  await page.getByLabel('Valor pagado registrado (COP)').fill('120000');
  await page.getByLabel('Soporte validado').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Registrar factura pagada' }).click();
  await expect(page.getByRole('status')).toContainText('Factura registrada');
  await expect(page.getByText(/120\.000/)).toBeVisible();
});

test('auditor can inspect finance but cannot mutate', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Read-only authorization scenario runs once.',
  );

  await login(page, auditorEmail);
  await page.goto('/finance/cash');
  await expect(page.getByRole('heading', { level: 1, name: 'Caja' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar soporte' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar factura pagada' })).toHaveCount(0);
});
